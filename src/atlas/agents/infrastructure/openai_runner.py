"""Runs one agent on an Azure OpenAI deployment with a Chat Completions tool loop and
returns the same AgentRun as the Claude runner. Tools are the provider-neutral ToolSpecs."""

import json
from collections.abc import Sequence
from typing import Any, Protocol

import openai

from atlas.agents.infrastructure.agent_run import AgentRun, AgentRunError
from atlas.agents.infrastructure.tool_spec import ToolSpec
from atlas.shared.config import Settings

TOOLS_REASONING_EFFORT = "none"

class ChatAgentRunner(Protocol):
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
        reasoning_effort: str | None = None,
    ) -> AgentRun: ...


def build_azure_client(settings: Settings) -> openai.AsyncOpenAI:
    """Callers check `settings.azure_openai_problems()` first. A base URL selects Azure's v1 API
    (no api-version); otherwise the classic endpoint + api-version client."""
    assert settings.azure_openai_api_key is not None
    api_key = settings.azure_openai_api_key.get_secret_value()
    if settings.azure_openai_base_url:
        return openai.AsyncOpenAI(base_url=settings.azure_openai_base_url, api_key=api_key)
    return openai.AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=api_key,
        api_version=settings.azure_openai_api_version,
    )


async def run_chat_agent(
    client: Any,
    *,
    model: str,
    system_prompt: str,
    prompt: str,
    max_turns: int,
    tools: Sequence[ToolSpec] = (),
    response_schema: tuple[str, dict[str, Any]] | None = None,
    reasoning_effort: str | None = None,
) -> AgentRun:
    """One completion per turn; tool calls are executed and answered until the model replies
    without any. `model` is the Azure deployment name. Tool calls on the last turn exhaust it."""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ]
    request: dict[str, Any] = {"model": model}
    if tools:
        request["tools"] = [_function_tool(spec) for spec in tools]
    if response_schema is not None:
        name, schema = response_schema
        request["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": name, "schema": schema, "strict": False},
        }
    # Reasoning deployments (gpt-6.1-sol) reason by default and reject function tools in
    # Chat Completions unless reasoning_effort is explicitly "none".
    effort = TOOLS_REASONING_EFFORT if tools else reasoning_effort
    if effort is not None:
        request["reasoning_effort"] = effort
    by_name = {spec.name: spec for spec in tools}

    for _ in range(max_turns):
        try:
            completion = await client.chat.completions.create(messages=messages, **request)
        except openai.OpenAIError as exc:
            raise AgentRunError(f"Azure OpenAI: {type(exc).__name__}: {exc}") from exc
        if not completion.choices:
            raise AgentRunError("Azure OpenAI no devolvió respuestas")
        message = completion.choices[0].message
        calls = [call for call in message.tool_calls or [] if call.type == "function"]
        if not calls:
            if not message.content:
                raise AgentRunError("el agente terminó sin respuesta")
            return AgentRun(message.content, None, None)
        messages.append(_assistant_message(message.content, calls))
        for call in calls:
            text = await _run_tool(by_name.get(call.function.name), call.function.name, call.function.arguments)
            messages.append({"role": "tool", "tool_call_id": call.id, "content": text})
    raise AgentRunError(f"el agente agotó los {max_turns} turnos")


def _function_tool(spec: ToolSpec) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {"name": spec.name, "description": spec.description, "parameters": spec.input_schema},
    }


def _assistant_message(content: str | None, calls: list[Any]) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": [
            {
                "id": call.id,
                "type": "function",
                "function": {"name": call.function.name, "arguments": call.function.arguments},
            }
            for call in calls
        ],
    }


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
