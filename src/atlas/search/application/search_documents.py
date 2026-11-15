import asyncio
import logging
from dataclasses import replace

from atlas.search.domain.chunk import SearchHit
from atlas.search.domain.ports import ChunkSearch, Embedder, Reranker

logger = logging.getLogger(__name__)

DEFAULT_CANDIDATES = 30
# Interactive provider budget: at most six seconds, excluding SQL acquisition/query.
QUERY_EMBED_TIMEOUT_SECONDS = 4
RERANK_TIMEOUT_SECONDS = 2


class SearchUnavailable(RuntimeError):
    """An interactive embedding request failed; no provider details escape."""


async def search_documents(
    query: str,
    k: int,
    embedder: Embedder,
    repository: ChunkSearch,
    reranker: Reranker | None = None,
    candidates: int = DEFAULT_CANDIDATES,
) -> list[SearchHit]:
    """Top `k` hits by vector similarity, reordered by `reranker` when one is given and working."""
    try:
        async with asyncio.timeout(QUERY_EMBED_TIMEOUT_SECONDS):
            embedding = await embedder.embed_query(query)
    except Exception as exc:
        logger.warning("Query embedding failed (%s)", type(exc).__name__)
        raise SearchUnavailable("Search embedding is temporarily unavailable") from None
    if reranker is None:
        return await repository.search(embedding, k)

    pool = await repository.search(embedding, max(candidates, k))
    if len(pool) <= 1:
        return pool[:k]
    try:
        async with asyncio.timeout(RERANK_TIMEOUT_SECONDS):
            ranked = await reranker.rerank(query, [hit.content for hit in pool], k)
        return [replace(pool[index], rerank_score=score) for index, score in ranked[:k]]
    except Exception as exc:
        # Only the error type is logged: provider messages could echo request details.
        logger.warning("Reranking failed (%s); returning vector-similarity order", type(exc).__name__)
        return pool[:k]
