"""CLI: validate data/experiments and upsert every valid file into Postgres."""

import asyncio
import sys

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.experiments.domain.repository import ExperimentRepository
from atlas.experiments.infrastructure.postgres_repository import PostgresExperimentRepository
from atlas.shared.config import get_settings
from atlas.shared.database import apply_schema


async def sync_experiments(repository: ExperimentRepository, results) -> int:
    loaded = 0
    for result in results:
        if result.experiment:
            await repository.upsert(result.experiment)
            loaded += 1
    return loaded


async def _run() -> int:
    settings = get_settings()
    results = load_experiment_files(settings.data_dir / "experiments")
    invalid = [r for r in results if not r.ok]
    for result in invalid:
        print(f"SKIP  {result.file}: {len(result.issues)} issues (run atlas-validate)")

    async with await AsyncConnection.connect(settings.database_url, row_factory=dict_row) as conn:
        await apply_schema(conn)
        loaded = await sync_experiments(PostgresExperimentRepository(conn), results)
        await conn.commit()

    print(f"{loaded} experiments loaded, {len(invalid)} skipped")
    return 1 if invalid else 0


def main() -> None:
    sys.exit(asyncio.run(_run()))


if __name__ == "__main__":
    main()
