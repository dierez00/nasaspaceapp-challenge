"""CLI: chunk the PSI data, embed only new chunks and sync them into Postgres."""

import asyncio
import sys
from dataclasses import dataclass

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from voyageai.error import VoyageError

from atlas.search.application.chunking import build_chunks
from atlas.search.domain.chunk import Chunk
from atlas.search.domain.ports import ChunkRepository, Embedder
from atlas.search.infrastructure.postgres_chunk_repository import PostgresChunkRepository
from atlas.search.infrastructure.voyage_embedder import VoyageEmbedder
from atlas.shared.config import get_settings
from atlas.shared.database import apply_schema


PERSIST_GROUP_SIZE = 16


@dataclass(frozen=True)
class IndexReport:
    new: int
    unchanged: int
    removed: int


async def index_chunks(chunks: list[Chunk], repository: ChunkRepository, embedder: Embedder) -> IndexReport:
    existing = await repository.list_keys()
    current = {c.key for c in chunks}
    to_embed = [c for c in chunks if c.key not in existing]
    stale = existing - current

    # Persist group by group so an interrupted run keeps its progress and the next one resumes.
    for start in range(0, len(to_embed), PERSIST_GROUP_SIZE):
        group = to_embed[start : start + PERSIST_GROUP_SIZE]
        vectors = await embedder.embed_documents([c.content for c in group])
        await repository.replace(list(zip(group, vectors, strict=True)), set())
    if stale:
        await repository.replace([], stale)

    return IndexReport(new=len(to_embed), unchanged=len(chunks) - len(to_embed), removed=len(stale))


async def _run() -> int:
    settings = get_settings()
    if settings.voyage_api_key is None or not settings.voyage_api_key.get_secret_value():
        print("ERROR: VOYAGE_API_KEY is not set (put it in .env or the environment).")
        return 1
    chunks = build_chunks(settings.data_dir)
    embedder = VoyageEmbedder(settings.voyage_api_key, settings.embedding_model, settings.embedding_dimension)

    async with await AsyncConnection.connect(settings.database_url, row_factory=dict_row) as conn:
        await apply_schema(conn)
        await conn.commit()
        try:
            report = await index_chunks(chunks, PostgresChunkRepository(conn), embedder)
        except VoyageError as exc:
            # Message only: never echo request headers or the key.
            print(f"ERROR: Voyage request failed ({type(exc).__name__}): {str(exc)[:300]}")
            print("Progress is saved; run atlas-index again to continue.")
            return 1

    print(f"{report.new} new, {report.unchanged} unchanged, {report.removed} removed ({len(chunks)} chunks)")
    return 0


def main() -> None:
    sys.exit(asyncio.run(_run()))


if __name__ == "__main__":
    main()
