import json
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import ValidationError

from atlas.experiments.domain.experiment import Experiment


@dataclass(frozen=True)
class ExperimentFileResult:
    file: str
    experiment: Experiment | None = None
    issues: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.experiment is not None


def load_experiment_files(directory: Path) -> list[ExperimentFileResult]:
    return [_load(path) for path in sorted(directory.glob("*.json"))]


def _load(path: Path) -> ExperimentFileResult:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return ExperimentFileResult(path.name, issues=[f"invalid JSON: {error}"])

    try:
        experiment = Experiment.model_validate(raw)
    except ValidationError as error:
        issues = [f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in error.errors()]
        return ExperimentFileResult(path.name, issues=issues)

    if f"{experiment.id}.json" != path.name:
        return ExperimentFileResult(path.name, issues=[f"id {experiment.id} does not match file name"])
    return ExperimentFileResult(path.name, experiment=experiment)
