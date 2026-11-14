from pathlib import Path

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

SCHEMA_FILE = Path(__file__).resolve().parents[3] / "db" / "schema.sql"


def create_pool(database_url: str) -> AsyncConnectionPool:
    return AsyncConnectionPool(
        database_url,
        min_size=1,
        max_size=5,
        open=False,
        kwargs={"row_factory": dict_row},
    )


async def apply_schema(conn: AsyncConnection) -> None:
    """Idempotent: every statement in db/schema.sql uses IF NOT EXISTS."""
    await conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
