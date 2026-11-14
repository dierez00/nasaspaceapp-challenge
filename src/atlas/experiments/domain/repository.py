from typing import Protocol

from atlas.experiments.domain.experiment import Experiment


class ExperimentRepository(Protocol):
    async def upsert(self, experiment: Experiment) -> None: ...

    async def list_all(self) -> list[Experiment]: ...

    async def get(self, experiment_id: str) -> Experiment | None: ...
