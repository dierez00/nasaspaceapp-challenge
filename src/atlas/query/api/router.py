"""POST /query (fetch) and GET /query?q= (EventSource), both streaming SSE.

Events: status {step} · ui {summary, components, ms} · error {message}.
"""

import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from atlas.agents.domain.events import Event
from atlas.agents.domain.lang import DEFAULT_LANG, Lang
from atlas.agents.application.run_query import Timeouts
from atlas.query.application.answer import answer

router = APIRouter(prefix="/query", tags=["query"])

MAX_QUESTION = 500
Question = Annotated[str, Field(min_length=1, max_length=MAX_QUESTION, pattern=r"\S")]


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: Question
    # Language of the text the user reads; Spanish by default for older clients.
    lang: Lang = DEFAULT_LANG


@router.post("", response_class=StreamingResponse)
async def post_query(body: QueryRequest, request: Request) -> StreamingResponse:
    return _stream(body.q, request, body.lang)


@router.get("", response_class=StreamingResponse)
async def get_query(
    request: Request,
    q: Annotated[str, Query(min_length=1, max_length=MAX_QUESTION, pattern=r"\S")],
    lang: Lang = DEFAULT_LANG,
) -> StreamingResponse:
    return _stream(q, request, lang)


def _stream(question: str, request: Request, lang: Lang = DEFAULT_LANG) -> StreamingResponse:
    state = request.app.state
    events = answer(
        question.strip(),
        state.agents,
        composer_mode=state.composer_mode,
        cache=state.query_cache,
        timeouts=Timeouts(agent=state.settings.agent_timeout_s),
        lang=lang,
    )
    return StreamingResponse(
        _sse(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _sse(events: AsyncIterator[Event]) -> AsyncIterator[str]:
    async for event in events:
        yield format_sse(event)


def format_sse(event: Event) -> str:
    return f"event: {event.name}\ndata: {json.dumps(event.data, ensure_ascii=False)}\n\n"
