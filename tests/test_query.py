"""/query pipeline tests. Everything is mocked: nothing here calls Claude, Voyage or Postgres."""

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from atlas.agents.application import options
from atlas.agents.application.claude_agents import ClaudeAgents
from atlas.agents.application.run_query import Timeouts, run_query
from atlas.agents.domain.grounding import Evidence
from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION, Classification, classify_by_keywords
from atlas.agents.domain.ensayos import MAX_ROWS, FiltroEnsayos, consultar
from atlas.agents.domain.ui import UIPayload
from atlas.agents.domain.ui_rules import build_rules_ui
from atlas.agents.infrastructure import analyst_tools, researcher_tools
from atlas.agents.infrastructure.researcher_tools import add_refs
from atlas.agents.infrastructure.claude_runner import AgentRun
from atlas.agents.infrastructure.document_search import DocumentSearch
from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.main import create_app
from atlas.query.application.answer import answer
from atlas.query.infrastructure.file_cache import FileQueryCache, normalize
from atlas.shared.config import Settings

OFFLINE_DB = "postgresql://nobody:x@127.0.0.1:1/none"
def settings(**overrides) -> Settings:
    return Settings(_env_file=None, database_url=OFFLINE_DB, **overrides)


FAST = Timeouts(classifier=0.05, agent=0.05, composer=0.05)

ANALYST_OK = {
    "respuesta": "Hay 2 ensayos en microgravedad.",
    "consultas": [
        {
            "filtros": {"gravity_environment": ["microgravity"]},
            "columns": ["experiment_id", "material"],
            "rows": [["PSI-99", "cotton"], ["PSI-100", "PMMA"]],
            "truncated": False,
        }
    ],
}
RESEARCHER_OK = {
    "respuesta": "El informe describe la llama [1].",
    "fuentes": [
        {
            "ref": 1,
            "experiment_id": "PSI-99",
            "source_file": "report.pdf",
            "section": "3.1",
            "content": "Flame spread.",
            "score": 0.81,
            "rerank_score": 0.93,
        }
    ],
}
VALID_UI = {"summary": "Respuesta.", "components": [{"type": "text", "body": "Texto."}]}


class FakeAgents:
    def __init__(
        self,
        classification: Classification | Exception | None = None,
        analyst: Any = ANALYST_OK,
        researcher: Any = RESEARCHER_OK,
        composer: list[Any] | None = None,
        delay: dict[str, float] | None = None,
    ) -> None:
        self.classification = classification or Classification(
            tipo="comparar", necesita_datos=True, necesita_fuentes=True
        )
        self.results = {"analyst": analyst, "researcher": researcher}
        self.composer_outputs = list(composer or [VALID_UI])
        self.delay = delay or {}
        self.calls: list[str] = []
        self.composer_prompts: list[str] = []

    async def _respond(self, name: str, value: Any) -> Any:
        self.calls.append(name)
        await asyncio.sleep(self.delay.get(name, 0))
        if isinstance(value, Exception):
            raise value
        return value

    async def classify(self, question: str) -> Classification:
        return await self._respond("classify", self.classification)

    async def analyst(self, question: str, classification: Classification) -> dict[str, Any]:
        return await self._respond("analyst", self.results["analyst"])

    async def researcher(self, question: str, classification: Classification) -> dict[str, Any]:
        return await self._respond("researcher", self.results["researcher"])

    async def composer(self, prompt: str) -> Any:
        self.composer_prompts.append(prompt)
        return await self._respond("composer", self.composer_outputs.pop(0))


def collect(events) -> list:
    async def go():
        return [event async for event in events]

    return asyncio.run(go())


def ui_event(events: list):
    [ui] = [e for e in events if e.name == "ui"]
    return ui


# --- Analyst data in Python ------------------------------------------------

EXPERIMENTS = [r.experiment for r in load_experiment_files(Path(__file__).resolve().parents[1] / "data/experiments")]


def test_filters_combine_and_match_the_records():
    result = consultar(EXPERIMENTS, FiltroEnsayos(gravity_environment=["microgravity"], o2_min=21, o2_max=21))

    columns = result["columns"]
    assert result["total"] > 0
    for row in result["rows"]:
        assert row[columns.index("gravity_environment")] == "microgravity"
        assert row[columns.index("o2_percent")] == 21


def test_material_filter_ignores_case():
    upper = consultar(EXPERIMENTS, FiltroEnsayos(material="KAPTON"))
    lower = consultar(EXPERIMENTS, FiltroEnsayos(material="kapton"))

    assert upper["total"] == lower["total"] > 0


def test_rows_are_capped_at_fifty():
    result = consultar(EXPERIMENTS, FiltroEnsayos())

    assert len(result["rows"]) == min(result["total"], MAX_ROWS)
    assert result["truncated"] is (result["total"] > MAX_ROWS)


def test_grouping_counts_every_test_once():
    total = consultar(EXPERIMENTS, FiltroEnsayos())["total"]
    grouped = consultar(EXPERIMENTS, FiltroEnsayos(agrupar_por=["gravity_environment", "outcome"]))

    assert grouped["columns"][:2] == ["gravity_environment", "outcome"]
    count = grouped["columns"].index("ensayos")
    assert sum(row[count] for row in grouped["rows"]) == total


@pytest.mark.parametrize(
    "args",
    [
        {"sql": "select 1"},
        {"gravity_environment": ["moon"]},
        {"agrupar_por": ["thickness_mm"]},
        {"o2_min": "alto"},
        {"metricas": ["outcome"]},
        {"correlacion": ["o2_percent"]},
    ],
)
def test_invalid_filters_are_rejected(args):
    with pytest.raises(ValueError):
        FiltroEnsayos.model_validate(args)


def test_metrics_without_grouping_give_one_summary_row():
    result = consultar(EXPERIMENTS, FiltroEnsayos(metricas=["spread_rate_mm_s"]))

    [row] = result["rows"]
    values = dict(zip(result["columns"], row, strict=True))
    assert values["ensayos"] == consultar(EXPERIMENTS, FiltroEnsayos())["total"]
    assert values["spread_rate_mm_s_min"] <= values["spread_rate_mm_s_promedio"] <= values["spread_rate_mm_s_max"]


def test_metrics_per_group_ignore_missing_values():
    result = consultar(EXPERIMENTS, FiltroEnsayos(agrupar_por=["experiment_id"], metricas=["burn_length_cm"]))

    assert result["columns"][-3:] == ["burn_length_cm_promedio", "burn_length_cm_min", "burn_length_cm_max"]
    assert all(len(row) == len(result["columns"]) for row in result["rows"])


def test_correlation_reports_pearson_and_sample_size():
    result = consultar(EXPERIMENTS, FiltroEnsayos(correlacion=("o2_percent", "spread_rate_mm_s")))
    corr = result["correlacion"]

    assert corr["n"] >= 3
    assert -1 <= corr["pearson"] <= 1


def test_correlation_explains_when_it_cannot_be_computed():
    corr = consultar(EXPERIMENTS, FiltroEnsayos(experiment_ids=["PSI-0"], correlacion=("o2_percent", "pressure_kpa")))[
        "correlacion"
    ]

    assert corr["pearson"] is None and "al menos 3" in corr["nota"]


def capture_analyst_tool(monkeypatch, load, log):
    captured: dict = {}
    monkeypatch.setattr(
        analyst_tools, "create_sdk_mcp_server", lambda name, tools: captured.setdefault("tool", tools[0])
    )
    analyst_tools.build_analyst_server(load, log)
    return captured["tool"].handler


def test_analyst_tool_loads_once_and_logs_queries(monkeypatch):
    calls = []

    async def load():
        calls.append(1)
        return EXPERIMENTS

    log: list = []
    handler = capture_analyst_tool(monkeypatch, load, log)

    async def two_queries():
        await handler({"material": "kapton"})
        return await handler({"agrupar_por": ["experiment_id"]})

    result = asyncio.run(two_queries())

    assert len(calls) == 1
    assert [q["filtros"] for q in log] == [{"material": "kapton"}, {"agrupar_por": ["experiment_id"]}]
    assert json.loads(result["content"][0]["text"])["columns"][0] == "experiment_id"


def test_analyst_tool_returns_errors_as_text(monkeypatch):
    async def broken():
        raise ConnectionError("db down")

    log: list = []
    handler = capture_analyst_tool(monkeypatch, broken, log)

    bad_params = asyncio.run(handler({"sql": "drop table experiments"}))
    load_failed = asyncio.run(handler({}))

    assert bad_params["is_error"] is True and "Parámetros inválidos" in bad_params["content"][0]["text"]
    assert load_failed["is_error"] is True and "ConnectionError" in load_failed["content"][0]["text"]
    assert log == []


def test_analyst_tool_reports_an_empty_database(monkeypatch):
    async def empty():
        return []

    log: list = []
    handler = capture_analyst_tool(monkeypatch, empty, log)

    result = asyncio.run(handler({}))

    assert result["is_error"] is True and "atlas-load" in result["content"][0]["text"]
    assert log == []


# --- Researcher over role 2's search_documents ------------------------------


def hit(content: str, rerank: float | None = None) -> dict:
    return {
        "experiment_id": "PSI-99",
        "source_file": "report.pdf",
        "section": "2",
        "content": content,
        "score": 0.5,
        "rerank_score": rerank,
    }


def test_refs_are_stable_and_deduplicated_across_searches():
    log: list = []

    first = add_refs(log, [hit("a", 0.9), hit("b", 0.4)])
    second = add_refs(log, [hit("b", 0.7), hit("c", 0.2)])

    assert [h["ref"] for h in first] == [1, 2]
    assert [h["ref"] for h in second] == [2, 3]
    assert [h["content"] for h in log] == ["a", "b", "c"]
    assert log[0]["rerank_score"] == 0.9


class FakeEmbedder:
    async def embed_documents(self, texts):
        return [[0.0] * 3 for _ in texts]

    async def embed_query(self, text):
        return [0.1, 0.2, 0.3]


class ReverseReranker:
    """Puts the last vector candidate first, so the test can see the reorder."""

    async def rerank(self, query, documents, top_k):
        order = list(reversed(range(len(documents))))[:top_k]
        return [(index, 1.0 - rank / 10) for rank, index in enumerate(order)]


class ChunkPool:
    """Stands in for the psycopg pool: every query returns the same three chunks in vector order."""

    def __init__(self) -> None:
        self.rows = [
            {"experiment_id": "PSI-99", "source_file": "f.pdf", "section": "1", "content": c, "score": s}
            for c, s in (("near", 0.9), ("mid", 0.8), ("far", 0.7))
        ]

    def connection(self, timeout=None):
        rows = self.rows

        class Conn:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def execute(self, sql, params):
                k = params[-1]

                class Cursor:
                    async def fetchall(self):
                        return rows[:k]

                return Cursor()

        return Conn()


def test_document_search_uses_the_reranker_and_keeps_its_score():
    search = DocumentSearch(ChunkPool(), FakeEmbedder(), ReverseReranker(), candidates=3)  # type: ignore[arg-type]

    hits = asyncio.run(search("flame", 2))

    assert [h["content"] for h in hits] == ["far", "mid"]
    assert hits[0]["rerank_score"] == 1.0
    assert set(hits[0]) == {"experiment_id", "source_file", "section", "content", "score", "rerank_score"}


def test_document_search_without_reranker_keeps_vector_order():
    search = DocumentSearch(ChunkPool(), FakeEmbedder(), None)  # type: ignore[arg-type]

    hits = asyncio.run(search("flame", 2))

    assert [h["content"] for h in hits] == ["near", "mid"]
    assert hits[0]["rerank_score"] is None


def test_document_search_needs_the_voyage_key():
    with pytest.raises(RuntimeError, match="VOYAGE_API_KEY"):
        asyncio.run(DocumentSearch(ChunkPool(), None)("flame", 2))  # type: ignore[arg-type]


# --- Orchestrator -----------------------------------------------------------


def test_happy_path_streams_status_then_validated_ui():
    agents = FakeAgents()
    events = collect(run_query("compara materiales", agents, timeouts=FAST))

    steps = [e.data["step"] for e in events if e.name == "status"]
    assert steps == ["clasificando", "consultando_datos", "buscando_fuentes", "componiendo"]
    ui = ui_event(events)
    assert ui.cacheable is True
    assert UIPayload.model_validate({k: v for k, v in ui.data.items() if k != "ms"})
    assert isinstance(ui.data["ms"], int)
    assert "PSI-99" in agents.composer_prompts[0]


def test_analyst_and_researcher_run_in_parallel():
    agents = FakeAgents(delay={"analyst": 0.2, "researcher": 0.2})
    timeouts = Timeouts(classifier=1, agent=1, composer=1)

    started = time.monotonic()
    events = collect(run_query("q", agents, timeouts=timeouts))

    assert time.monotonic() - started < 0.35  # sequential would take 0.4 s
    assert ui_event(events).cacheable is True


def test_classifier_timeout_falls_back_to_running_both_agents():
    agents = FakeAgents(
        classification=Classification(tipo="huecos", necesita_datos=False, necesita_fuentes=False),
        delay={"classify": 0.2},
    )
    collect(run_query("q", agents, timeouts=FAST))

    assert {"analyst", "researcher"} <= set(agents.calls)


def test_classifier_error_falls_back_to_default():
    agents = FakeAgents(classification=RuntimeError("boom"))
    events = collect(run_query("q", agents, timeouts=FAST))

    assert {"analyst", "researcher"} <= set(agents.calls)
    assert ui_event(events)


def test_skips_agents_the_classifier_does_not_need():
    agents = FakeAgents(classification=Classification(tipo="evidencia", necesita_datos=False, necesita_fuentes=True))
    events = collect(run_query("q", agents, timeouts=FAST))

    assert "analyst" not in agents.calls
    assert "consultando_datos" not in [e.data.get("step") for e in events]


def test_a_failing_agent_does_not_stop_the_other_and_is_not_cached():
    agents = FakeAgents(analyst=RuntimeError("db down"), composer=[{"bad": "shape"}, {"bad": "shape"}])
    events = collect(run_query("compara", agents, timeouts=FAST))

    assert "researcher" in agents.calls
    ui = ui_event(events)
    assert ui.cacheable is False
    notices = [c for c in ui.data["components"] if c["type"] == "notice"]
    assert "db down" in notices[0]["message"]


def test_agent_timeout_becomes_an_error_result():
    agents = FakeAgents(delay={"researcher": 0.2})
    collect(run_query("q", agents, timeouts=FAST))

    prompt = agents.composer_prompts[0]
    assert "tiempo agotado" in prompt


def test_composer_retries_once_with_the_validation_error():
    agents = FakeAgents(composer=[{"summary": "", "components": []}, VALID_UI])
    events = collect(run_query("q", agents, timeouts=FAST))

    assert len(agents.composer_prompts) == 2
    assert "no pasó la validación" in agents.composer_prompts[1]
    assert ui_event(events).data["summary"] == "Respuesta."
    assert ui_event(events).cacheable is True


def test_composer_falls_back_to_rules_after_two_invalid_outputs():
    agents = FakeAgents(composer=[{"x": 1}, {"y": 2}])
    events = collect(run_query("q", agents, timeouts=FAST))

    ui = ui_event(events)
    assert len(agents.composer_prompts) == 2
    assert ui.cacheable is False
    assert "table" in [c["type"] for c in ui.data["components"]]  # tipo comparar -> table


def test_composer_timeout_goes_straight_to_rules():
    agents = FakeAgents(delay={"composer": 0.2})
    events = collect(run_query("q", agents, timeouts=FAST))

    assert len(agents.composer_prompts) == 1
    assert ui_event(events).cacheable is False


def test_rules_mode_never_calls_the_composer():
    agents = FakeAgents()
    collect(run_query("q", agents, composer_mode="rules", timeouts=FAST))

    assert "composer" not in agents.calls


# --- Rules composer ---------------------------------------------------------


@pytest.mark.parametrize(
    ("tipo", "component"),
    [("huecos", "gap_map"), ("comparar", "table"), ("evidencia", "citations"), ("general", "text")],
)
def test_rules_map_each_query_kind_to_its_component(tipo, component):
    classification = Classification(tipo=tipo, necesita_datos=True, necesita_fuentes=True)
    ui = build_rules_ui(classification, ANALYST_OK, RESEARCHER_OK)

    assert component in [c.type for c in ui.components]


def test_rules_gap_map_highlights_experiments_from_the_table():
    ui = build_rules_ui(Classification(tipo="huecos", necesita_datos=True, necesita_fuentes=False), ANALYST_OK, None)

    assert ui.components[0].type == "gap_map"
    assert ui.components[0].experiment_ids == ["PSI-100", "PSI-99"]


def test_rules_ui_is_valid_even_with_nothing():
    ui = build_rules_ui(DEFAULT_CLASSIFICATION, {"error": "x"}, None)

    assert [c.type for c in ui.components] == ["text", "notice"]


def test_keyword_classifier():
    assert classify_by_keywords("¿Qué huecos hay en gravedad lunar?").tipo == "huecos"
    assert classify_by_keywords("Compara PMMA y algodón").tipo == "comparar"
    assert classify_by_keywords("¿Qué evidencia hay de extinción?").tipo == "evidencia"
    assert classify_by_keywords("Hola") == DEFAULT_CLASSIFICATION


# --- Agent options ----------------------------------------------------------


class RecordingRunner:
    def __init__(self, result: AgentRun) -> None:
        self.result = result
        self.calls: list = []

    async def __call__(self, opts, prompt):
        self.calls.append((opts, prompt))
        return self.result


async def _no_search(query: str, k: int) -> list:
    return [
        {"experiment_id": "PSI-99", "source_file": "f.pdf", "section": None, "content": "c", "score": 0.4,
         "rerank_score": 0.8}
    ]


def _isolated(opts) -> None:
    assert opts.tools == []
    assert opts.setting_sources == []
    assert opts.strict_mcp_config is True


def test_every_agent_is_isolated_and_only_gets_its_own_tools():
    config = settings()
    analyst = options.analyst_options(config, analyst_tools.build_analyst_server(None, []))  # type: ignore[arg-type]
    researcher = options.researcher_options(config, researcher_tools.build_researcher_server(_no_search, []))
    composer = options.composer_options(config)
    classifier = options.classifier_options(config)

    for opts in (analyst, researcher, composer, classifier):
        _isolated(opts)
    assert analyst.allowed_tools == ["mcp__analista__consultar_ensayos"]
    assert list(analyst.mcp_servers) == ["analista"]
    assert researcher.allowed_tools == ["mcp__investigador__buscar_documentos"]
    assert composer.allowed_tools == [] and composer.mcp_servers == {}
    assert composer.output_format == {"type": "json_schema", "schema": UIPayload.model_json_schema()}
    assert classifier.max_turns == 1
    assert classifier.model == "claude-haiku-5-5"
    assert classifier.output_format["schema"] == Classification.model_json_schema()


def test_oauth_token_is_passed_only_through_the_subprocess_env():
    opts = options.composer_options(settings(claude_code_oauth_token="tok"))

    assert opts.env == {"CLAUDE_CODE_OAUTH_TOKEN": "tok"}


def test_claude_agents_parse_structured_output():
    runner = RecordingRunner(AgentRun(None, {"tipo": "huecos", "necesita_datos": True, "necesita_fuentes": False}, 0))
    agents = ClaudeAgents(settings(), None, _no_search, runner)  # type: ignore[arg-type]

    classification = asyncio.run(agents.classify("¿huecos?"))

    assert classification.tipo == "huecos"
    assert runner.calls[0][0].max_turns == 1


def test_direct_researcher_mode_skips_the_llm():
    runner = RecordingRunner(AgentRun("no", None, 0))
    agents = ClaudeAgents(settings(investigador_mode="direct"), None, _no_search, runner)  # type: ignore[arg-type]

    result = asyncio.run(agents.researcher("q", DEFAULT_CLASSIFICATION))

    assert runner.calls == []
    assert result["fuentes"][0]["ref"] == 1
    assert result["fuentes"][0]["rerank_score"] == 0.8


def test_settings_read_the_cut_modes_from_env(monkeypatch):
    monkeypatch.setenv("COMPOSITOR_MODE", "rules")
    monkeypatch.setenv("INVESTIGADOR_MODE", "direct")
    monkeypatch.setenv("AGENTS_MOCK", "1")

    config = Settings(_env_file=None)

    assert (config.compositor_mode, config.investigador_mode, config.agents_mock) == ("rules", "direct", True)


# --- Cache ------------------------------------------------------------------


def test_cache_serves_the_second_identical_question(tmp_path: Path):
    cache = FileQueryCache(tmp_path / "cache.json")
    agents = FakeAgents()

    collect(answer("¿Compara PMMA?", agents, composer_mode="agent", cache=cache, timeouts=FAST))
    second = collect(answer("  compara pmma ", FakeAgents(), composer_mode="agent", cache=cache, timeouts=FAST))

    assert [e.data.get("step") for e in second if e.name == "status"] == ["cache"]
    assert ui_event(second).data["summary"] == "Respuesta."
    assert json.loads((tmp_path / "cache.json").read_text())[normalize("compara pmma")]["question"] == "¿Compara PMMA?"


def test_cache_skips_answers_with_agent_errors(tmp_path: Path):
    cache = FileQueryCache(tmp_path / "cache.json")
    collect(answer("q", FakeAgents(analyst=RuntimeError("x")), composer_mode="agent", cache=cache, timeouts=FAST))

    assert cache.get("q") is None


def test_pipeline_crash_becomes_an_error_event(monkeypatch):
    async def explode(*args, **kwargs):
        raise RuntimeError("bug")
        yield  # pragma: no cover - makes this an async generator

    monkeypatch.setattr("atlas.query.application.answer.run_query", explode)

    events = collect(answer("q", FakeAgents(), composer_mode="agent"))

    assert [e.name for e in events] == ["error"]
    assert "bug" not in events[0].data["message"]


# --- HTTP / SSE -------------------------------------------------------------


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


@pytest.fixture
def mock_client():
    app = create_app(settings(agents_mock=True))
    with TestClient(app) as client:
        yield client


def test_post_query_streams_sse_in_mock_mode(mock_client):
    response = mock_client.post("/query", json={"q": "¿Qué huecos hay en gravedad lunar?"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    assert [name for name, _ in events][-1] == "ui"
    assert events[0] == ("status", {"step": "clasificando"})
    ui = events[-1][1]
    assert set(ui) == {"summary", "components", "ms"}
    assert ui["components"][0]["type"] == "gap_map"
    UIPayload.model_validate({"summary": ui["summary"], "components": ui["components"]})


def test_get_query_works_for_event_source(mock_client):
    response = mock_client.get("/query", params={"q": "¿Qué evidencia hay?"})

    events = parse_sse(response.text)
    assert events[-1][0] == "ui"
    assert "citations" in [c["type"] for c in events[-1][1]["components"]]


@pytest.mark.parametrize("payload", [{"q": ""}, {"q": "   "}, {"q": "x" * 501}, {}])
def test_post_query_rejects_bad_questions(mock_client, payload):
    assert mock_client.post("/query", json=payload).status_code == 422


def test_get_query_requires_q(mock_client):
    assert mock_client.get("/query").status_code == 422


def test_committed_ui_schema_matches_the_contract():
    committed = json.loads((Path(__file__).resolve().parents[1] / "data/schema/ui.schema.json").read_text())

    assert committed == UIPayload.model_json_schema(), "regenerate data/schema/ui.schema.json (see curren_repo_context)"


# --- Grounding of the composer UI ------------------------------------------

def ui_with(*components) -> dict:
    return {"summary": "Respuesta.", "components": list(components)}


TABLE_OK = {"type": "table", "title": "T", "columns": ["experiment_id", "material"], "rows": [["PSI-100", "PMMA"]]}
CITATION_OK = {"experiment_id": "PSI-99", "source_file": "report.pdf", "section": "3.1", "quote": "flame   spread"}


def composed(*components):
    agents = FakeAgents(composer=[ui_with(*components)])
    return ui_event(collect(run_query("q", agents, composer_mode="agent", timeouts=FAST)))


def test_grounded_tables_and_citations_pass_unchanged():
    ui = composed(TABLE_OK, {"type": "citations", "items": [CITATION_OK]})
    assert ui.cacheable
    table, citations = ui.data["components"]
    assert table["rows"] == [["PSI-100", "PMMA"]]
    assert citations["items"][0]["quote"] == "flame   spread"


def test_an_invented_table_row_is_replaced_by_the_logged_table():
    invented = {**TABLE_OK, "rows": [["PSI-100", "PMMA"], ["PSI-7", "wood"]]}
    [table] = composed(invented).data["components"]
    assert table["rows"] == ANALYST_OK["consultas"][0]["rows"]


def test_a_table_with_unknown_columns_gets_the_logged_columns():
    [table] = composed({**TABLE_OK, "columns": ["experiment_id", "o2"]}).data["components"]
    assert table["columns"] == ["experiment_id", "material"]


def test_citations_must_be_literal_text_of_a_logged_fragment():
    items = [
        CITATION_OK,
        {**CITATION_OK, "quote": "The flame went out."},
        {**CITATION_OK, "source_file": "other.pdf"},
        {**CITATION_OK, "section": "inventada"},
    ]
    [citations] = composed({"type": "citations", "items": items}).data["components"]
    assert len(citations["items"]) == 2
    assert all(i["section"] == "3.1" for i in citations["items"])


def test_gap_map_keeps_only_experiments_found_in_the_data():
    gap = {"type": "gap_map", "title": "M", "experiment_ids": ["PSI-99", "PSI-1234"], "gravity_environment": None, "note": None}
    [gap_map] = composed(gap).data["components"]
    assert gap_map["experiment_ids"] == ["PSI-99"]


def test_ui_with_nothing_grounded_falls_back_to_rules():
    fake_quote = {"type": "citations", "items": [{**CITATION_OK, "quote": "Nada de esto existe."}]}
    notice = {"type": "notice", "level": "info", "message": "Aviso."}
    ui = composed(fake_quote, notice)
    assert not ui.cacheable
    assert {c["type"] for c in ui.data["components"]} >= {"table", "citations"}


TABLE_WITH_TOTAL = {**ANALYST_OK["consultas"][0], "rows": [["PSI-99", 12.5], ["PSI-100", 3]], "total": 2}


def evidence(question: str = "q") -> Evidence:
    analyst = {"respuesta": None, "consultas": [{**TABLE_WITH_TOTAL, "columns": ["experiment_id", "o2"]}]}
    researcher = {"respuesta": None, "fuentes": [{**RESEARCHER_OK["fuentes"][0], "content": "Flame spread at 1,283 mm in 2012."}]}
    return Evidence(question, analyst, researcher)


@pytest.mark.parametrize(
    "text",
    [
        "Hay 2 ensayos.",  # total
        "PSI-99 llega a 12.5 y PSI-100 a 3.",  # cells and known ids
        "El 12,5 del PSI-99.",  # decimal comma
        "Se propagó 1,283 mm en 2012 [1].",  # figures of the fragment and a known ref
        "A 30 kPa no hay datos.",  # figure taken from the question
        "Sin cifras.",
    ],
)
def test_text_with_figures_from_the_data_is_grounded(text):
    assert evidence("¿Qué pasa a 30 kPa?").text_is_grounded(text)


@pytest.mark.parametrize(
    "text",
    ["Hay 99 ensayos.", "PSI-99 llega a 12.6.", "Lo dice PSI-7.", "Según [2].", "El 50% se apagó."],
)
def test_invented_figures_ids_or_refs_are_not_grounded(text):
    assert not evidence().text_is_grounded(text)


def test_text_with_an_invented_figure_is_dropped():
    ui = composed({"type": "text", "body": "Hay 99 ensayos."}, {"type": "text", "body": "PSI-99 usa cotton."})
    assert [c["body"] for c in ui.data["components"]] == ["PSI-99 usa cotton."]


def test_summary_with_an_invented_figure_is_replaced_by_the_rules_summary():
    agents = FakeAgents(composer=[{"summary": "Hay 40 ensayos.", "components": [TABLE_OK]}])
    ui = ui_event(collect(run_query("q", agents, composer_mode="agent", timeouts=FAST)))
    assert ui.data["summary"] == "Comparación de los ensayos registrados en el Atlas."


def test_gap_map_with_only_invented_ids_uses_the_experiments_of_the_table():
    gap = {"type": "gap_map", "title": "M", "experiment_ids": ["PSI-1234"], "gravity_environment": None, "note": None}
    [gap_map] = composed(gap).data["components"]
    assert gap_map["experiment_ids"] == ["PSI-100", "PSI-99"]


def test_gap_map_without_any_experiment_says_so():
    gap = {"type": "gap_map", "title": "M", "experiment_ids": ["PSI-1234"], "gravity_environment": None, "note": None}
    agents = FakeAgents(analyst={"respuesta": None, "consultas": []}, researcher=None, composer=[ui_with(gap)])
    [gap_map] = ui_event(collect(run_query("q", agents, composer_mode="agent", timeouts=FAST))).data["components"]
    assert gap_map["experiment_ids"] == [] and gap_map["note"] == "Sin experimentos concretos para resaltar."


def test_rules_drop_agent_answers_with_invented_figures():
    analyst = {**ANALYST_OK, "respuesta": "Hay 7 ensayos."}
    ui = build_rules_ui(DEFAULT_CLASSIFICATION, analyst, RESEARCHER_OK)
    bodies = [c.body for c in ui.components if c.type == "text"]
    assert "Hay 7 ensayos." not in bodies and RESEARCHER_OK["respuesta"] in bodies
