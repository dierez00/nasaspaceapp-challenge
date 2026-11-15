import asyncio

import voyageai
from pydantic import SecretStr
from voyageai.error import RateLimitError

from atlas.search.infrastructure.voyage_embedder import RATE_LIMIT_ATTEMPTS, RATE_LIMIT_WAIT_SECONDS


class VoyageReranker:
    def __init__(self, api_key: SecretStr, model: str) -> None:
        self._client = voyageai.AsyncClient(api_key=api_key.get_secret_value(), max_retries=1)
        self._model = model

    async def rerank(self, query: str, documents: list[str], top_k: int) -> list[tuple[int, float]]:
        for attempt in range(1, RATE_LIMIT_ATTEMPTS + 1):
            try:
                result = await self._client.rerank(query, documents, model=self._model, top_k=top_k)
                return [(r.index, r.relevance_score) for r in result.results]
            except RateLimitError:
                if attempt == RATE_LIMIT_ATTEMPTS:
                    raise
                await asyncio.sleep(RATE_LIMIT_WAIT_SECONDS)
        raise AssertionError("unreachable")
