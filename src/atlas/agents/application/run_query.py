"""Orchestrator. Plain Python, not an LLM:

1. classify (short call, 4 s, default = run both agents)
2. analyst and researcher in parallel (12 s each; a failure becomes {"error": ...})
3. composer -> UIPayload validation; one retry with the error, then fixed rules
4. grounding: tables, citations, gap_map ids and every figure in the text must come
   from what the tools logged (or from the question)
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import ValidationError

from atlas.agents.domain.classification import DEFAULT_CLASSIFICATION, Classification
from atlas.agents.domain.events import (
    STEP_ANALYST,
    STEP_CLASSIFYING,
    STEP_COMPOSER,
    STEP_RESEARCHER,
    Event,
    status,
)
from atlas.agents.domain.grounding import AgentResult, Evidence, ground_ui
from atlas.agents.domain.ui import UIPayload
from atlas.agents.domain.ui_rules import build_rules_ui, rules_summary

log = logging.getLogger(__name__)

ComposerMode = Literal["agent", "rules"]
# Keeps the composer prompt small: long fragments are cut, long tables are capped.
PROMPT_TEXT_LIMIT = 1500
PROMPT_ROW_LIMIT = 30
VALIDATION_ERROR_LIMIT = 2000


class Agents(Protocol):
    async def classify(self, question: str) -> Classification: ...

    async def analyst(self, question: str, classification: Classification) -> dict[str, Any]: ...

    async def researcher(self, question: str, classification: Classification) -> dict[str, Any]: ...

    async def composer(self, prompt: str) -> Any: ...


@dataclass(frozen=True)
class Timeouts:
    classifier: float = 4.0
    agent: float = 12.0
    composer: float = 20.0


async def run_query(
    question: str,
    agents: Agents,
    *,
    composer_mode: ComposerMode = "agent",
    timeouts: Timeouts = Timeouts(),
) -> AsyncIterator[Event]:
    started = time.monotonic()

    yield status(STEP_CLASSIFYING)
    classification = await _classify(agents, question, timeouts.classifier)

    if classification.necesita_datos:
        yield status(STEP_ANALYST)
    if classification.necesita_fuentes:
        yield status(STEP_RESEARCHER)
    analyst, researcher = await asyncio.gather(
        _guarded("analista", lambda: agents.analyst(question, classification), timeouts.agent)
        if classification.necesita_datos
        else _skipped(),
        _guarded("investigador", lambda: agents.researcher(question, classification), timeouts.agent)
        if classification.necesita_fuentes
        else _skipped(),
    )

    yield status(STEP_COMPOSER)
    ui, composed_by = await _compose(agents, question, classification, analyst, researcher, composer_mode, timeouts)

    failed = any(result and result.get("error") for result in (analyst, researcher))
    yield Event(
        "ui",
        {**ui.model_dump(mode="json"), "ms": round((time.monotonic() - started) * 1000)},
        cacheable=composed_by == "agent" and not failed,
    )


async def _classify(agents: Agents, question: str, timeout: float) -> Classification:
    try:
        return await asyncio.wait_for(agents.classify(question), timeout)
    except Exception as exc:  # noqa: BLE001 - any failure falls back to running both agents
        log.warning("classifier failed, running both agents: %r", exc)
        return DEFAULT_CLASSIFICATION


async def _guarded(name: str, start: Callable[[], Awaitable[dict[str, Any]]], timeout: float) -> dict[str, Any]:
    try:
        return await asyncio.wait_for(start(), timeout)
    except TimeoutError:
        log.warning("%s timed out after %ss", name, timeout)
        return {"error": f"tiempo agotado ({timeout:g} s)"}
    except Exception as exc:  # noqa: BLE001 - the other agent and the composer keep going
        log.exception("%s failed", name)
        return {"error": f"{type(exc).__name__}: {str(exc)[:200]}"}


async def _skipped() -> None:
    return None


async def _compose(
    agents: Agents,
    question: str,
    classification: Classification,
    analyst: AgentResult,
    researcher: AgentResult,
    mode: ComposerMode,
    timeouts: Timeouts,
) -> tuple[UIPayload, Literal["agent", "rules"]]:
    if mode == "agent":
        base_prompt = build_composer_prompt(question, classification, analyst, researcher)
        prompt = base_prompt
        for attempt in (1, 2):
            try:
                raw = await asyncio.wait_for(agents.composer(prompt), timeouts.composer)
            except Exception as exc:  # noqa: BLE001 - no retry on timeouts or SDK errors
                log.warning("composer failed on attempt %s: %r", attempt, exc)
                break
            try:
                ui = UIPayload.model_validate(raw)
            except ValidationError as exc:
                log.warning("composer output invalid on attempt %s", attempt)
                prompt = (
                    f"{base_prompt}\n\n## Tu respuesta anterior no pasó la validación\n\n"
                    f"{str(exc)[:VALIDATION_ERROR_LIMIT]}\n\nCorrige esos campos y devuelve el objeto completo."
                )
                continue
            evidence = Evidence(question, analyst, researcher)
            grounded, fixes = ground_ui(ui, evidence, rules_summary(classification))
            if fixes:
                log.warning("composer output not grounded in the tools' data: %s", ", ".join(fixes))
            if grounded is None:
                break
            return grounded, "agent"
    return build_rules_ui(classification, analyst, researcher, question), "rules"


def build_composer_prompt(
    question: str, classification: Classification, analyst: AgentResult, researcher: AgentResult
) -> str:
    sections = [
        f"## Pregunta\n\n{question}",
        f"## Clasificación\n\n{classification.model_dump_json()}",
        f"## Analista\n\n{_json(_trim_analyst(analyst))}",
        f"## Investigador\n\n{_json(_trim_researcher(researcher))}",
    ]
    return "\n\n".join(sections)


def _trim_analyst(result: AgentResult) -> AgentResult:
    if not result or "consultas" not in result:
        return result
    queries = [{**q, "rows": q["rows"][:PROMPT_ROW_LIMIT]} for q in result["consultas"]]
    return {**result, "consultas": queries}


def _trim_researcher(result: AgentResult) -> AgentResult:
    if not result or "fuentes" not in result:
        return result
    sources = [{**s, "content": s["content"][:PROMPT_TEXT_LIMIT]} for s in result["fuentes"]]
    return {**result, "fuentes": sources}


def _json(value: Any) -> str:
    if value is None:
        return "No se ejecutó para esta pregunta."
    return f"```json\n{json.dumps(value, ensure_ascii=False, default=str)}\n```"
