"""Provider-neutral tool definition: the same spec backs a Claude in-process MCP tool
and an OpenAI function tool, so both providers run identical tool code."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ToolResult:
    text: str
    is_error: bool = False


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Awaitable[ToolResult]]
