import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.experiments.domain.experiment import Experiment, ExperimentTest

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "experiments"


def test_every_experiment_file_matches_the_contract():
    results = load_experiment_files(DATA_DIR)

    assert results
    assert {r.file: r.issues for r in results if not r.ok} == {}


def test_rejects_a_test_without_a_source():
    with pytest.raises(ValidationError):
        ExperimentTest.model_validate({"test_id": "x"})


def test_assumed_pressure_must_be_flagged_for_review():
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    record["tests"][0].update(pressure_status="assumed", needs_review=False)

    with pytest.raises(ValidationError, match="needs_review"):
        Experiment.model_validate(record)


def test_file_name_must_match_id(tmp_path):
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    (tmp_path / "PSI-1.json").write_text(json.dumps(record), encoding="utf-8")

    [result] = load_experiment_files(tmp_path)

    assert not result.ok
    assert "does not match" in result.issues[0]


def test_limits_require_a_limit_type_and_tests_forbid_it():
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    as_limit = {**record["tests"][0], "point_type": "limit"}

    with pytest.raises(ValidationError, match="limit_type"):
        ExperimentTest.model_validate(as_limit)

    ExperimentTest.model_validate({**as_limit, "limit_type": "blowoff"})


def test_test_ids_must_be_unique_within_one_investigation():
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    record["tests"].append(dict(record["tests"][0], notes="Different metadata does not make an ID unique"))
    with pytest.raises(ValidationError, match="duplicate test_id") as error:
        Experiment.model_validate(record)
    assert record["tests"][0]["test_id"] in str(error.value)
    assert error.value.errors()[0]["loc"] == ("tests",)


def test_different_investigations_may_reuse_the_same_test_id(tmp_path):
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    for investigation in ("PSI-1", "PSI-2"):
        (tmp_path / f"{investigation}.json").write_text(json.dumps({**record, "id": investigation}))
    results = load_experiment_files(tmp_path)
    assert len(results) == 2 and all(result.ok for result in results)


def test_loader_reports_duplicate_file_before_any_database_connection(tmp_path, monkeypatch, capsys):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from atlas.experiments.application import load_into_database

    directory = tmp_path / "experiments"
    directory.mkdir()
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    record["tests"].append(record["tests"][0])
    (directory / "PSI-99.json").write_text(json.dumps(record))
    # Include a valid file: a partly invalid batch must not write partial progress.
    (directory / "PSI-1.json").write_text(json.dumps({**record, "id": "PSI-1", "tests": record["tests"][:1]}))
    monkeypatch.setattr(load_into_database, "get_settings", lambda: SimpleNamespace(data_dir=tmp_path))
    connect = AsyncMock(side_effect=AssertionError("Database must not be opened"))
    monkeypatch.setattr(load_into_database.AsyncConnection, "connect", connect)
    assert asyncio.run(load_into_database._run()) == 1
    output = capsys.readouterr().out
    assert "FAIL  PSI-99.json" in output and "duplicate test_id" in output
    assert record["tests"][0]["test_id"] in output
    connect.assert_not_called()


def test_sync_never_writes_an_invalid_duplicate_record(tmp_path):
    import asyncio
    from unittest.mock import AsyncMock
    from atlas.experiments.application.load_into_database import sync_experiments

    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    record["tests"].append(record["tests"][0])
    (tmp_path / "PSI-99.json").write_text(json.dumps(record))
    results = load_experiment_files(tmp_path)
    assert not results[0].ok and "duplicate test_id" in results[0].issues[0]
    repository = AsyncMock()
    assert asyncio.run(sync_experiments(repository, results)) == 0
    repository.upsert.assert_not_called()
