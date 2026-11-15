"""Where the agents get the experiments.

- Real analyst: Postgres only, through the same repository as GET /experiments.
- AGENTS_MOCK: the validated JSON files in data/experiments (no database).
"""

from pathlib import Path

from psycopg_pool import AsyncConnectionPool

from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.experiments.domain.experiment import Experiment
from atlas.experiments.infrastructure.postgres_repository import PostgresExperimentRepository

POSTGRES_TIMEOUT_S = 2


async def load_from_postgres(pool: AsyncConnectionPool) -> list[Experiment]:
    async with pool.connection(timeout=POSTGRES_TIMEOUT_S) as conn:
        return await PostgresExperimentRepository(conn).list_all()


def load_from_files(data_dir: Path) -> list[Experiment]:
    results = load_experiment_files(data_dir / "experiments")
    return [r.experiment for r in results if r.ok and r.experiment is not None]
