"""In-process MCP server for the analyst, built from the provider-neutral spec in analyst_spec."""

from typing import Any

from claude_agent_sdk import McpSdkServerConfig, create_sdk_mcp_server

from atlas.agents.infrastructure.analyst_spec import TOOL_NAME, ExperimentLoader, build_analyst_spec
from atlas.agents.infrastructure.claude_tools import sdk_tool

SERVER_NAME = "analista"
ALLOWED_TOOLS = [f"mcp__{SERVER_NAME}__{TOOL_NAME}"]


def build_analyst_server(load: ExperimentLoader, log: list[dict[str, Any]]) -> McpSdkServerConfig:
    return create_sdk_mcp_server(name=SERVER_NAME, tools=[sdk_tool(build_analyst_spec(load, log))])
