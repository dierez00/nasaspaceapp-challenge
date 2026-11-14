import asyncio
import hashlib
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from atlas.main import create_app
from atlas.search.application.chunking import build_chunks, search_source_chunks
from atlas.search.application.index_documents import index_chunks
from atlas.search.domain.chunk import Chunk, SearchHit
from atlas.search.infrastructure.postgres_chunk_repository import PostgresChunkRepository
from atlas.shared.config import Settings
from atlas.shared.database import apply_schema

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATABASE_URL = os.environ.get("ATLAS_TEST_DATABASE_URL")
DIMENSION = 1024


class FakeEmbedder:
    """Deterministic, offline: a text always maps to the same unit-ish vector."""

    def __init__(self) -> None:
        self.embedded: list[str] = []

    def _vector(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode()).digest()
        return [digest[i % len(digest)] / 255 + 0.01 for i in range(DIMENSION)]

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.embedded += texts
        return [self._vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


class MemoryRepository:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str, str], Chunk] = {}

    async def list_keys(self):
        return set(self.rows)

    async def replace(self, new, stale):
        for key in stale:
            del self.rows[key]
        for chunk, _ in new:
            self.rows[chunk.key] = chunk

    async def search(self, embedding, k):
        return []


def test_chunks_cover_every_source_type_with_citations():
    chunks = build_chunks(DATA_DIR)
    by_psi = {c.experiment_id for c in chunks}

    assert {"PSI-25", "PSI-26", "PSI-99", "PSI-107"} <= by_psi
    assert all(c.source_file and c.section and c.content for c in chunks)
    assert any(c.source_file.endswith(".csv") and c.section.startswith("rows ") for c in chunks)
    assert any(c.experiment_id == "PSI-107" and c.source_file == "sources.json" for c in chunks)
    assert any(c.section == "overview" and c.experiment_id == "PSI-99" for c in chunks)
    assert len({c.key for c in chunks}) == len(chunks)


def test_search_only_source_yields_overview_and_publications():
    payload = {
        "sources": [
            {
                "id": "PSI-1",
                "title": "T",
                "acronym": None,
                "doi": None,
                "source_url": "https://example.test",
                "reason": "r",
                "topics": ["soot"],
                "publications": [{"title": "P", "doi": None}],
            }
        ]
    }

    assert [c.section for c in search_source_chunks(payload)] == ["overview", "publications"]


def test_second_index_run_embeds_nothing_and_changes_remove_stale_chunks():
    chunks = build_chunks(DATA_DIR)
    repository, embedder = MemoryRepository(), FakeEmbedder()

    first = asyncio.run(index_chunks(chunks, repository, embedder))
    second = asyncio.run(index_chunks(chunks, repository, embedder))
    edited = [*chunks[1:], Chunk("PSI-99", "x.csv", "rows 1-1", "brand new text")]
    third = asyncio.run(index_chunks(edited, repository, embedder))

    assert (first.new, first.unchanged, first.removed) == (len(chunks), 0, 0)
    assert (second.new, second.unchanged, second.removed) == (0, len(chunks), 0)
    assert (third.new, third.unchanged, third.removed) == (1, len(chunks) - 1, 1)
    assert len(embedder.embedded) == len(chunks) + 1


def test_search_requires_an_embedder():
    app = create_app(Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none", voyage_api_key=None))

    with TestClient(app) as client:
        response = client.post("/search", json={"query": "smoke point"})

    assert response.status_code == 503


def test_search_validates_the_request_body():
    app = create_app(Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none"), FakeEmbedder())

    with TestClient(app) as client:
        assert client.post("/search", json={"query": ""}).status_code == 422
        assert client.post("/search", json={"query": "x", "k": 500}).status_code == 422


@pytest.mark.skipif(not DATABASE_URL, reason="set ATLAS_TEST_DATABASE_URL (pgvector) to run")
def test_index_and_search_roundtrip_in_postgres():
    chunks = build_chunks(DATA_DIR)
    embedder = FakeEmbedder()

    async def index_twice():
        async with await AsyncConnection.connect(DATABASE_URL, row_factory=dict_row) as conn:
            await apply_schema(conn)
            await conn.commit()
            repository = PostgresChunkRepository(conn)
            await index_chunks(chunks, repository, embedder)
            return await index_chunks(chunks, repository, embedder)

    async def clean_up():
        # Fake vectors must not linger: they would make a real atlas-index run skip these chunks.
        async with await AsyncConnection.connect(DATABASE_URL) as conn:
            await conn.execute("delete from document_chunks")
            await conn.commit()

    try:
        second = asyncio.run(index_twice())
        query = chunks[0].content
        with TestClient(create_app(Settings(database_url=DATABASE_URL), embedder)) as client:
            response = client.post("/search", json={"query": query, "k": 3})
    finally:
        asyncio.run(clean_up())

    assert second.new == 0

    hits = [SearchHit(**h) for h in response.json()]
    assert response.status_code == 200
    assert len(hits) == 3
    assert hits[0].content == query
    assert hits[0].experiment_id == chunks[0].experiment_id
    assert hits[0].score == pytest.approx(1.0, abs=1e-4)
