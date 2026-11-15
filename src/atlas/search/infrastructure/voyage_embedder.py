import asyncio

import voyageai
from pydantic import SecretStr
from voyageai.error import RateLimitError

MAX_TEXTS_PER_REQUEST = 64
# Conservative per-request budget (~3 chars per token) so the free tier's 10K TPM cap still fits.
MAX_CHARS_PER_REQUEST = 18_000
RATE_LIMIT_WAIT_SECONDS = 62
RATE_LIMIT_ATTEMPTS = 8


class VoyageEmbedder:
    def __init__(self, api_key: SecretStr, model: str, dimension: int = 1024) -> None:
        self._client = voyageai.AsyncClient(api_key=api_key.get_secret_value(), max_retries=1)
        self._model = model
        self._dimension = dimension

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for batch in _batches(texts):
            vectors += await self._embed(batch, "document")
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        # Interactive queries never enter the ingestion rate-limit retry loop.
        result = await self._client.embed(
            [text], model=self._model, input_type="query", output_dimension=self._dimension
        )
        return result.embeddings[0]

    async def _embed(self, texts: list[str], input_type: str) -> list[list[float]]:
        for attempt in range(1, RATE_LIMIT_ATTEMPTS + 1):
            try:
                result = await self._client.embed(
                    texts, model=self._model, input_type=input_type, output_dimension=self._dimension
                )
                return result.embeddings
            except RateLimitError:
                if attempt == RATE_LIMIT_ATTEMPTS:
                    raise
                await asyncio.sleep(RATE_LIMIT_WAIT_SECONDS)
        raise AssertionError("unreachable")


def _batches(texts: list[str]) -> list[list[str]]:
    batches: list[list[str]] = []
    current: list[str] = []
    size = 0
    for text in texts:
        if current and (len(current) >= MAX_TEXTS_PER_REQUEST or size + len(text) > MAX_CHARS_PER_REQUEST):
            batches.append(current)
            current, size = [], 0
        current.append(text)
        size += len(text)
    if current:
        batches.append(current)
    return batches
