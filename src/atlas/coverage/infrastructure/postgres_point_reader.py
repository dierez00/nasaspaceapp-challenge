from psycopg import AsyncConnection

from atlas.coverage.domain.coverage import CoveragePoint


class PostgresPointReader:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def list_points(self, material_class: str | None = None) -> list[CoveragePoint]:
        cur = await self._conn.execute(
            """
            select experiment_id, test_id, point_type, material_class, o2_percent, o2_status, o2_basis,
                   pressure_kpa, pressure_status, gravity_g, outcome, needs_review
            from experiment_tests
            where o2_basis = 'ambient'
              and (%s::text is null or material_class = %s)
            order by experiment_id, test_id
            """,
            (material_class, material_class),
        )
        return [CoveragePoint(**row) for row in await cur.fetchall()]
