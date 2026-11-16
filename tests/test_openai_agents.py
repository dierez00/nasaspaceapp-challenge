"""Azure OpenAI agents against a scripted fake client: no network, no real keys."""

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import openai
import pytest

from atlas.agents.application.openai_agents import OpenAIAgents
from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION
from atlas.agents.infrastructure.agent_run import AgentRunError
from atlas.agents.infrastructure.claude_runner import AgentRunError as ClaudeRunnerAgentRunError
from atlas.agents.infrastructure.openai_runner import build_azure_client
from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.main import create_app
from atlas.shared.config import Settings

OFFLINE_DB = "postgresql://nobody:x@127.0.0.1:1/none"
EXPERIMENTS = [r.experiment for r in load_experiment_files(Path(__file__).resolve().parents[1] / "data/experiments")]
AZURE = {
    "llm_provider": "azure_openai",
    "azure_openai_endpoint": "https://example.openai.azure.com",
    "azure_openai_api_key": "test-key",
    "azure_openai_api_version": "2024-10-21",
    "classifier_model": "gpt-mini-deployment",
    "agent_model": "gpt-deployment",
}


def settings(**overrides) -> Settings:
    return Settings(_env_file=None, database_url=OFFLINE_DB, **{**AZURE, **overrides})


def tool_call(name: str, arguments: Any, call_id: str = "call_1") -> SimpleNamespace:
    raw = arguments if isinstance(arguments, str) else json.dumps(arguments)
    return SimpleNamespace(id=call_id, type="function", function=SimpleNamespace(name=name, arguments=raw))


def completion(content: str | None = None, calls: list | None = None) -> SimpleNamespace:
    message = SimpleNamespace(content=content, tool_calls=calls or None)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeClient:
    """Replays scripted completions (or raises scripted errors) and records every request."""

    def __init__(self, *script: Any) -> None:
        self.script = list(script)
        self.requests: list[dict[str, Any]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs: Any) -> Any:
        self.requests.append({**kwargs, "messages": list(kwargs["messages"])})
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return step


async def _no_search(query: str, k: int) -> list[dict[str, Any]]:
    return [
        {"experiment_id": "PSI-1", "source_file": "a.pdf", "section": "s", "content": "texto", "score": 0.9, "rerank_score": None}
    ]


def agents(client: FakeClient, **overrides) -> OpenAIAgents:
    return OpenAIAgents(settings(**overrides), None, _no_search, client)  # type: ignore[arg-type]


def test_analyst_tool_round_trip_logs_queries(monkeypatch):
    async def load():
        return EXPERIMENTS

    monkeypatch.setattr("atlas.agents.application.openai_agents.load_from_postgres", lambda pool: load())
    client = FakeClient(
        completion(calls=[tool_call("consultar_ensayos", {"agrupar_por": ["experiment_id"]})]),
        completion("Hay ensayos."),
    )

    result = asyncio.run(agents(client).analyst("¿Qué hay?", DEFAULT_CLASSIFICATION))

    assert result["respuesta"] == "Hay ensayos."
    assert [q["filtros"] for q in result["consultas"]] == [{"agrupar_por": ["experiment_id"]}]
    first, second = client.requests
    assert first["model"] == "gpt-deployment"
    assert first["messages"][0]["role"] == "system" and first["messages"][1]["role"] == "user"
    assert first["tools"][0]["function"]["name"] == "consultar_ensayos"
    assert "response_format" not in first and "reasoning_effort" not in first
    assistant, tool = second["messages"][2:]
    assert assistant["tool_calls"][0]["id"] == "call_1"
    assert tool["role"] == "tool" and tool["tool_call_id"] == "call_1"
    assert json.loads(tool["content"])["columns"][0] == "experiment_id"


def test_researcher_round_trip_numbers_the_sources():
    client = FakeClient(
        completion(calls=[tool_call("buscar_documentos", {"consulta": "flame", "k": 3})]),
        completion("Ver [1]."),
    )

    result = asyncio.run(agents(client).researcher("q", DEFAULT_CLASSIFICATION))

    assert result["respuesta"] == "Ver [1]."
    assert [s["ref"] for s in result["fuentes"]] == [1]
    assert json.loads(client.requests[1]["messages"][-1]["content"])[0]["ref"] == 1


def test_direct_researcher_mode_skips_the_model():
    client = FakeClient()

    result = asyncio.run(agents(client, investigador_mode="direct").researcher("q", DEFAULT_CLASSIFICATION))

    assert client.requests == [] and result["respuesta"] is None
    assert result["fuentes"][0]["ref"] == 1


def test_exhausting_the_turns_raises():
    looping = [completion(calls=[tool_call("buscar_documentos", {"consulta": "x"}, f"c{i}")]) for i in range(4)]
    client = FakeClient(*looping)

    with pytest.raises(AgentRunError, match="agotó"):
        asyncio.run(agents(client).researcher("q", DEFAULT_CLASSIFICATION))

    assert len(client.requests) == 4  # RESEARCHER_MAX_TURNS


def test_classifier_parses_structured_output_in_one_turn():
    payload = {"tipo": "huecos", "necesita_datos": True, "necesita_fuentes": False}
    client = FakeClient(completion(json.dumps(payload)))

    classification = asyncio.run(agents(client, azure_openai_reasoning_effort="low").classify("¿huecos?"))

    assert classification.tipo == "huecos"
    request = client.requests[0]
    assert request["model"] == "gpt-mini-deployment" and request["reasoning_effort"] == "low"
    assert request["response_format"]["type"] == "json_schema"
    assert request["response_format"]["json_schema"]["name"] == "Classification"
    assert request["response_format"]["json_schema"]["strict"] is False
    assert "tools" not in request


def test_classifier_rejects_text_that_is_not_json():
    with pytest.raises(AgentRunError, match="JSON"):
        asyncio.run(agents(FakeClient(completion("no sé"))).classify("q"))


def test_composer_returns_the_parsed_payload():
    ui = {"summary": "Respuesta.", "components": []}
    client = FakeClient(completion(json.dumps(ui)))

    assert asyncio.run(agents(client).composer("prompt")) == ui
    assert client.requests[0]["response_format"]["json_schema"]["name"] == "UIPayload"
    assert "discriminator" not in json.dumps(client.requests[0]["response_format"])


@pytest.mark.parametrize(
    ("call", "expected"),
    [
        (tool_call("buscar_documentos", "{no es json"), "no son JSON"),
        (tool_call("buscar_documentos", "[1, 2]"), "objeto JSON"),
        (tool_call("otra_cosa", {}), "desconocida"),
    ],
)
def test_bad_tool_calls_go_back_to_the_model_as_text(call, expected):
    client = FakeClient(completion(calls=[call]), completion("Listo."))

    result = asyncio.run(agents(client).researcher("q", DEFAULT_CLASSIFICATION))

    assert result["respuesta"] == "Listo." and result["fuentes"] == []
    assert expected in client.requests[1]["messages"][-1]["content"]


def test_api_errors_become_agent_run_errors():
    client = FakeClient(openai.OpenAIError("boom"))

    with pytest.raises(AgentRunError, match="OpenAIError"):
        asyncio.run(agents(client).classify("q"))


def test_agent_run_error_is_still_importable_from_the_claude_runner():
    assert ClaudeRunnerAgentRunError is AgentRunError


# --- Configuration ------------------------------------------------------------


def test_provider_defaults_to_claude_and_needs_no_azure_variables():
    config = Settings(_env_file=None, database_url=OFFLINE_DB)

    assert config.llm_provider == "claude" and config.azure_openai_reasoning_effort is None


def test_azure_settings_come_from_env(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-10-21")
    monkeypatch.setenv("AZURE_OPENAI_REASONING_EFFORT", "medium")

    config = Settings(_env_file=None)

    assert config.llm_provider == "azure_openai" and config.azure_openai_reasoning_effort == "medium"
    assert config.azure_openai_api_key.get_secret_value() == "test-key"
    assert "test-key" not in repr(config)


def test_missing_azure_variables_are_named_without_values():
    config = settings(azure_openai_endpoint=None, azure_openai_api_key=None, azure_openai_api_version=None)

    assert config.azure_openai_problems() == [
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_API_VERSION",
    ]
    assert settings().azure_openai_problems() == []


def test_claude_model_names_are_not_azure_deployments():
    problems = settings(agent_model="claude-opus-5-5").azure_openai_problems()

    assert len(problems) == 1 and "CLASSIFIER_MODEL" in problems[0]


def test_startup_fails_fast_when_azure_is_not_configured():
    with pytest.raises(RuntimeError) as error:
        create_app(settings(azure_openai_api_key=None, agents_mock=False))

    assert "AZURE_OPENAI_API_KEY" in str(error.value) and "AZURE_OPENAI_ENDPOINT" not in str(error.value)


def test_startup_builds_the_azure_agents_and_mock_mode_wins():
    app = create_app(settings(agents_mock=False, query_cache_enabled=False))
    mocked = create_app(settings(agents_mock=True, azure_openai_api_key=None))

    assert isinstance(app.state.agents, OpenAIAgents)
    assert type(mocked.state.agents).__name__ == "MockAgents"


def test_azure_client_uses_the_configured_endpoint_and_version():
    client = build_azure_client(settings())

    assert str(client.base_url).startswith("https://example.openai.azure.com/")
    assert client._api_version == "2024-10-21"  # noqa: SLF001
