import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from atlas.coverage.api.router import get_reader
from atlas.coverage.application.get_coverage import get_coverage
from atlas.coverage.application.load_reference_conditions import load_reference_conditions
from atlas.coverage.domain.coverage import (
    CoveragePoint,
    build_coverage_map,
    build_regime_coverage,
    evaluate_condition,
    gravity_regime,
)
from atlas.coverage.domain.reference import ReferenceCondition, ReferenceConditions
from atlas.main import create_app
from atlas.shared.config import Settings

ROOT = Path(__file__).resolve().parents[1]
CONDITIONS_FILE = ROOT / "data" / "reference" / "conditions.json"

SOURCE = {"title": "t", "publisher": "p", "url": None, "locator": "l"}


def point(**overrides) -> CoveragePoint:
    values = dict(
        experiment_id="PSI-1",
        test_id="t1",
        point_type="test",
        material_class="polymer",
        o2_percent=21.0,
        o2_status="reported",
        pressure_kpa=101.3,
        pressure_status="reported",
        gravity_g=1e-6,
        outcome="complete_burn",
        needs_review=False,
    )
    return CoveragePoint(**{**values, **overrides})


def condition(**overrides) -> ReferenceCondition:
    values = dict(
        id="lunar-habitat",
        name="Lunar habitat",
        description="d",
        gravity_environment="lunar",
        gravity_g=0.165,
        gravity_sources=[SOURCE],
        o2_percent=34,
        pressure_kpa=56.5,
        atmosphere_sources=[SOURCE],
    )
    return ReferenceCondition.model_validate({**values, **overrides})


def test_reference_conditions_file_is_valid_and_cites_every_value():
    conditions = load_reference_conditions(CONDITIONS_FILE)

    assert {"lunar-habitat-exploration-atmosphere", "iss-cabin", "lunar-eva-suit"} <= {c.id for c in conditions}
    assert all(c.gravity_sources and c.atmosphere_sources for c in conditions)
    assert all(s.url is not None for c in conditions for s in c.atmosphere_sources)


def test_reference_conditions_reject_a_value_without_sources():
    record = json.loads(CONDITIONS_FILE.read_text(encoding="utf-8"))
    record["conditions"][0]["atmosphere_sources"] = []

    with pytest.raises(ValidationError):
        ReferenceConditions.model_validate(record)


@pytest.mark.parametrize(
    ("gravity_g", "regime"),
    [(0, "microgravity"), (1e-6, "microgravity"), (0.165, "lunar"), (0.38, "martian"), (1.0, "normal")],
)
def test_gravity_regime_follows_recorded_level(gravity_g, regime):
    assert gravity_regime(gravity_g) == regime


def test_cells_count_outcomes_types_and_weak_evidence_per_regime():
    points = [
        point(test_id="a", outcome="complete_burn"),
        point(test_id="b", outcome="no_ignition", point_type="limit", needs_review=True),
        point(test_id="c", experiment_id="PSI-2", o2_status="assumed", pressure_status="assumed", needs_review=True),
        point(test_id="d", o2_percent=40, pressure_kpa=250, gravity_g=1.0),
    ]

    regimes = {r.regime: r for r in build_regime_coverage(points)}

    assert [r.regime for r in regimes.values()] == ["microgravity", "lunar", "martian", "normal"]
    assert regimes["lunar"].cells == [] and regimes["lunar"].point_count == 0
    (cell,) = regimes["microgravity"].cells
    assert (cell.o2_min, cell.o2_max, cell.pressure_min_kpa, cell.pressure_max_kpa) == (20, 25, 100, 110)
    assert cell.count == 3
    assert cell.by_outcome == {"no_ignition": 1, "no_sustained_burn": 0, "partial_burn": 0, "complete_burn": 2}
    assert cell.by_point_type == {"test": 2, "limit": 1}
    assert cell.experiment_ids == ["PSI-1", "PSI-2"]
    assert (cell.needs_review_count, cell.assumed_o2_count, cell.assumed_pressure_count) == (2, 1, 1)
    assert regimes["normal"].cells[0].o2_min == 40


def test_condition_without_nearby_points_is_a_gap():
    result = evaluate_condition(condition(), [point()])

    assert (result.gap, result.gap_reason, result.nearby_count) == (True, "no_points", 0)


def test_condition_only_covered_at_other_gravity_is_a_gap():
    points = [point(o2_percent=34, pressure_kpa=56), point(o2_percent=35, pressure_kpa=60, test_id="b")]

    result = evaluate_condition(condition(), points)

    assert (result.gap, result.gap_reason) == (True, "no_matching_gravity")
    assert result.nearby_count == 2
    assert result.nearby_gravity_regimes == ["microgravity"]
    assert result.matching_gravity_count == 0


def test_condition_with_only_assumed_matching_points_is_a_gap():
    points = [point(gravity_g=0.165, o2_percent=34, pressure_kpa=56.5, o2_status="assumed", needs_review=True)]

    result = evaluate_condition(condition(), points)

    assert (result.gap, result.gap_reason) == (True, "only_assumed_conditions")
    assert result.matching_gravity_count == 1 and result.matching_gravity_measured_count == 0


def test_condition_with_measured_matching_points_is_covered():
    points = [
        point(gravity_g=0.165, o2_percent=33, pressure_kpa=60, outcome="partial_burn"),
        point(gravity_g=1e-6, o2_percent=34, pressure_kpa=56.5, experiment_id="PSI-9", test_id="x"),
    ]

    result = evaluate_condition(condition(), points)

    assert (result.gap, result.gap_reason) == (False, None)
    assert result.nearby_experiment_ids == ["PSI-1", "PSI-9"]
    assert result.matching_gravity_experiment_ids == ["PSI-1"]
    assert result.nearby_by_outcome["partial_burn"] == 1


def test_tolerance_is_inclusive_and_limits_nearby_points():
    inside = point(o2_percent=37, pressure_kpa=66.5)
    outside = point(o2_percent=37.1, pressure_kpa=56.5, test_id="b")

    assert evaluate_condition(condition(), [inside, outside]).nearby_count == 1


def test_coverage_map_totals_and_condition_sources():
    points = [point(), point(test_id="b", o2_status="assumed", needs_review=True, point_type="limit")]

    result = build_coverage_map(points, [condition()])

    assert result.totals.points == 2 and result.totals.experiments == 1
    assert result.totals.assumed_o2 == 1 and result.totals.needs_review == 1
    assert result.totals.by_point_type == {"test": 1, "limit": 1}
    assert result.reference_conditions[0].atmosphere_sources[0].publisher == "p"


class FakeReader:
    def __init__(self, points):
        self.points = points
        self.filters = []

    async def list_points(self, material_class=None):
        self.filters.append(material_class)
        return [p for p in self.points if material_class in (None, p.material_class)]


def test_get_coverage_passes_the_filter_to_the_reader():
    reader = FakeReader([point(), point(test_id="b", material_class="fabric")])

    result = asyncio.run(get_coverage(reader, [condition()], "fabric"))

    assert reader.filters == ["fabric"]
    assert result.totals.points == 1


def test_endpoint_serves_coverage_without_a_database():
    app = create_app(Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none", data_dir=ROOT / "data"))
    reader = FakeReader([point(), point(test_id="b", material_class="fabric")])
    app.dependency_overrides[get_reader] = lambda: reader

    with TestClient(app) as client:
        body = client.get("/coverage").json()
        filtered = client.get("/coverage", params={"material_class": "fabric"}).json()
        invalid = client.get("/coverage", params={"material_class": "wood"})

    assert body["totals"]["points"] == 2
    assert [r["regime"] for r in body["regimes"]][0] == "microgravity"
    assert body["regimes"][0]["cells"][0]["count"] == 2
    lunar = next(c for c in body["reference_conditions"] if c["id"] == "lunar-habitat-exploration-atmosphere")
    assert lunar["gap"] is True and lunar["gap_reason"] == "no_points"
    assert lunar["atmosphere_sources"][0]["url"].startswith("https://")
    assert filtered["totals"]["points"] == 1
    assert invalid.status_code == 422


def test_endpoint_reports_missing_reference_file():
    app = create_app(Settings(database_url="postgresql://nobody:x@127.0.0.1:1/none", data_dir=ROOT / "nope"))
    app.dependency_overrides[get_reader] = lambda: FakeReader([])

    with TestClient(app) as client:
        response = client.get("/coverage")

    assert response.status_code == 500
