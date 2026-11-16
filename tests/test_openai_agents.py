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


class Item(SimpleNamespace):
    """Response output item with the one SDK method the runner relies on."""

    def model_dump(self, exclude_none: bool = False) -> dict[str, Any]:
        return {k: v for k, v in vars(self).items() if v is not None or not exclude_none}


def tool_call(name: str, arguments: Any, call_id: str = "call_1") -> Item:
    raw = arguments if isinstance(arguments, str) else json.dumps(arguments)
    return Item(type="function_call", call_id=call_id, name=name, arguments=raw)


def reasoning(item_id: str = "rs_1") -> Item:
    return Item(type="reasoning", id=item_id, encrypted_content="opaque", summary=[])


def completion(
    text: str | None = None, calls: list | None = None, status: str = "completed", error: Any = None, reason: Any = None
) -> SimpleNamespace:
    return SimpleNamespace(
        output=[reasoning(), *(calls or [])],
        output_text=text or "",
        status=status,
        error=error,
        incomplete_details=SimpleNamespace(reason=reason) if reason else None,
    )


class FakeClient:
    """Replays scripted responses (or raises scripted errors) and records every request."""

    def __init__(self, *script: Any) -> None:
        self.script = list(script)
        self.requests: list[dict[str, Any]] = []
        self.responses = SimpleNamespace(create=self._create)

    async def _create(self, **kwargs: Any) -> Any:
        self.requests.append({**kwargs, "input": list(kwargs["input"])})
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
    assert first["instructions"] and first["input"] == [{"role": "user", "content": "¿Qué hay?\n\n(Tipo de consulta: general)"}]
    assert first["tools"][0]["type"] == "function" and first["tools"][0]["name"] == "consultar_ensayos"
    assert "text" not in first and first["reasoning"] == {"effort": "low"}
    assert first["store"] is False and first["include"] == ["reasoning.encrypted_content"]
    _, reasoning_item, call, output = second["input"]
    assert reasoning_item["type"] == "reasoning" and reasoning_item["encrypted_content"] == "opaque"
    assert call["type"] == "function_call" and call["call_id"] == "call_1"
    assert output["type"] == "function_call_output" and output["call_id"] == "call_1"
    assert json.loads(output["output"])["columns"][0] == "experiment_id"


def test_researcher_round_trip_numbers_the_sources():
    client = FakeClient(
        completion(calls=[tool_call("buscar_documentos", {"consulta": "flame", "k": 3})]),
        completion("Ver [1]."),
    )

    result = asyncio.run(agents(client).researcher("q", DEFAULT_CLASSIFICATION))

    assert result["respuesta"] == "Ver [1]."
    assert [s["ref"] for s in result["fuentes"]] == [1]
    assert json.loads(client.requests[1]["input"][-1]["output"])[0]["ref"] == 1


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
    assert request["model"] == "gpt-mini-deployment" and request["reasoning"] == {"effort": "low"}
    fmt = request["text"]["format"]
    assert fmt["type"] == "json_schema" and fmt["name"] == "Classification" and fmt["strict"] is False
    assert "tools" not in request


def test_classifier_rejects_text_that_is_not_json():
    with pytest.raises(AgentRunError, match="JSON"):
        asyncio.run(agents(FakeClient(completion("no sé"))).classify("q"))


def test_composer_returns_the_parsed_payload():
    ui = {"summary": "Respuesta.", "components": []}
    client = FakeClient(completion(json.dumps(ui)))

    assert asyncio.run(agents(client).composer("prompt")) == ui
    assert client.requests[0]["text"]["format"]["name"] == "UIPayload"
    assert "discriminator" not in json.dumps(client.requests[0]["text"])


def test_reasoning_effort_per_agent_and_override():
    payload = json.dumps({"tipo": "huecos", "necesita_datos": True, "necesita_fuentes": False})
    ui = json.dumps({"summary": "x", "components": []})
    client = FakeClient(completion(payload), completion(ui))
    default = agents(client, agent_effort="medium")

    asyncio.run(default.classify("q"))
    asyncio.run(default.composer("p"))
    overridden = FakeClient(completion(payload), completion(ui))
    forced = agents(overridden, agent_effort="medium", azure_openai_reasoning_effort="minimal")
    asyncio.run(forced.classify("q"))
    asyncio.run(forced.composer("p"))

    assert [r["reasoning"]["effort"] for r in client.requests] == ["low", "medium"]
    assert [r["reasoning"]["effort"] for r in overridden.requests] == ["minimal", "minimal"]


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (completion(status="incomplete", reason="max_output_tokens"), "incomplete.*max_output_tokens"),
        (completion(status="failed", error=SimpleNamespace(message="server_error")), "server_error"),
        (completion(status="failed"), "failed"),
        (completion(), "sin respuesta"),
    ],
)
def test_unusable_responses_raise(response, expected):
    with pytest.raises(AgentRunError, match=expected):
        asyncio.run(agents(FakeClient(response)).composer("p"))


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
    assert expected in client.requests[1]["input"][-1]["output"]


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

    assert config.azure_openai_problems()[:3] == [
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_VERSION",
    ]
    assert settings().azure_openai_problems() == []


def test_base_url_needs_only_the_key_and_a_deployment():
    config = settings(
        azure_openai_base_url="https://example.openai.azure.com/openai/v1/",
        azure_openai_endpoint=None,
        azure_openai_api_version=None,
        azure_openai_deployment="gpt-deployment",
        classifier_model="claude-haiku-5-5",
        agent_model="claude-opus-5-5",
    )

    assert config.azure_openai_problems() == []
    assert settings(azure_openai_base_url="https://x/openai/v1/", azure_openai_api_key=None).azure_openai_problems() == [
        "AZURE_OPENAI_API_KEY"
    ]


def test_without_base_url_the_endpoint_and_version_are_required_and_named():
    problems = settings(azure_openai_endpoint=None, azure_openai_api_version=None).azure_openai_problems()

    assert problems[:2] == ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_VERSION"]
    assert "AZURE_OPENAI_BASE_URL" in problems[2] and "test-key" not in " ".join(problems)


def test_deployment_replaces_claude_defaults_but_not_explicit_names():
    default = Settings(_env_file=None, azure_openai_deployment="gpt-deployment")
    explicit = settings(azure_openai_deployment="gpt-deployment", classifier_model="gpt-mini-deployment")

    assert (default.azure_classifier_deployment(), default.azure_agent_deployment()) == ("gpt-deployment",) * 2
    assert explicit.azure_classifier_deployment() == "gpt-mini-deployment"
    assert explicit.azure_agent_deployment() == "gpt-deployment"


def test_agents_send_the_deployment_fallback_as_the_model():
    config = Settings(_env_file=None, database_url=OFFLINE_DB, **{**AZURE, "azure_openai_deployment": "gpt-d"})
    config = config.model_copy(update={"classifier_model": "claude-haiku-5-5", "agent_model": "claude-opus-5-5"})
    payload = {"tipo": "huecos", "necesita_datos": True, "necesita_fuentes": False}
    client = FakeClient(completion(json.dumps(payload)), completion(json.dumps({"summary": "x", "components": []})))
    openai_agents = OpenAIAgents(config, None, _no_search, client)  # type: ignore[arg-type]

    asyncio.run(openai_agents.classify("q"))
    asyncio.run(openai_agents.composer("p"))

    assert [r["model"] for r in client.requests] == ["gpt-d", "gpt-d"]


def test_base_url_builds_the_v1_client_without_an_api_version():
    config = settings(
        azure_openai_base_url="https://example.openai.azure.com/openai/v1/", azure_openai_api_version=None
    )

    client = build_azure_client(config)

    assert type(client) is openai.AsyncOpenAI
    assert str(client.base_url) == "https://example.openai.azure.com/openai/v1/"


def test_claude_model_names_are_not_azure_deployments():
    problems = settings(agent_model="claude-opus-5-5").azure_openai_problems()

    assert len(problems) == 1 and "AZURE_OPENAI_DEPLOYMENT" in problems[0]


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

    assert isinstance(client, openai.AsyncAzureOpenAI)
    assert str(client.base_url).startswith("https://example.openai.azure.com/")
    assert client._api_version == "2024-10-21"  # noqa: SLF001


def test_clients_retry_rate_limits_a_bounded_number_of_times():
    legacy = build_azure_client(settings())
    v1 = build_azure_client(settings(azure_openai_base_url="https://example.openai.azure.com/openai/v1/"))

    assert legacy.max_retries == v1.max_retries == 3


def test_high_effort_values_are_accepted_and_sent():
    assert settings(azure_openai_reasoning_effort="xhigh").azure_openai_reasoning_effort == "xhigh"
    client = FakeClient(completion(json.dumps({"tipo": "huecos", "necesita_datos": True, "necesita_fuentes": False})))

    asyncio.run(agents(client, azure_openai_reasoning_effort="max").classify("q"))

    assert client.requests[0]["reasoning"] == {"effort": "max"}


def test_agent_timeout_is_configurable_and_reaches_the_pipeline(monkeypatch):
    import atlas.query.api.router as router_module
    from fastapi.testclient import TestClient

    seen = []

    async def fake_answer(question, agents, **kwargs):
        seen.append(kwargs["timeouts"])
        return
        yield

    monkeypatch.setattr(router_module, "answer", fake_answer)
    assert settings().agent_timeout_s == 20.0
    for config, expected in ((settings(), 20.0), (settings(agent_timeout_s=40), 40.0)):
        with TestClient(create_app(settings=config.model_copy(update={"agents_mock": True}))) as client:
            client.post("/query", json={"q": "q"})

    assert [t.agent for t in seen] == [20.0, 40.0]
    with pytest.raises(ValueError):
        settings(agent_timeout_s=0)
