from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from psycopg import AsyncConnection

from atlas.experiments.domain.experiment import Experiment
from atlas.experiments.infrastructure.postgres_repository import PostgresExperimentRepository
from atlas.shared.api import get_connection

router = APIRouter(prefix="/experiments", tags=["experiments"])


def get_repository(conn: Annotated[AsyncConnection, Depends(get_connection)]) -> PostgresExperimentRepository:
    return PostgresExperimentRepository(conn)


Repository = Annotated[PostgresExperimentRepository, Depends(get_repository)]


@router.get("", response_model=list[Experiment])
async def list_experiments(repository: Repository) -> list[Experiment]:
    return await repository.list_all()


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str, repository: Repository) -> Experiment:
    experiment = await repository.get(experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail=f"{experiment_id} not found")
    return experiment
