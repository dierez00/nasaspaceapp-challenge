import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from atlas.experiments.api.router import get_repository
from atlas.experiments.application.filter_experiments import PointFilter, filter_experiments
from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.main import create_app
from atlas.shared.config import Settings

DATABASE_URL = os.environ.get("ATLAS_TEST_DATABASE_URL")
DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "experiments"
# NASA exploration atmosphere for lunar habitats (data/reference/conditions.json): 34% O2, 56.5 kPa.
LUNAR_HABITAT = {"min_o2_percent": 30, "max_pressure_kpa": 70.3}


@pytest.fixture(scope="module")
def experiments():
    return sorted((r.experiment for r in load_experiment_files(DATA_DIR) if r.ok), key=lambda e: e.id)


class InMemoryRepository:
    def __init__(self, experiments):
        self._experiments = experiments

    async def list_all(self):
        return self._experiments

    async def get(self, experiment_id):
        return next((e for e in self._experiments if e.id == experiment_id), None)


@pytest.fixture
def client(experiments):
    app = create_app(Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none"))
    app.dependency_overrides[get_repository] = lambda: InMemoryRepository(experiments)
    with TestClient(app) as client:
        yield client


def test_no_filter_returns_every_experiment_unchanged(experiments):
    assert filter_experiments(experiments, PointFilter()) is experiments


def test_lunar_envelope_keeps_only_matching_points(experiments):
    result = filter_experiments(experiments, PointFilter(**LUNAR_HABITAT))

    points = [t for e in result for t in e.tests]
    assert points
    assert all(t.o2_percent >= 30 and t.pressure_kpa <= 70.3 for t in points)
    by_id = {e.id: len(e.tests) for e in result}
    assert by_id["PSI-159"] == 18  # Ambient chamber O2 only; 27 inverse burner-stream points excluded
    assert by_id["PSI-20"] == 13  # ACME BRE 34% O2 days, pressure paired by its Objective 1 (assumed)
    assert "PSI-22" not in by_id  # E-FIELD runs are all at nominal air

    measured = filter_experiments(experiments, PointFilter(**LUNAR_HABITAT, exclude_assumed=True))
    assert [e.id for e in measured] == ["PSI-159"]


def test_bounds_are_inclusive_and_pick_the_cfi_g_85_percent_peak(experiments):
    result = filter_experiments(experiments, PointFilter(min_o2_percent=85, max_o2_percent=85))

    assert result == []  # The 85% points describe inverse burner oxygen, not atmosphere.


def test_exclude_assumed_drops_filled_in_conditions(experiments):
    result = filter_experiments(experiments, PointFilter(max_o2_percent=21, exclude_assumed=True))

    points = [t for e in result for t in e.tests]
    assert "PSI-22" not in {e.id for e in result}
    assert all("assumed" not in (t.o2_status, t.pressure_status) for t in points)


def test_inverted_range_is_rejected():
    with pytest.raises(ValueError, match="min_o2_percent"):
        PointFilter(min_o2_percent=40, max_o2_percent=30)


def test_api_filters_by_o2_and_pressure(client):
    response = client.get("/experiments", params=LUNAR_HABITAT)

    assert response.status_code == 200
    body = response.json()
    assert "PSI-159" in [e["id"] for e in body]
    assert all(t["o2_percent"] >= 30 and t["pressure_kpa"] <= 70.3 for e in body for t in e["tests"])


def test_api_without_filters_is_unchanged(client, experiments):
    body = client.get("/experiments").json()

    assert [len(e["tests"]) for e in body] == [len(e.tests) for e in experiments]


@pytest.mark.parametrize(
    "params",
    [
        {"min_o2_percent": 40, "max_o2_percent": 30},
        {"min_pressure_kpa": 100, "max_pressure_kpa": 50},
        {"max_o2_percent": 120},
        {"min_pressure_kpa": "abc"},
    ],
)
def test_api_rejects_invalid_ranges(client, params):
    assert client.get("/experiments", params=params).status_code == 422


@pytest.mark.skipif(not DATABASE_URL, reason="set ATLAS_TEST_DATABASE_URL and run atlas-load first")
def test_lunar_filter_against_postgres():
    with TestClient(create_app(Settings(database_url=DATABASE_URL))) as client:
        body = client.get("/experiments", params=LUNAR_HABITAT).json()

    assert {e["id"]: len(e["tests"]) for e in body} == {"PSI-159": 18, "PSI-20": 13}
