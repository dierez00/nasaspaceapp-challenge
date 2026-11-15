"""One ClaudeAgentOptions factory per agent. Every agent runs isolated:
no built-in tools (tools=[]), no filesystem settings (setting_sources=[]),
no MCP servers but its own (strict_mcp_config) and only its tools allowed."""

from functools import cache
from pathlib import Path
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, McpSdkServerConfig

from atlas.agents.domain.classification import Classification
from atlas.agents.domain.ui import UIPayload
from atlas.agents.infrastructure import analyst_tools, researcher_tools
from atlas.shared.config import Settings

PROMPTS_DIR = Path(__file__).parent / "prompts"

ANALYST_MAX_TURNS = 6
RESEARCHER_MAX_TURNS = 4
# Structured output needs room for one retry inside the CLI.
COMPOSER_MAX_TURNS = 3


@cache
def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    return {"type": "json_schema", "schema": schema}


def _base(
    settings: Settings,
    *,
    prompt: str,
    model: str,
    max_turns: int,
    servers: dict[str, McpSdkServerConfig] | None = None,
    allowed_tools: list[str] | None = None,
    output_format: dict[str, Any] | None = None,
) -> ClaudeAgentOptions:
    env: dict[str, str] = {}
    if settings.claude_code_oauth_token is not None:
        env["CLAUDE_CODE_OAUTH_TOKEN"] = settings.claude_code_oauth_token.get_secret_value()
    return ClaudeAgentOptions(
        tools=[],
        setting_sources=[],
        strict_mcp_config=True,
        mcp_servers=dict(servers or {}),
        allowed_tools=list(allowed_tools or []),
        system_prompt=load_prompt(prompt),
        model=model,
        effort=settings.agent_effort,
        max_turns=max_turns,
        output_format=output_format,
        env=env,
    )


def classifier_options(settings: Settings) -> ClaudeAgentOptions:
    return _base(
        settings,
        prompt="classifier",
        model=settings.classifier_model,
        max_turns=1,
        output_format=_json_schema(Classification.model_json_schema()),
    )


def analyst_options(settings: Settings, server: McpSdkServerConfig) -> ClaudeAgentOptions:
    return _base(
        settings,
        prompt="analyst",
        model=settings.agent_model,
        max_turns=ANALYST_MAX_TURNS,
        servers={analyst_tools.SERVER_NAME: server},
        allowed_tools=analyst_tools.ALLOWED_TOOLS,
    )


def researcher_options(settings: Settings, server: McpSdkServerConfig) -> ClaudeAgentOptions:
    return _base(
        settings,
        prompt="researcher",
        model=settings.agent_model,
        max_turns=RESEARCHER_MAX_TURNS,
        servers={researcher_tools.SERVER_NAME: server},
        allowed_tools=researcher_tools.ALLOWED_TOOLS,
    )


def composer_options(settings: Settings) -> ClaudeAgentOptions:
    return _base(
        settings,
        prompt="composer",
        model=settings.agent_model,
        max_turns=COMPOSER_MAX_TURNS,
        output_format=_json_schema(UIPayload.model_json_schema()),
    )
