import asyncio
import logging

from fastapi.testclient import TestClient

from atlas.main import create_app
from atlas.search.api import router as search_router
from atlas.search.application.search_documents import search_documents
from atlas.search.domain.chunk import SearchHit
from atlas.shared.config import Settings


def _hit(n: int) -> SearchHit:
    return SearchHit("PSI-1", "f.json", "overview", f"chunk {n}", 1 - n / 100)


class FakeEmbedder:
    async def embed_query(self, text: str) -> list[float]:
        return [0.0]


class FakeRepository:
    def __init__(self, total: int = 40) -> None:
        self.hits = [_hit(n) for n in range(total)]
        self.limits: list[int] = []

    async def search(self, embedding, k):
        self.limits.append(k)
        return self.hits[:k]


class ReversingReranker:
    """Deterministic: the last candidate wins."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str], int]] = []

    async def rerank(self, query, documents, top_k):
        self.calls.append((query, documents, top_k))
        order = list(reversed(range(len(documents))))[:top_k]
        return [(i, 1.0 - n / 10) for n, i in enumerate(order)]


class FailingReranker:
    async def rerank(self, query, documents, top_k):
        raise RuntimeError("provider down sk-secret")


def _search(repository, reranker=None, **kwargs):
    return asyncio.run(search_documents("q", 3, FakeEmbedder(), repository, reranker, **kwargs))


def test_reranker_order_wins_over_vector_order_and_pool_is_larger_than_k():
    repository, reranker = FakeRepository(), ReversingReranker()

    hits = _search(repository, reranker, candidates=10)

    assert repository.limits == [10]
    assert [h.content for h in hits] == ["chunk 9", "chunk 8", "chunk 7"]
    assert [h.rerank_score for h in hits] == [1.0, 0.9, 0.8]
    assert hits[0].score == _hit(9).score
    assert reranker.calls[0][2] == 3 and len(reranker.calls[0][1]) == 10


def test_pool_is_never_smaller_than_k():
    repository = FakeRepository()

    _search(repository, ReversingReranker(), candidates=1)

    assert repository.limits == [3]


def test_without_reranker_vector_order_and_k_limit_are_kept():
    repository = FakeRepository()

    hits = _search(repository)

    assert repository.limits == [3]
    assert [h.content for h in hits] == ["chunk 0", "chunk 1", "chunk 2"]
    assert all(h.rerank_score is None for h in hits)


def test_reranker_failure_falls_back_to_vector_order_without_leaking_the_message(caplog):
    with caplog.at_level(logging.WARNING):
        hits = _search(FakeRepository(), FailingReranker())

    assert [h.content for h in hits] == ["chunk 0", "chunk 1", "chunk 2"]
    assert all(h.rerank_score is None for h in hits)
    assert "RuntimeError" in caplog.text and "sk-secret" not in caplog.text


def test_legacy_positional_call_still_works():
    hits = asyncio.run(search_documents("q", 2, FakeEmbedder(), FakeRepository()))

    assert len(hits) == 2


class FakePool:
    def connection(self):
        return self

    async def __aenter__(self):
        return object()

    async def __aexit__(self, *exc):
        return False


def _post(monkeypatch, body, reranker):
    seen = {}

    async def fake_search(query, k, embedder, repository, reranker=None, candidates=0):
        seen.update(reranker=reranker, candidates=candidates)
        return [SearchHit("PSI-1", "f.json", None, "text", 0.5, 0.9 if reranker else None)]

    monkeypatch.setattr(search_router, "search_documents", fake_search)
    monkeypatch.setattr(search_router, "PooledChunkSearch", lambda conn: None)
    settings = Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none", voyage_api_key=None, rerank_candidates=12)
    with TestClient(create_app(settings, FakeEmbedder(), reranker)) as client:
        client.app.state.pool = FakePool()
        response = client.post("/search", json=body)
    return response, seen


def test_api_reranks_by_default_and_exposes_rerank_score(monkeypatch):
    reranker = ReversingReranker()

    response, seen = _post(monkeypatch, {"query": "x"}, reranker)

    assert response.status_code == 200
    assert response.json()[0]["rerank_score"] == 0.9
    assert seen == {"reranker": reranker, "candidates": 12}


def test_api_rerank_false_skips_the_reranker(monkeypatch):
    response, seen = _post(monkeypatch, {"query": "x", "rerank": False}, ReversingReranker())

    assert response.json()[0]["rerank_score"] is None
    assert seen["reranker"] is None


def test_api_works_when_no_reranker_is_configured(monkeypatch):
    response, seen = _post(monkeypatch, {"query": "x"}, None)

    assert response.status_code == 200
    assert seen["reranker"] is None
