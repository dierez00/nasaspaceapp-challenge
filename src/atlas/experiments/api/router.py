from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg import AsyncConnection

from atlas.experiments.application.filter_experiments import PointFilter, filter_experiments
from atlas.experiments.domain.experiment import Experiment
from atlas.experiments.infrastructure.postgres_repository import PostgresExperimentRepository
from atlas.shared.api import get_connection

router = APIRouter(prefix="/experiments", tags=["experiments"])


def get_repository(conn: Annotated[AsyncConnection, Depends(get_connection)]) -> PostgresExperimentRepository:
    return PostgresExperimentRepository(conn)


Repository = Annotated[PostgresExperimentRepository, Depends(get_repository)]


@router.get("", response_model=list[Experiment])
async def list_experiments(
    repository: Repository,
    min_o2_percent: Annotated[float | None, Query(ge=0, le=100, description="Lowest O2 mole percent, inclusive")] = None,
    max_o2_percent: Annotated[float | None, Query(ge=0, le=100, description="Highest O2 mole percent, inclusive")] = None,
    min_pressure_kpa: Annotated[float | None, Query(ge=0, description="Lowest pressure in kPa, inclusive")] = None,
    max_pressure_kpa: Annotated[float | None, Query(gt=0, description="Highest pressure in kPa, inclusive")] = None,
    exclude_assumed: Annotated[
        bool, Query(description="Drop test points whose O2 or pressure is assumed rather than reported or derived")
    ] = False,
) -> list[Experiment]:
    """List experiments. With any filter set, each experiment keeps only its matching tests
    and experiments with no matching tests are omitted."""
    try:
        criteria = PointFilter(min_o2_percent, max_o2_percent, min_pressure_kpa, max_pressure_kpa, exclude_assumed)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return filter_experiments(await repository.list_all(), criteria)


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str, repository: Repository) -> Experiment:
    experiment = await repository.get(experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail=f"{experiment_id} not found")
    return experiment
