"""Offline input validation must finish before touching the existing index."""

import asyncio
import shutil
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import SecretStr

from atlas.search.application.chunking import build_chunks
from atlas.search.application import index_documents

DATA = Path(__file__).resolve().parents[1] / "data"


@pytest.mark.parametrize("layout", ["missing", "no-experiments", "empty"])
def test_missing_or_empty_experiment_inputs_fail(tmp_path, layout):
    directory = tmp_path / "data"
    if layout != "missing":
        directory.mkdir()
    if layout == "empty":
        (directory / "experiments").mkdir()
    with pytest.raises(ValueError):
        build_chunks(directory)


@pytest.mark.parametrize("contents", ['{"id":', '{}'])
def test_any_invalid_record_blocks_even_a_partially_valid_corpus(tmp_path, contents):
    experiments = tmp_path / "experiments"
    experiments.mkdir()
    shutil.copy(DATA / "experiments" / "PSI-99.json", experiments)
    (experiments / "PSI-1.json").write_text(contents)
    with pytest.raises(ValueError, match="PSI-1.json"):
        build_chunks(tmp_path)


def test_empty_public_index_call_does_not_read_or_mutate_repository():
    repository, embedder = AsyncMock(), AsyncMock()
    with pytest.raises(ValueError, match="empty corpus"):
        asyncio.run(index_documents.index_chunks([], repository, embedder))
    assert not repository.mock_calls
    assert not embedder.mock_calls


def test_cli_invalid_input_fails_before_connecting(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(index_documents, "get_settings", lambda: SimpleNamespace(
        data_dir=tmp_path, voyage_api_key=SecretStr("offline-placeholder")))
    connect = AsyncMock(side_effect=AssertionError("Database must not be opened"))
    monkeypatch.setattr(index_documents.AsyncConnection, "connect", connect)
    assert asyncio.run(index_documents._run()) == 1
    assert "index unchanged" in capsys.readouterr().out
    connect.assert_not_called()
