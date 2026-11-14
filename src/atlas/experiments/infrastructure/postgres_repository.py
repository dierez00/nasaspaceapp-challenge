from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from atlas.experiments.domain.experiment import Experiment

_TEST_COLUMNS = (
    "test_id",
    "material",
    "material_class",
    "thickness_mm",
    "o2_percent",
    "o2_status",
    "pressure_kpa",
    "pressure_status",
    "gravity_environment",
    "gravity_g",
    "flow_velocity_cm_s",
    "flow_direction",
    "outcome",
    "burn_length_cm",
    "spread_rate_mm_s",
    "confidence",
    "needs_review",
)


class PostgresExperimentRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def upsert(self, experiment: Experiment) -> None:
        async with self._conn.transaction():
            await self._conn.execute(
                """
                insert into experiments (id, title, acronym, platform, research_area, review_status, record)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  title = excluded.title,
                  acronym = excluded.acronym,
                  platform = excluded.platform,
                  research_area = excluded.research_area,
                  review_status = excluded.review_status,
                  record = excluded.record,
                  updated_at = now()
                """,
                (
                    experiment.id,
                    experiment.title,
                    experiment.acronym,
                    experiment.platform,
                    experiment.research_area,
                    experiment.review.status,
                    Jsonb(experiment.model_dump(mode="json")),
                ),
            )
            # Replace tests so rows removed from the JSON disappear from the table.
            await self._conn.execute("delete from experiment_tests where experiment_id = %s", (experiment.id,))
            columns = ", ".join(("experiment_id", *_TEST_COLUMNS))
            placeholders = ", ".join(["%s"] * (len(_TEST_COLUMNS) + 1))
            async with self._conn.cursor() as cur:
                await cur.executemany(
                    f"insert into experiment_tests ({columns}) values ({placeholders})",
                    [(experiment.id, *(getattr(t, c) for c in _TEST_COLUMNS)) for t in experiment.tests],
                )

    async def list_all(self) -> list[Experiment]:
        cur = await self._conn.execute("select record from experiments order by id")
        return [Experiment.model_validate(row["record"]) for row in await cur.fetchall()]

    async def get(self, experiment_id: str) -> Experiment | None:
        cur = await self._conn.execute("select record from experiments where id = %s", (experiment_id,))
        row = await cur.fetchone()
        return Experiment.model_validate(row["record"]) if row else None
