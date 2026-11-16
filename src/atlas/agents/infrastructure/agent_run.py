"""Result and error types shared by every agent runner (Claude and Azure OpenAI)."""

from dataclasses import dataclass
from typing import Any


class AgentRunError(RuntimeError):
    pass


@dataclass(frozen=True)
class AgentRun:
    text: str | None
    structured: Any
    cost_usd: float | None
