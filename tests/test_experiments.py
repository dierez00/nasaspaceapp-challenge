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
    record["tests"][0]["needs_review"] = False

    with pytest.raises(ValidationError, match="needs_review"):
        Experiment.model_validate(record)


def test_file_name_must_match_id(tmp_path):
    record = json.loads((DATA_DIR / "PSI-99.json").read_text(encoding="utf-8"))
    (tmp_path / "PSI-1.json").write_text(json.dumps(record), encoding="utf-8")

    [result] = load_experiment_files(tmp_path)

    assert not result.ok
    assert "does not match" in result.issues[0]
