"""Pieces shared by the Claude and Azure OpenAI agents."""

import json
from typing import Any

from atlas.agents.domain.classification import Classification
from atlas.agents.infrastructure.agent_run import AgentRunError

DIRECT_SEARCH_K = 5


def with_kind(question: str, classification: Classification) -> str:
    return f"{question}\n\n(Tipo de consulta: {classification.tipo})"


def structured_output(structured: Any, text: str | None) -> Any:
    if structured is not None:
        return structured
    try:
        return json.loads(text or "")
    except json.JSONDecodeError as exc:
        raise AgentRunError("el agente no devolvió JSON estructurado") from exc
