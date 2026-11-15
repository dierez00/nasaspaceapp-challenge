"""Adapter from the researcher to role 2's search: search_documents over
PostgresChunkRepository, with the optional Voyage reranker."""

from dataclasses import asdict
from typing import Any

from psycopg_pool import AsyncConnectionPool

from atlas.search.application.search_documents import DEFAULT_CANDIDATES, search_documents
from atlas.search.domain.ports import Embedder, Reranker
from atlas.search.infrastructure.postgres_chunk_repository import PooledChunkSearch


class DocumentSearch:
    def __init__(
        self,
        pool: AsyncConnectionPool,
        embedder: Embedder | None,
        reranker: Reranker | None = None,
        candidates: int = DEFAULT_CANDIDATES,
    ) -> None:
        self._pool = pool
        self._embedder = embedder
        self._reranker = reranker
        self._candidates = candidates

    async def __call__(self, query: str, k: int) -> list[dict[str, Any]]:
        """Hits as dicts: experiment_id, source_file, section, content, score, rerank_score.
        rerank_score is None when there is no reranker or it failed (vector order)."""
        if self._embedder is None:
            raise RuntimeError("VOYAGE_API_KEY no está configurada")
        hits = await search_documents(
            query,
            k,
            self._embedder,
            PooledChunkSearch(self._pool),
            reranker=self._reranker,
            candidates=self._candidates,
        )
        return [asdict(hit) for hit in hits]
