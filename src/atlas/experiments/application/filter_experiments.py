"""Narrow experiments to the test points inside an O2 / pressure envelope.

Filtering works per test point: each experiment keeps only its matching tests,
and experiments left without tests are dropped. Bounds are inclusive.
"""

from dataclasses import dataclass

from atlas.experiments.domain.experiment import Experiment, ExperimentTest


@dataclass(frozen=True)
class PointFilter:
    min_o2_percent: float | None = None
    max_o2_percent: float | None = None
    min_pressure_kpa: float | None = None
    max_pressure_kpa: float | None = None
    exclude_assumed: bool = False

    def __post_init__(self) -> None:
        for low, high, name in (
            (self.min_o2_percent, self.max_o2_percent, "o2_percent"),
            (self.min_pressure_kpa, self.max_pressure_kpa, "pressure_kpa"),
        ):
            if low is not None and high is not None and low > high:
                raise ValueError(f"min_{name} must not exceed max_{name}")

    @property
    def is_empty(self) -> bool:
        return self == PointFilter()

    def matches(self, test: ExperimentTest) -> bool:
        atmospheric_bounds = any(value is not None for value in (
            self.min_o2_percent, self.max_o2_percent, self.min_pressure_kpa, self.max_pressure_kpa
        ))
        if atmospheric_bounds and test.o2_basis != "ambient":
            return False
        if self.exclude_assumed and "assumed" in (test.o2_status, test.pressure_status):
            return False
        return _within(test.o2_percent, self.min_o2_percent, self.max_o2_percent) and _within(
            test.pressure_kpa, self.min_pressure_kpa, self.max_pressure_kpa
        )


def _within(value: float, low: float | None, high: float | None) -> bool:
    return (low is None or value >= low) and (high is None or value <= high)


def filter_experiments(experiments: list[Experiment], criteria: PointFilter) -> list[Experiment]:
    if criteria.is_empty:
        return experiments
    filtered = []
    for experiment in experiments:
        tests = [t for t in experiment.tests if criteria.matches(t)]
        if tests:
            filtered.append(experiment.model_copy(update={"tests": tests}))
    return filtered
