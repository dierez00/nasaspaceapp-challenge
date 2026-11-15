"""Deterministic provider deadlines and SQL-only pool ownership."""

import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from voyageai.error import RateLimitError

from atlas.agents.infrastructure.document_search import DocumentSearch
from atlas.main import create_app
from atlas.search.application import search_documents as application
from atlas.search.infrastructure import postgres_chunk_repository as postgres
from atlas.search.infrastructure.voyage_embedder import VoyageEmbedder, RATE_LIMIT_ATTEMPTS
from atlas.shared.config import Settings


class Pool:
    active = False
    acquisitions = 0

    @asynccontextmanager
    async def connection(self):
        self.active = True
        self.acquisitions += 1
        try:
            yield object()
        finally:
            self.active = False


@pytest.mark.parametrize("consumer", ["http", "researcher"])
def test_provider_calls_never_hold_a_connection(monkeypatch, consumer):
    pool = Pool()
    hits = [SimpleNamespace(experiment_id="PSI-1", source_file="x", section=None,
                            content=str(i), score=0.9, rerank_score=None) for i in range(2)]
    from atlas.search.domain.chunk import SearchHit
    hits = [SearchHit(**vars(hit)) for hit in hits]

    async def embed(text):
        assert not pool.active and pool.acquisitions == 0
        return [0.1]

    async def sql(self, embedding, k):
        assert pool.active
        return hits

    async def rerank(*args):
        assert not pool.active and pool.acquisitions == 1
        return [(1, 0.8)]

    monkeypatch.setattr(postgres.PostgresChunkRepository, "search", sql)
    embedder, reranker = SimpleNamespace(embed_query=embed), SimpleNamespace(rerank=rerank)
    if consumer == "http":
        settings = Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none", voyage_api_key=None)
        with TestClient(create_app(settings, embedder, reranker)) as client:
            client.app.state.pool = pool
            result = client.post("/search", json={"query": "x", "k": 1})
        assert result.status_code == 200
        assert result.json()[0]["rerank_score"] == 0.8
    else:
        result = asyncio.run(DocumentSearch(pool, embedder, reranker)("x", 1))
        assert result[0]["rerank_score"] == 0.8
    assert not pool.active


def test_query_rate_limit_does_not_use_ingestion_backoff(monkeypatch):
    client = SimpleNamespace(embed=AsyncMock(side_effect=RateLimitError("offline")))
    monkeypatch.setattr("atlas.search.infrastructure.voyage_embedder.voyageai.AsyncClient", lambda **kw: client)
    sleep = AsyncMock()
    monkeypatch.setattr("atlas.search.infrastructure.voyage_embedder.asyncio.sleep", sleep)
    embedder = VoyageEmbedder(SecretStr("placeholder"), "model")
    with pytest.raises(RateLimitError):
        asyncio.run(embedder.embed_query("x"))
    assert client.embed.await_count == 1
    sleep.assert_not_called()
    client.embed.reset_mock()
    with pytest.raises(RateLimitError):
        asyncio.run(embedder.embed_documents(["x"]))
    assert client.embed.await_count == RATE_LIMIT_ATTEMPTS
    assert sleep.await_count == RATE_LIMIT_ATTEMPTS - 1


@pytest.mark.parametrize("failure", ["timeout", "error"])
def test_embedding_failure_is_sanitized_and_does_not_acquire_sql(monkeypatch, failure):
    pool = Pool()

    async def embed(text):
        if failure == "timeout":
            await asyncio.Event().wait()
        raise RuntimeError("private-provider-detail")

    monkeypatch.setattr(application, "QUERY_EMBED_TIMEOUT_SECONDS", 0.001)
    settings = Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none", voyage_api_key=None)
    with TestClient(create_app(settings, SimpleNamespace(embed_query=embed))) as client:
        client.app.state.pool = pool
        response = client.post("/search", json={"query": "x"})
    assert response.status_code == 503
    assert "private-provider-detail" not in response.text
    assert pool.acquisitions == 0


def test_rerank_timeout_preserves_vector_order(monkeypatch):
    from atlas.search.domain.chunk import SearchHit
    hits = [SearchHit("PSI-1", "x", None, str(i), 0.9) for i in range(2)]

    async def hang(*args):
        await asyncio.Event().wait()

    monkeypatch.setattr(application, "RERANK_TIMEOUT_SECONDS", 0.001)
    result = asyncio.run(application.search_documents("x", 1,
        SimpleNamespace(embed_query=AsyncMock(return_value=[0.1])),
        SimpleNamespace(search=AsyncMock(return_value=hits)), SimpleNamespace(rerank=hang)))
    assert result == hits[:1] and result[0].rerank_score is None


@pytest.mark.parametrize("failure", ["error", "cancel"])
def test_sql_error_or_cancellation_releases_connection(monkeypatch, failure):
    pool = Pool()

    async def sql(*args):
        raise asyncio.CancelledError() if failure == "cancel" else RuntimeError("offline")

    monkeypatch.setattr(postgres.PostgresChunkRepository, "search", sql)
    with pytest.raises(asyncio.CancelledError if failure == "cancel" else RuntimeError):
        asyncio.run(postgres.PooledChunkSearch(pool).search([0.1], 1))
    assert not pool.active and pool.acquisitions == 1
