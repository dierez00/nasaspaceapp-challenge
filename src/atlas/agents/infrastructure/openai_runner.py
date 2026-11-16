"""Runs one agent on an Azure OpenAI deployment with a Responses API tool loop and
returns the same AgentRun as the Claude runner. Tools are the provider-neutral ToolSpecs."""

import json
from collections.abc import Sequence
from typing import Any, Protocol

import openai

from atlas.agents.infrastructure.agent_run import AgentRun, AgentRunError
from atlas.agents.infrastructure.tool_spec import ToolSpec
from atlas.shared.config import Settings

# The SDK retries 429 and 5xx with exponential backoff (and Retry-After); the query timeouts bound the total.
MAX_RETRIES = 3


class ResponsesAgentRunner(Protocol):
    async def __call__(
        self,
        client: Any,
        *,
        model: str,
        system_prompt: str,
        prompt: str,
        max_turns: int,
        tools: Sequence[ToolSpec] = (),
        response_schema: tuple[str, dict[str, Any]] | None = None,
        reasoning_effort: str,
    ) -> AgentRun: ...


def build_azure_client(settings: Settings) -> openai.AsyncOpenAI:
    """Callers check `settings.azure_openai_problems()` first. A base URL selects Azure's v1 API
    (no api-version); otherwise the classic endpoint + api-version client."""
    assert settings.azure_openai_api_key is not None
    api_key = settings.azure_openai_api_key.get_secret_value()
    if settings.azure_openai_base_url:
        return openai.AsyncOpenAI(base_url=settings.azure_openai_base_url, api_key=api_key, max_retries=MAX_RETRIES)
    return openai.AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=api_key,
        api_version=settings.azure_openai_api_version,
        max_retries=MAX_RETRIES,
    )


async def run_responses_agent(
    client: Any,
    *,
    model: str,
    system_prompt: str,
    prompt: str,
    max_turns: int,
    reasoning_effort: str,
    tools: Sequence[ToolSpec] = (),
    response_schema: tuple[str, dict[str, Any]] | None = None,
) -> AgentRun:
    """One response per turn; function calls are executed and answered until the model replies
    without any. `model` is the Azure deployment name. Tool calls on the last turn exhaust it.
    Stateless: nothing is stored server-side, so every request resends the whole conversation,
    including the encrypted reasoning items the model needs to continue after a tool call."""
    items: list[Any] = [{"role": "user", "content": prompt}]
    request: dict[str, Any] = {
        "model": model,
        "instructions": system_prompt,
        "reasoning": {"effort": reasoning_effort},
        "store": False,
        "include": ["reasoning.encrypted_content"],
    }
    if tools:
        request["tools"] = [_function_tool(spec) for spec in tools]
    if response_schema is not None:
        name, schema = response_schema
        request["text"] = {"format": {"type": "json_schema", "name": name, "schema": schema, "strict": False}}
    by_name = {spec.name: spec for spec in tools}

    for _ in range(max_turns):
        try:
            response = await client.responses.create(input=items, **request)
        except openai.OpenAIError as exc:
            raise AgentRunError(f"Azure OpenAI: {type(exc).__name__}: {exc}") from exc
        _check_status(response)
        calls = [item for item in response.output if item.type == "function_call"]
        if not calls:
            if not response.output_text:
                raise AgentRunError("el agente terminó sin respuesta")
            return AgentRun(response.output_text, None, None)
        items.extend(_to_input(item) for item in response.output)
        for call in calls:
            text = await _run_tool(by_name.get(call.name), call.name, call.arguments)
            items.append({"type": "function_call_output", "call_id": call.call_id, "output": text})
    raise AgentRunError(f"el agente agotó los {max_turns} turnos")


def _check_status(response: Any) -> None:
    if response.error is not None:
        raise AgentRunError(f"Azure OpenAI: {response.error.message}")
    if response.status in ("failed", "incomplete", "cancelled"):
        details = response.incomplete_details
        reason = details.reason if details is not None else None
        raise AgentRunError(f"Azure OpenAI: respuesta {response.status}" + (f" ({reason})" if reason else ""))


def _to_input(item: Any) -> Any:
    return item.model_dump(exclude_none=True) if hasattr(item, "model_dump") else item


def _function_tool(spec: ToolSpec) -> dict[str, Any]:
    return {"type": "function", "name": spec.name, "description": spec.description, "parameters": spec.input_schema}


async def _run_tool(spec: ToolSpec | None, name: str, raw_arguments: str | None) -> str:
    """Anything wrong with the call goes back to the model as text, like the Claude tools do."""
    if spec is None:
        return f"Herramienta desconocida: {name}"
    try:
        arguments = json.loads(raw_arguments or "{}")
    except json.JSONDecodeError:
        return "Argumentos inválidos: no son JSON."
    if not isinstance(arguments, dict):
        return "Argumentos inválidos: se esperaba un objeto JSON."
    return (await spec.handler(arguments)).text
