"""Answer language: the front sends `lang`; every text the user reads follows it. Spanish stays the default."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from atlas.agents.application.run_query import build_composer_prompt, run_query
from atlas.agents.domain.brief import build_rules_brief, compute_gap
from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION, Classification
from atlas.agents.domain.grounding import Evidence, ground_ui
from atlas.agents.domain.labels import humanize
from atlas.agents.domain.lang import ENGLISH_NOTE, for_agents, without_note
from atlas.agents.domain.ui import UIPayload
from atlas.agents.domain.ui_rules import build_rules_ui, rules_summary
from atlas.main import create_app
from atlas.query.application.answer import answer
from atlas.query.infrastructure.file_cache import FileQueryCache
from tests.test_query import ANALYST_OK, FAST, RESEARCHER_OK, FakeAgents, collect, parse_sse, settings, ui_event

GAPS = Classification(tipo="huecos", necesita_datos=True, necesita_fuentes=False)
EMPTY_QUERY = {
    "filtros": {"o2_min": 30, "gravity_environment": ["lunar"]},
    "columns": ["experiment_id"],
    "rows": [],
    "total": 0,
}


def test_agents_get_the_language_note_only_in_english():
    assert for_agents("q", "es") == "q"
    english = for_agents("q", "en")
    assert english.endswith(ENGLISH_NOTE)
    assert without_note(english) == "q"


def test_rules_brief_speaks_english():
    brief = build_rules_brief(GAPS, [EMPTY_QUERY], False, "O2 above 30 % on the Moon", "en")
    assert brief.verdict == "The Atlas has no trials under those conditions."
    assert brief.gap is not None
    assert brief.gap.description == "No trials recorded with O₂ of at least 30 % in lunar gravity."
    assert [s.label for s in brief.next_steps][0] == "Simulate this scenario in the lab"
    assert brief.lenses.student.startswith("A flame depends on oxygen")


def test_rules_brief_stays_spanish_by_default():
    brief = build_rules_brief(GAPS, [EMPTY_QUERY], False, "O2 mayor a 30 % en la Luna")
    assert brief.verdict == "El Atlas no tiene ensayos con esas condiciones."
    assert brief.gap is not None
    assert brief.gap.description == "No hay ensayos registrados con O₂ de al menos 30 % en gravedad lunar."


def test_english_question_words_set_the_gap_bounds():
    gap = compute_gap("Trials with less than 21 % oxygen?", [{**EMPTY_QUERY, "filtros": {"material": "x"}}], "en")
    assert gap is not None
    assert gap.o2_percent_max == 21


def test_rules_ui_in_english():
    ui = build_rules_ui(GAPS, {"error": "x"}, None, "q", "en")
    texts = [ui.summary] + [getattr(c, "message", None) or getattr(c, "body", None) or "" for c in ui.components]
    assert ui.summary == rules_summary(GAPS, "en")
    assert "The Atlas trials could not be queried right now." in texts
    assert [c.title for c in ui.components if c.type == "gap_map"] == ["Gap map"]


def test_humanize_uses_english_labels():
    assert humanize("partial_burn in microgravity", "en") == "partial burn in microgravity"
    assert humanize("partial_burn en microgravity") == "combustión parcial en microgravedad"


def test_grounding_fallbacks_follow_the_language():
    ui = UIPayload.model_validate(
        {
            "summary": "There are 99 trials.",
            "components": [
                {"type": "table", "title": "Made up 77", "columns": ["experiment_id", "material"],
                 "rows": [["PSI-99", "cotton"]]},
                {"type": "gap_map", "title": "Gaps", "experiment_ids": [], "gravity_environment": None, "note": None},
            ],
        }
    )
    evidence = Evidence("q", ANALYST_OK, None, "en")
    grounded, _ = ground_ui(ui, evidence, rules_summary(DEFAULT_CLASSIFICATION, "en"))
    assert grounded is not None
    assert grounded.summary == rules_summary(DEFAULT_CLASSIFICATION, "en")
    table, gap_map = grounded.components
    assert table.title == "Trials queried"
    assert gap_map.note == "No specific experiments to highlight."


def test_composer_prompt_asks_for_english_only_when_needed():
    english = build_composer_prompt("q", DEFAULT_CLASSIFICATION, ANALYST_OK, RESEARCHER_OK, "en")
    spanish = build_composer_prompt("q", DEFAULT_CLASSIFICATION, ANALYST_OK, RESEARCHER_OK)
    assert "## Idioma de la respuesta" in english
    assert "## Idioma de la respuesta" not in spanish


def test_pipeline_passes_the_language_to_agents_and_composer():
    seen: list[str] = []

    class Recording(FakeAgents):
        async def analyst(self, question, classification):
            seen.append(question)
            return await super().analyst(question, classification)

    agents = Recording()
    ui_event(collect(run_query("compare", agents, timeouts=FAST, lang="en")))
    assert seen == [for_agents("compare", "en")]
    assert "## Idioma de la respuesta" in agents.composer_prompts[0]


def test_rules_fallback_in_english_when_the_composer_fails():
    agents = FakeAgents(composer=[RuntimeError("down")])
    ui = ui_event(collect(run_query("compare", agents, timeouts=FAST, lang="en"))).data
    assert ui["summary"] == rules_summary(agents.classification, "en")


def test_cache_keeps_languages_apart(tmp_path: Path):
    cache = FileQueryCache(tmp_path / "cache.json")
    agents = FakeAgents()
    collect(answer("Compare PMMA", agents, composer_mode="agent", cache=cache, timeouts=FAST, lang="en"))
    assert cache.get("Compare PMMA", "en") is not None
    assert cache.get("Compare PMMA", "es") is None


def test_generic_error_in_english(monkeypatch):
    async def explode(*args, **kwargs):
        raise RuntimeError("boom")
        yield  # pragma: no cover - makes this an async generator

    monkeypatch.setattr("atlas.query.application.answer.run_query", explode)
    events = collect(answer("q", FakeAgents(), composer_mode="agent", timeouts=FAST, lang="en"))
    assert events[-1].data == {"message": "The question could not be answered. Please try again."}


@pytest.fixture
def mock_client():
    app = create_app(settings(agents_mock=True))
    with TestClient(app) as client:
        yield client


def test_post_query_accepts_lang(mock_client):
    response = mock_client.post("/query", json={"q": "What gaps are there in lunar gravity?", "lang": "en"})
    name, ui = parse_sse(response.text)[-1]
    assert name == "ui"
    assert ui["summary"] == rules_summary(GAPS, "en")
    assert [c["type"] for c in ui["components"]][:2] == ["brief", "gap_map"]


def test_get_query_accepts_lang(mock_client):
    response = mock_client.get("/query", params={"q": "Why does the flame go out?", "lang": "en"})
    name, ui = parse_sse(response.text)[-1]
    assert name == "ui"
    assert ui["summary"] == rules_summary(Classification(tipo="evidencia", necesita_datos=False,
                                                         necesita_fuentes=True), "en")


def test_post_query_rejects_unknown_lang(mock_client):
    assert mock_client.post("/query", json={"q": "q", "lang": "fr"}).status_code == 422
