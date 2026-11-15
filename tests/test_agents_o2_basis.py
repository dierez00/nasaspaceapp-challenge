"""o2_basis in the analyst: PSI-159 burner O2 must never pass for an atmosphere."""

import asyncio
import json
from pathlib import Path

from atlas.agents.application.mock_agents import MockAgents
from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION
from atlas.agents.domain.ensayos import COLUMNS, FiltroEnsayos, consultar
from atlas.agents.domain.ui_rules import build_rules_ui
from atlas.agents.infrastructure import analyst_tools
from atlas.experiments.application.load_experiments import load_experiment_files

DATA = Path(__file__).resolve().parents[1] / "data"
EXPERIMENTS = [r.experiment for r in load_experiment_files(DATA / "experiments")]
TOTAL_TESTS = sum(len(e.tests) for e in EXPERIMENTS)


def basis_of(result: dict) -> set[str]:
    index = result["columns"].index("o2_basis")
    return {row[index] for row in result["rows"]}


def test_fixture_has_both_bases():
    assert {t.o2_basis for e in EXPERIMENTS for t in e.tests} == {"ambient", "oxidizer_stream"}


def test_rows_expose_o2_basis():
    result = consultar(EXPERIMENTS, FiltroEnsayos())

    assert "o2_basis" in COLUMNS and "o2_basis" in result["columns"]


def test_o2_range_without_basis_excludes_oxidizer_stream():
    result = consultar(EXPERIMENTS, FiltroEnsayos(o2_min=0, o2_max=100))

    assert basis_of(result) == {"ambient"}
    assert result["o2_basis"]["aplicado"] == ["ambient"]
    assert result["o2_basis"]["por_defecto"] is True
    assert result["o2_basis"]["ensayos"]["oxidizer_stream"] == 0
    assert result["total"] < TOTAL_TESTS


def test_pressure_range_without_basis_is_also_atmospheric():
    result = consultar(EXPERIMENTS, FiltroEnsayos(presion_min_kpa=0))

    assert result["o2_basis"]["ensayos"]["oxidizer_stream"] == 0


def test_explicit_basis_overrides_the_default_and_is_not_marked_default():
    result = consultar(EXPERIMENTS, FiltroEnsayos(o2_min=0, o2_basis=["oxidizer_stream"]))

    assert basis_of(result) == {"oxidizer_stream"}
    assert result["o2_basis"]["por_defecto"] is False


def test_without_ranges_nothing_is_dropped():
    everything = consultar(EXPERIMENTS, FiltroEnsayos())

    assert everything["o2_basis"]["aplicado"] is None
    assert everything["total"] == TOTAL_TESTS


def test_grouping_by_o2_basis_separates_the_bases():
    result = consultar(EXPERIMENTS, FiltroEnsayos(agrupar_por=["o2_basis"], metricas=["o2_percent"]))

    assert result["columns"][0] == "o2_basis"
    assert [row[0] for row in result["rows"]] == ["ambient", "oxidizer_stream"]
    assert sum(row[1] for row in result["rows"]) == TOTAL_TESTS
    assert "advertencia" not in result["o2_basis"]


def test_mixing_bases_in_an_o2_metric_warns():
    result = consultar(EXPERIMENTS, FiltroEnsayos(metricas=["o2_percent"]))

    assert "oxidizer_stream" in result["o2_basis"]["advertencia"]


def test_schema_exposes_the_field():
    schema = FiltroEnsayos.model_json_schema()

    assert "o2_basis" in schema["properties"]
    assert "o2_basis" in json.dumps(schema["properties"]["agrupar_por"])
    assert FiltroEnsayos.model_validate({"o2_basis": ["ambient"]}).o2_basis == ["ambient"]


def test_tool_output_shows_the_basis_and_logs_it(monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(analyst_tools, "create_sdk_mcp_server", lambda name, tools: captured.setdefault("tool", tools[0]))
    log: list = []

    async def load():
        return EXPERIMENTS

    analyst_tools.build_analyst_server(load, log)
    result = asyncio.run(captured["tool"].handler({"o2_min": 21}))
    payload = json.loads(result["content"][0]["text"])

    assert payload["o2_basis"]["aplicado"] == ["ambient"]
    assert log[0]["filtros"] == {"o2_min": 21.0} and log[0]["o2_basis"] == payload["o2_basis"]


def test_mock_analyst_rows_carry_the_basis():
    result = asyncio.run(MockAgents(DATA).analyst("q", DEFAULT_CLASSIFICATION))
    query = result["consultas"][0]

    assert query["o2_basis"]["ensayos"]["oxidizer_stream"] > 0  # the mock lists everything, labelled
    assert query["o2_basis"]["aplicado"] is None


def test_rules_ui_warns_when_the_table_holds_burner_oxygen():
    analyst = asyncio.run(MockAgents(DATA).analyst("q", DEFAULT_CLASSIFICATION))
    analyst["consultas"][0]["o2_basis"]["advertencia"] = "mezcla"

    ui = build_rules_ui(DEFAULT_CLASSIFICATION, analyst, None)

    assert any(c.type == "notice" and "PSI-159" in c.message for c in ui.components)


def test_rules_ui_says_when_ranges_were_limited_to_ambient():
    result = consultar(EXPERIMENTS, FiltroEnsayos(o2_min=0, agrupar_por=["experiment_id"]))
    analyst = {"respuesta": None, "consultas": [{"filtros": {"o2_min": 0}, **result}]}

    ui = build_rules_ui(DEFAULT_CLASSIFICATION, analyst, None)

    assert any(c.type == "notice" and "ambient" in c.message for c in ui.components)
