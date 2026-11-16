"""The analyst and researcher tools are provider-neutral specs; Claude MCP tools are built from them."""

import asyncio
import json
from pathlib import Path

from atlas.agents.infrastructure import analyst_spec, analyst_tools, researcher_spec, researcher_tools
from atlas.agents.infrastructure.claude_tools import sdk_tool
from atlas.agents.infrastructure.tool_spec import ToolResult, ToolSpec
from atlas.experiments.application.load_experiments import load_experiment_files

EXPERIMENTS = [r.experiment for r in load_experiment_files(Path(__file__).resolve().parents[1] / "data/experiments")]


def test_neutral_spec_modules_do_not_import_the_claude_sdk():
    for module in (analyst_spec, researcher_spec):
        assert "claude_agent_sdk" not in Path(module.__file__).read_text(encoding="utf-8")


def test_specs_keep_the_tool_names_the_claude_servers_allow():
    analyst = analyst_spec.build_analyst_spec(None, [])  # type: ignore[arg-type]
    researcher = researcher_spec.build_researcher_spec(None, [])  # type: ignore[arg-type]

    assert analyst.name == "consultar_ensayos" and analyst_tools.ALLOWED_TOOLS == ["mcp__analista__consultar_ensayos"]
    assert researcher.name == "buscar_documentos"
    assert researcher_tools.ALLOWED_TOOLS == ["mcp__investigador__buscar_documentos"]
    assert researcher.input_schema["required"] == ["consulta"]


def test_analyst_spec_returns_text_and_logs_the_query():
    async def load():
        return EXPERIMENTS

    log: list = []
    spec = analyst_spec.build_analyst_spec(load, log)

    ok = asyncio.run(spec.handler({"agrupar_por": ["experiment_id"]}))
    bad = asyncio.run(spec.handler({"sql": "drop table experiments"}))

    assert not ok.is_error and json.loads(ok.text)["columns"][0] == "experiment_id"
    assert bad.is_error and "Parámetros inválidos" in bad.text
    assert len(log) == 1


def test_claude_adapter_keeps_the_mcp_result_shape():
    async def handler(args):
        return ToolResult("falló", is_error=True) if args.get("fail") else ToolResult("listo")

    tool = sdk_tool(ToolSpec("demo", "Demo.", {"type": "object", "properties": {}}, handler))

    assert asyncio.run(tool.handler({})) == {"content": [{"type": "text", "text": "listo"}]}
    assert asyncio.run(tool.handler({"fail": True})) == {
        "content": [{"type": "text", "text": "falló"}],
        "is_error": True,
    }
