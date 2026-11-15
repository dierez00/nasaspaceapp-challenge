from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from atlas.search.application.search_documents import SearchUnavailable, search_documents
from atlas.search.domain.ports import Embedder
from atlas.search.infrastructure.postgres_chunk_repository import PooledChunkSearch

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    k: int = Field(default=5, ge=1, le=20)
    rerank: bool = True


class SearchResult(BaseModel):
    experiment_id: str
    source_file: str
    section: str | None
    content: str
    score: float
    rerank_score: float | None = None


def get_embedder(request: Request) -> Embedder:
    embedder = request.app.state.embedder
    if embedder is None:
        raise HTTPException(status_code=503, detail="Search is unavailable: VOYAGE_API_KEY is not configured")
    return embedder


@router.post("", response_model=list[SearchResult])
async def search(
    body: SearchRequest,
    embedder: Annotated[Embedder, Depends(get_embedder)],
    request: Request,
) -> list[SearchResult]:
    try:
        hits = await search_documents(
            body.query,
            body.k,
            embedder,
            PooledChunkSearch(request.app.state.pool),
            reranker=request.app.state.reranker if body.rerank else None,
            candidates=request.app.state.rerank_candidates,
        )
    except SearchUnavailable:
        raise HTTPException(status_code=503, detail="Search is temporarily unavailable") from None
    return [SearchResult(**vars(h)) for h in hits]
