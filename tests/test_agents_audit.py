"""Regressions found while auditing agents/ and query/ (see odd/tasks/agents-o2-basis-audit.md)."""

import asyncio
import json
from pathlib import Path

import pytest

from atlas.agents.domain.grounding import Evidence
from atlas.agents.infrastructure import researcher_tools
from atlas.query.application.answer import answer
from atlas.query.infrastructure.file_cache import FileQueryCache, normalize

ANALYST = {"consultas": [{"columns": ["experiment_id", "x"], "rows": [["PSI-99", 12.5]], "total": 1}]}


@pytest.mark.parametrize(
    "text",
    ["El O2 sube a 12.5.", "Con o2_basis ambient hay 1 ensayo.", "El CO2 y el H2O no cuentan.", "PSI-99 usa O2 de 12.5."],
)
def test_digits_inside_words_are_not_figures(text):
    assert Evidence("q", ANALYST, None).text_is_grounded(text)


@pytest.mark.parametrize("text", ["El O2 sube a 99.", "A 99 kPa hay 12.5.", "Hay 3 ensayos de O2."])
def test_real_invented_figures_are_still_rejected(text):
    assert not Evidence("q", ANALYST, None).text_is_grounded(text)


def test_questions_with_opposite_comparisons_do_not_share_a_cache_key():
    assert normalize("¿O2 > 30%?") != normalize("¿O2 < 30%?")
    assert normalize("O2 >= 30") != normalize("O2 <= 30")
    assert normalize("O2 >30") == normalize("o2  >  30")
    assert normalize("¿Compara  PMMA?") == normalize("compara pmma")


@pytest.mark.parametrize("content", ['{"q": {"summary": "x"}}', "[1, 2]", '{"q": "texto"}'])
def test_a_malformed_cache_file_is_a_miss(tmp_path: Path, content):
    path = tmp_path / "cache.json"
    path.write_text(content, encoding="utf-8")

    assert FileQueryCache(path).get("q") is None


def test_a_cache_that_raises_does_not_fail_the_question():
    class Broken:
        def get(self, question):
            raise KeyError("summary")

        def put(self, question, ui):
            raise AssertionError

    async def pipeline(*args, **kwargs):
        from atlas.agents.domain.events import Event

        yield Event("ui", {"summary": "ok", "components": []})

    async def go():
        import atlas.query.application.answer as module

        original = module.run_query
        module.run_query = pipeline
        try:
            return [e async for e in answer("q", None, composer_mode="rules", cache=Broken())]  # type: ignore[arg-type]
        finally:
            module.run_query = original

    assert [e.name for e in asyncio.run(go())] == ["ui"]


def test_researcher_tool_rejects_a_non_numeric_k(monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(
        researcher_tools, "create_sdk_mcp_server", lambda name, tools: captured.setdefault("tool", tools[0])
    )

    async def search(query, k):
        raise AssertionError("must not search")

    researcher_tools.build_researcher_server(search, [])
    result = asyncio.run(captured["tool"].handler({"consulta": "flame", "k": "muchos"}))

    assert result["is_error"] is True
    assert "entero" in result["content"][0]["text"]
