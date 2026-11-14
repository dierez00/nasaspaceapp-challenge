from psycopg import AsyncConnection

from atlas.search.domain.chunk import Chunk, ChunkKey, SearchHit


def _vector_literal(values: list[float]) -> str:
    # pgvector text format; avoids needing the vector type registered on the connection.
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


class PostgresChunkRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def list_keys(self) -> set[ChunkKey]:
        cur = await self._conn.execute(
            "select experiment_id, source_file, content_hash from document_chunks where content_hash is not null"
        )
        return {(r["experiment_id"], r["source_file"], r["content_hash"]) for r in await cur.fetchall()}

    async def replace(self, new: list[tuple[Chunk, list[float]]], stale: set[ChunkKey]) -> None:
        async with self._conn.transaction():
            async with self._conn.cursor() as cur:
                await cur.executemany(
                    "delete from document_chunks where experiment_id = %s and source_file = %s and content_hash = %s",
                    list(stale),
                )
                await cur.executemany(
                    """
                    insert into document_chunks (experiment_id, source_file, section, content, content_hash, embedding)
                    values (%s, %s, %s, %s, %s, %s::vector)
                    on conflict (experiment_id, source_file, content_hash) do nothing
                    """,
                    [
                        (c.experiment_id, c.source_file, c.section, c.content, c.content_hash, _vector_literal(v))
                        for c, v in new
                    ],
                )
        await self._conn.commit()

    async def search(self, embedding: list[float], k: int) -> list[SearchHit]:
        cur = await self._conn.execute(
            """
            select experiment_id, source_file, section, content,
                   1 - (embedding <=> %s::vector) as score
            from document_chunks
            where embedding is not null
            order by embedding <=> %s::vector
            limit %s
            """,
            (_vector_literal(embedding), _vector_literal(embedding), k),
        )
        return [SearchHit(**row) for row in await cur.fetchall()]
