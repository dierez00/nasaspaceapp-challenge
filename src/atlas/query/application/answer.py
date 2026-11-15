"""Answers one question as a stream of events: cache first, then the agents pipeline."""

import logging
import time
from collections.abc import AsyncIterator
from typing import Any, Protocol

from atlas.agents.application.run_query import Agents, ComposerMode, Timeouts, run_query
from atlas.agents.domain.events import STEP_CACHE, Event, status

log = logging.getLogger(__name__)

GENERIC_ERROR = "No se pudo responder la consulta. Inténtalo de nuevo."


class QueryCache(Protocol):
    def get(self, question: str) -> dict[str, Any] | None: ...

    def put(self, question: str, ui: dict[str, Any]) -> None: ...


async def answer(
    question: str,
    agents: Agents,
    *,
    composer_mode: ComposerMode,
    cache: QueryCache | None = None,
    timeouts: Timeouts = Timeouts(),
) -> AsyncIterator[Event]:
    started = time.monotonic()
    cached = cache.get(question) if cache else None
    if cached is not None:
        yield status(STEP_CACHE)
        yield Event("ui", {**cached, "ms": round((time.monotonic() - started) * 1000)})
        return

    try:
        async for event in run_query(question, agents, composer_mode=composer_mode, timeouts=timeouts):
            if event.name == "ui" and event.cacheable and cache is not None:
                try:
                    cache.put(question, event.data)
                except OSError:
                    log.exception("could not write the query cache")
            yield event
    except Exception:
        log.exception("query pipeline failed")
        yield Event("error", {"message": GENERIC_ERROR})
