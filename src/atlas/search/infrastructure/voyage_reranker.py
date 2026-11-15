import voyageai
from pydantic import SecretStr


class VoyageReranker:
    def __init__(self, api_key: SecretStr, model: str) -> None:
        self._client = voyageai.AsyncClient(api_key=api_key.get_secret_value(), max_retries=1)
        self._model = model

    async def rerank(self, query: str, documents: list[str], top_k: int) -> list[tuple[int, float]]:
        # No rate-limit waits here: this runs inside a request, so errors surface fast
        # and search_documents falls back to vector order.
        result = await self._client.rerank(query, documents, model=self._model, top_k=top_k)
        return [(r.index, r.relevance_score) for r in result.results]
