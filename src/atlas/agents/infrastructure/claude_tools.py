"""Adapter: exposes a provider-neutral ToolSpec as a Claude in-process MCP tool."""

from typing import Any

from claude_agent_sdk import SdkMcpTool, tool

from atlas.agents.infrastructure.tool_spec import ToolSpec


def sdk_tool(spec: ToolSpec) -> SdkMcpTool[Any]:
    @tool(spec.name, spec.description, spec.input_schema)
    async def handler(args: dict[str, Any]) -> dict[str, Any]:
        result = await spec.handler(args)
        response: dict[str, Any] = {"content": [{"type": "text", "text": result.text}]}
        if result.is_error:
            response["is_error"] = True
        return response

    return handler
