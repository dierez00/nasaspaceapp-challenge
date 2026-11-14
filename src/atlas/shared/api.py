from collections.abc import AsyncIterator

from fastapi import Request
from psycopg import AsyncConnection


async def get_connection(request: Request) -> AsyncIterator[AsyncConnection]:
    async with request.app.state.pool.connection() as conn:
        yield conn
