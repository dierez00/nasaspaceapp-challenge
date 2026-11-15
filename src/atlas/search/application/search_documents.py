import logging
from dataclasses import replace

from atlas.search.domain.chunk import SearchHit
from atlas.search.domain.ports import ChunkRepository, Embedder, Reranker

logger = logging.getLogger(__name__)

DEFAULT_CANDIDATES = 30


async def search_documents(
    query: str,
    k: int,
    embedder: Embedder,
    repository: ChunkRepository,
    reranker: Reranker | None = None,
    candidates: int = DEFAULT_CANDIDATES,
) -> list[SearchHit]:
    """Top `k` hits by vector similarity, reordered by `reranker` when one is given and working."""
    embedding = await embedder.embed_query(query)
    if reranker is None:
        return await repository.search(embedding, k)

    pool = await repository.search(embedding, max(candidates, k))
    if len(pool) <= 1:
        return pool[:k]
    try:
        ranked = await reranker.rerank(query, [hit.content for hit in pool], k)
        return [replace(pool[index], rerank_score=score) for index, score in ranked[:k]]
    except Exception as exc:
        # Only the error type is logged: provider messages could echo request details.
        logger.warning("Reranking failed (%s); returning vector-similarity order", type(exc).__name__)
        return pool[:k]
