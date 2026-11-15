"""Evidence brief: strict schema, grounding, gap computed in Python, rules/mock output, tone and cache."""

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from atlas.agents.application import options
from atlas.agents.application.run_query import Timeouts, run_query
from atlas.agents.domain.brief import compute_gap
from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION, Classification
from atlas.agents.domain.grounding import Evidence, ground_ui
from atlas.agents.domain.ui import BriefComponent, UIPayload
from atlas.agents.domain.ui_rules import build_rules_ui
from atlas.main import create_app
from atlas.query.infrastructure.file_cache import FileQueryCache, normalize
from atlas.shared.config import Settings

FAST = Timeouts(classifier=0.05, agent=0.05, composer=0.05)
QUESTION = "¿Hay ensayos de sólidos con más de 30 % de O₂?"
EMPTY_QUERY = {
    "filtros": {"o2_min": 30.0, "material_class": ["polymer"]},
    "columns": ["experiment_id", "material"],
    "rows": [],
    "total": 0,
}
DATA_QUERY = {
    "filtros": {"gravity_environment": ["microgravity", "normal"]},
    "columns": ["experiment_id", "gravity_environment", "ensayos"],
    "rows": [["PSI-99", "microgravity", 4], ["PSI-100", "normal", 2]],
    "total": 2,
}
SOURCE = {
    "ref": 1,
    "experiment_id": "PSI-99",
    "source_file": "report.pdf",
    "section": "3.1",
    "content": "Flame spread in 4 tests.",
}
LENSES = {"student": "Piensa: ¿qué pasa?", "teacher": "Actividad de clase.", "researcher": "Revisa los rangos."}
INTERNAL = re.compile(r"agente|analista|investigador|herramienta|búsqueda|respaldo|respuesta|modelo|reintent", re.I)


def brief(**overrides) -> dict:
    base = {
        "type": "brief",
        "verdict": "Los datos del Atlas muestran 2 registros.",
        "evidence": None,
        "gap": None,
        "next_steps": [],
        "lenses": LENSES,
    }
    return {"type": "brief", **{**base, **overrides}}


def ground(component: dict, analyst: dict | None, question: str = "q", researcher: dict | None = None):
    evidence = Evidence(question, analyst, researcher)
    ui = UIPayload(summary="Resumen.", components=[component, {"type": "text", "body": "Texto."}])
    grounded, _ = ground_ui(ui, evidence, "Resumen.")
    assert grounded is not None
    return next(c for c in grounded.components if isinstance(c, BriefComponent))


def objects_in(schema):
    if isinstance(schema, dict):
        if schema.get("type") == "object" or "properties" in schema:
            yield schema
        for value in schema.values():
            yield from objects_in(value)
    elif isinstance(schema, list):
        for value in schema:
            yield from objects_in(value)


def test_strict_schema_has_the_brief_without_discriminator_or_open_objects():
    schema = options._strict_schema(UIPayload.model_json_schema())
    text = json.dumps(schema)
    assert "discriminator" not in text and "BriefComponent" in text
    for obj in objects_in(schema):
        assert obj.get("additionalProperties") is False, obj
        assert "properties" in obj


def test_composer_output_format_is_the_strict_ui_schema():
    schema = options.composer_options(Settings(claude_code_oauth_token=None)).output_format["schema"]
    assert "BriefComponent" in json.dumps(schema)


def test_brief_evidence_must_equal_a_recorded_query():
    analyst = {"consultas": [DATA_QUERY]}
    invented = brief(
        evidence={
            "title": "T",
            "columns": DATA_QUERY["columns"],
            "rows": [["PSI-99", "microgravity", 4], ["PSI-7", "lunar", 9]],
            "experiment_ids": ["PSI-7"],
        }
    )
    grounded = ground(invented, analyst)
    assert grounded.evidence.rows == DATA_QUERY["rows"]
    assert grounded.evidence.experiment_ids == ["PSI-100", "PSI-99"]

    same = brief(
        evidence={"title": "T", "columns": DATA_QUERY["columns"], "rows": DATA_QUERY["rows"][:1], "experiment_ids": ["PSI-99"]}
    )
    assert ground(same, analyst).evidence.rows == DATA_QUERY["rows"][:1]


def test_brief_evidence_without_recorded_data_is_dropped():
    fake = brief(evidence={"title": "T", "columns": ["a"], "rows": [[1]], "experiment_ids": []})
    assert ground(fake, None).evidence is None


def test_gap_bounds_are_computed_from_the_filters_not_the_llm():
    invented = brief(
        gap={
            "description": "Falta 99 kPa.",
            "pressure_kpa_min": 99.0,
            "pressure_kpa_max": None,
            "o2_percent_min": 10.0,
            "o2_percent_max": None,
            "gravity": "lunar",
        }
    )
    gap = ground(invented, {"consultas": [EMPTY_QUERY]}, QUESTION).gap
    assert gap.o2_percent_min == 30.0 and gap.pressure_kpa_min is None and gap.gravity is None
    assert "30" in gap.description and "99" not in gap.description


def test_gap_numbers_are_grounding_evidence():
    evidence = Evidence("q", {"consultas": [EMPTY_QUERY]}, None)
    assert evidence.text_is_grounded("No hay ensayos con O₂ de al menos 30 %.")
    assert not evidence.text_is_grounded("No hay ensayos con O₂ de al menos 31 %.")


def test_gap_is_dropped_when_nothing_supports_it():
    gap = {
        "description": "Hay un hueco.",
        "pressure_kpa_min": None,
        "pressure_kpa_max": None,
        "o2_percent_min": None,
        "o2_percent_max": None,
        "gravity": None,
    }
    covered = {**DATA_QUERY, "rows": [["PSI-1", "lunar", 1], ["PSI-2", "martian", 2]]}
    assert ground(brief(gap=gap), {"consultas": [covered]}).gap is None


def test_gap_from_the_question_when_no_filters_were_recorded():
    gap = compute_gap(QUESTION, [{"columns": ["experiment_id"], "rows": [], "total": 0, "filtros": {}}])
    assert gap is not None and gap.o2_percent_min == 30.0
    assert compute_gap("¿Qué pasa con 30 kPa?", []) is None


def test_gap_names_the_missing_gravity_regime_from_grouped_rows():
    gap = compute_gap("q", [DATA_QUERY])
    assert gap is not None and gap.gravity == "lunar" and "gravedad lunar" in gap.description


def test_ungrounded_lens_verdict_and_label_are_replaced_not_the_whole_brief():
    analyst = {"consultas": [DATA_QUERY]}
    bad = brief(
        verdict="Hay 77 ensayos.",
        lenses={**LENSES, "teacher": "Mide 88 llamas."},
        next_steps=[
            {"kind": "simulate", "label": "Simula 55 kPa", "pressure_kpa": 55.0, "o2_percent": None, "gravity": "lunar", "material": "inventado"}
        ],
    )
    grounded = ground(bad, analyst)
    assert "77" not in grounded.verdict and "2" in grounded.verdict
    assert grounded.lenses.student == LENSES["student"]
    assert "88" not in grounded.lenses.teacher
    step = grounded.next_steps[0]
    assert step.pressure_kpa is None and step.material is None and "55" not in step.label


def test_next_steps_are_capped_and_keep_known_figures():
    steps = [
        {"kind": "explore_map", "label": f"Paso {i}", "pressure_kpa": None, "o2_percent": None, "gravity": None, "material": None}
        for i in range(3)
    ]
    steps[0].update(kind="simulate", label="Simular", o2_percent=30.0, gravity="lunar")
    grounded = ground(brief(next_steps=steps), {"consultas": [EMPTY_QUERY]}, QUESTION)
    assert grounded.next_steps[0].o2_percent == 30.0
    with pytest.raises(ValueError):
        UIPayload(summary="s", components=[brief(next_steps=steps + steps[:1])])


def test_composer_output_without_a_brief_gets_the_rules_brief():
    from tests.test_query import FakeAgents, collect, ui_event

    agents = FakeAgents(composer=[{"summary": "Respuesta.", "components": [{"type": "text", "body": "Texto."}]}])
    ui = ui_event(collect(run_query("compara", agents, composer_mode="agent", timeouts=FAST)))
    assert ui.data["components"][0]["type"] == "brief"
    assert ui.data["brief_version"] == 1


@pytest.mark.parametrize("tipo", ["huecos", "comparar", "evidencia", "general"])
def test_rules_mode_always_yields_a_valid_brief(tipo):
    classification = Classification(tipo=tipo, necesita_datos=True, necesita_fuentes=True)
    ui = build_rules_ui(
        classification, {"respuesta": None, "consultas": [DATA_QUERY]}, {"respuesta": None, "fuentes": [SOURCE]}, "q"
    )
    first = UIPayload.model_validate(ui.model_dump(mode="json")).components[0]
    assert first.type == "brief" and first.evidence.rows == DATA_QUERY["rows"]
    assert 1 <= len(first.next_steps) <= 3


def test_rules_brief_with_a_gap_points_the_simulator_at_it():
    ui = build_rules_ui(DEFAULT_CLASSIFICATION, {"consultas": [EMPTY_QUERY]}, None, QUESTION)
    first = ui.components[0]
    assert first.gap.o2_percent_min == 30.0 and first.evidence is None
    simulate = next(s for s in first.next_steps if s.kind == "simulate")
    assert simulate.o2_percent == 30.0
    assert first.verdict == "El Atlas no tiene ensayos con esas condiciones."


def test_rules_brief_grounds_its_own_text():
    ui = build_rules_ui(DEFAULT_CLASSIFICATION, {"consultas": [EMPTY_QUERY]}, None, QUESTION)
    evidence = Evidence(QUESTION, {"consultas": [EMPTY_QUERY]}, None)
    first = ui.components[0]
    for text in (first.verdict, first.gap.description, *first.lenses.model_dump().values()):
        assert evidence.text_is_grounded(text), text


@pytest.mark.parametrize("tipo", ["huecos", "comparar", "evidencia", "general"])
def test_rules_text_never_exposes_internals(tipo):
    classification = Classification(tipo=tipo, necesita_datos=True, necesita_fuentes=True)
    failed = {"error": "RuntimeError: db down at 10.0.0.1"}
    for analyst, researcher in (
        (failed, failed),
        ({"consultas": [DATA_QUERY]}, failed),
        ({"consultas": [EMPTY_QUERY]}, {"fuentes": [SOURCE]}),
        (None, None),
    ):
        ui = build_rules_ui(classification, analyst, researcher, QUESTION)
        data = ui.model_dump(mode="json")
        texts = [data["summary"]]
        for c in data["components"]:
            texts += [c.get(k) for k in ("body", "message", "note", "verdict")]
            if c["type"] == "brief":
                texts += [c["gap"]["description"] if c["gap"] else None, *c["lenses"].values()]
                texts += [s["label"] for s in c["next_steps"]]
        for text in filter(None, texts):
            assert not INTERNAL.search(text), text
            assert "db down" not in text


def test_mock_mode_serves_a_brief_with_version():
    app = create_app(Settings(_env_file=None, database_url="postgresql://nobody:x@127.0.0.1:1/none", agents_mock=True))
    with TestClient(app) as client:
        body = client.post("/query", json={"q": "¿Qué huecos hay en gravedad lunar?"}).text
    data = json.loads(body.split("event: ui\ndata: ")[1].split("\n\n")[0])
    assert data["brief_version"] == 1
    assert data["components"][0]["type"] == "brief"
    assert not INTERNAL.search(json.dumps(data["components"][0], ensure_ascii=False))


def test_cache_key_is_versioned_and_old_entries_are_not_served(tmp_path: Path):
    path = tmp_path / "cache.json"
    legacy = {"question": "q", "summary": "Respuesta.", "components": [{"type": "text", "body": "El analista no respondió"}]}
    path.write_text(json.dumps({normalize("q"): legacy}), encoding="utf-8")
    cache = FileQueryCache(path)
    assert cache.get("q") is None

    ui = {"summary": "Respuesta.", "components": [{"type": "text", "body": "Texto."}]}
    cache.put("q", ui)
    assert cache.get("q") == ui
    assert f"v2|{normalize('q')}" in json.loads(path.read_text(encoding="utf-8"))


def test_cache_entry_that_fails_the_contract_is_a_miss(tmp_path: Path):
    path = tmp_path / "cache.json"
    broken = {"question": "q", "summary": "x", "components": [{"type": "brief", "verdict": "sin el resto"}]}
    path.write_text(json.dumps({f"v2|{normalize('q')}": broken}), encoding="utf-8")
    assert FileQueryCache(path).get("q") is None
