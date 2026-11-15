"""Pure coverage logic: bins PSI points by gravity regime and O2 x pressure, and evaluates reference conditions."""

import math
from collections import Counter
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict

from atlas.coverage.domain.reference import ReferenceCondition, Source
from atlas.experiments.domain.experiment import BurnOutcome, PointType, ValueStatus

GravityRegime = Literal["microgravity", "lunar", "martian", "normal"]
GapReason = Literal["no_points", "no_matching_gravity", "only_assumed_conditions"]

# Regimes come from gravity_g (the recorded level), not from the gravity_environment label:
# the label "partial" covers levels that fall in the lunar or Martian band.
MICROGRAVITY_MAX_G = 0.01
LUNAR_MAX_G = 0.25
MARTIAN_MAX_G = 0.6
REGIMES: tuple[GravityRegime, ...] = ("microgravity", "lunar", "martian", "normal")

# Grid cell size of the O2 x pressure map.
O2_BIN_PERCENT = 5.0
PRESSURE_BIN_KPA = 10.0

# A point is "nearby" a reference condition when it is within these distances on both axes.
O2_TOLERANCE_PERCENT = 3.0
PRESSURE_TOLERANCE_KPA = 10.0

OUTCOMES: tuple[BurnOutcome, ...] = ("no_ignition", "no_sustained_burn", "partial_burn", "complete_burn")
POINT_TYPES: tuple[PointType, ...] = ("test", "limit")


@dataclass(frozen=True)
class CoveragePoint:
    experiment_id: str
    test_id: str
    point_type: PointType
    material_class: str
    o2_percent: float
    o2_status: ValueStatus
    pressure_kpa: float
    pressure_status: ValueStatus
    gravity_g: float
    outcome: BurnOutcome
    needs_review: bool
    o2_basis: Literal["ambient", "oxidizer_stream"] = "ambient"

    @property
    def assumed_conditions(self) -> bool:
        return "assumed" in (self.o2_status, self.pressure_status)


class Contract(BaseModel):
    model_config = ConfigDict(frozen=True)


class Cell(Contract):
    o2_min: float
    o2_max: float
    pressure_min_kpa: float
    pressure_max_kpa: float
    count: int
    by_outcome: dict[BurnOutcome, int]
    by_point_type: dict[PointType, int]
    experiment_ids: list[str]
    needs_review_count: int
    assumed_o2_count: int
    assumed_pressure_count: int


class RegimeCoverage(Contract):
    regime: GravityRegime
    point_count: int
    cells: list[Cell]


class ReferenceEvaluation(Contract):
    id: str
    name: str
    description: str
    gravity_environment: str
    gravity_g: float
    gravity_regime: GravityRegime
    o2_percent: float
    pressure_kpa: float
    gravity_sources: list[Source]
    atmosphere_sources: list[Source]
    o2_tolerance_percent: float
    pressure_tolerance_kpa: float
    nearby_count: int
    nearby_experiment_ids: list[str]
    nearby_by_outcome: dict[BurnOutcome, int]
    nearby_gravity_regimes: list[GravityRegime]
    matching_gravity_count: int
    matching_gravity_experiment_ids: list[str]
    matching_gravity_measured_count: int
    gap: bool
    gap_reason: GapReason | None


class Totals(Contract):
    points: int
    experiments: int
    by_outcome: dict[BurnOutcome, int]
    by_point_type: dict[PointType, int]
    needs_review: int
    assumed_o2: int
    assumed_pressure: int


class CoverageMap(Contract):
    o2_bin_percent: float
    pressure_bin_kpa: float
    totals: Totals
    regimes: list[RegimeCoverage]
    reference_conditions: list[ReferenceEvaluation]


def gravity_regime(gravity_g: float) -> GravityRegime:
    if gravity_g < MICROGRAVITY_MAX_G:
        return "microgravity"
    if gravity_g < LUNAR_MAX_G:
        return "lunar"
    if gravity_g < MARTIAN_MAX_G:
        return "martian"
    return "normal"


def _outcome_counts(points: list[CoveragePoint]) -> dict[BurnOutcome, int]:
    counts = Counter(p.outcome for p in points)
    return {o: counts[o] for o in OUTCOMES}


def _cell(points: list[CoveragePoint], o2_index: int, pressure_index: int) -> Cell:
    types = Counter(p.point_type for p in points)
    return Cell(
        o2_min=o2_index * O2_BIN_PERCENT,
        o2_max=(o2_index + 1) * O2_BIN_PERCENT,
        pressure_min_kpa=pressure_index * PRESSURE_BIN_KPA,
        pressure_max_kpa=(pressure_index + 1) * PRESSURE_BIN_KPA,
        count=len(points),
        by_outcome=_outcome_counts(points),
        by_point_type={t: types[t] for t in POINT_TYPES},
        experiment_ids=sorted({p.experiment_id for p in points}),
        needs_review_count=sum(p.needs_review for p in points),
        assumed_o2_count=sum(p.o2_status == "assumed" for p in points),
        assumed_pressure_count=sum(p.pressure_status == "assumed" for p in points),
    )


def build_regime_coverage(points: list[CoveragePoint]) -> list[RegimeCoverage]:
    """One entry per regime, including empty ones, so the UI can show that nothing was tested there."""
    regimes = []
    for regime in REGIMES:
        grid: dict[tuple[int, int], list[CoveragePoint]] = {}
        in_regime = [p for p in points if p.o2_basis == "ambient" and gravity_regime(p.gravity_g) == regime]
        for p in in_regime:
            key = (math.floor(p.o2_percent / O2_BIN_PERCENT), math.floor(p.pressure_kpa / PRESSURE_BIN_KPA))
            grid.setdefault(key, []).append(p)
        cells = [_cell(grid[key], *key) for key in sorted(grid)]
        regimes.append(RegimeCoverage(regime=regime, point_count=len(in_regime), cells=cells))
    return regimes


def evaluate_condition(
    condition: ReferenceCondition,
    points: list[CoveragePoint],
    o2_tolerance: float = O2_TOLERANCE_PERCENT,
    pressure_tolerance: float = PRESSURE_TOLERANCE_KPA,
) -> ReferenceEvaluation:
    regime = gravity_regime(condition.gravity_g)
    nearby = [
        p
        for p in points
        if p.o2_basis == "ambient"
        and abs(p.o2_percent - condition.o2_percent) <= o2_tolerance
        and abs(p.pressure_kpa - condition.pressure_kpa) <= pressure_tolerance
    ]
    matching = [p for p in nearby if gravity_regime(p.gravity_g) == regime]
    measured = [p for p in matching if not p.assumed_conditions]

    reason: GapReason | None = None
    if not nearby:
        reason = "no_points"
    elif not matching:
        reason = "no_matching_gravity"
    elif not measured:
        reason = "only_assumed_conditions"

    return ReferenceEvaluation(
        id=condition.id,
        name=condition.name,
        description=condition.description,
        gravity_environment=condition.gravity_environment,
        gravity_g=condition.gravity_g,
        gravity_regime=regime,
        o2_percent=condition.o2_percent,
        pressure_kpa=condition.pressure_kpa,
        gravity_sources=condition.gravity_sources,
        atmosphere_sources=condition.atmosphere_sources,
        o2_tolerance_percent=o2_tolerance,
        pressure_tolerance_kpa=pressure_tolerance,
        nearby_count=len(nearby),
        nearby_experiment_ids=sorted({p.experiment_id for p in nearby}),
        nearby_by_outcome=_outcome_counts(nearby),
        nearby_gravity_regimes=[r for r in REGIMES if any(gravity_regime(p.gravity_g) == r for p in nearby)],
        matching_gravity_count=len(matching),
        matching_gravity_experiment_ids=sorted({p.experiment_id for p in matching}),
        matching_gravity_measured_count=len(measured),
        gap=reason is not None,
        gap_reason=reason,
    )


def build_coverage_map(points: list[CoveragePoint], conditions: list[ReferenceCondition]) -> CoverageMap:
    points = [p for p in points if p.o2_basis == "ambient"]
    types = Counter(p.point_type for p in points)
    return CoverageMap(
        o2_bin_percent=O2_BIN_PERCENT,
        pressure_bin_kpa=PRESSURE_BIN_KPA,
        totals=Totals(
            points=len(points),
            experiments=len({p.experiment_id for p in points}),
            by_outcome=_outcome_counts(points),
            by_point_type={t: types[t] for t in POINT_TYPES},
            needs_review=sum(p.needs_review for p in points),
            assumed_o2=sum(p.o2_status == "assumed" for p in points),
            assumed_pressure=sum(p.pressure_status == "assumed" for p in points),
        ),
        regimes=build_regime_coverage(points),
        reference_conditions=[evaluate_condition(c, points) for c in conditions],
    )
