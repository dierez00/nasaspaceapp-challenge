from typing import Protocol

from atlas.search.domain.chunk import Chunk, ChunkKey, SearchHit


class Embedder(Protocol):
    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...


class ChunkRepository(Protocol):
    async def list_keys(self) -> set[ChunkKey]: ...

    async def replace(
        self, new: list[tuple[Chunk, list[float]]], stale: set[ChunkKey]
    ) -> None:
        """Insert `new` and delete `stale` atomically."""

    async def search(self, embedding: list[float], k: int) -> list[SearchHit]: ...
