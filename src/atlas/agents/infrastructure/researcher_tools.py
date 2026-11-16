"""In-process MCP server for the researcher, built from the provider-neutral spec in researcher_spec."""

from typing import Any

from claude_agent_sdk import McpSdkServerConfig, create_sdk_mcp_server

from atlas.agents.infrastructure.claude_tools import sdk_tool
from atlas.agents.infrastructure.researcher_spec import (  # noqa: F401 - re-exported for existing imports
    EXCERPT_CHARS,
    MAX_K,
    TOOL_NAME,
    SearchFn,
    add_refs,
    build_researcher_spec,
)

SERVER_NAME = "investigador"
ALLOWED_TOOLS = [f"mcp__{SERVER_NAME}__{TOOL_NAME}"]


def build_researcher_server(search: SearchFn, log: list[dict[str, Any]]) -> McpSdkServerConfig:
    return create_sdk_mcp_server(name=SERVER_NAME, tools=[sdk_tool(build_researcher_spec(search, log))])
