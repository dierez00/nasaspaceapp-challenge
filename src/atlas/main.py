from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from atlas.experiments.api.router import router as experiments_router
from atlas.search.api.router import router as search_router
from atlas.search.domain.ports import Embedder
from atlas.search.infrastructure.voyage_embedder import VoyageEmbedder
from atlas.shared.config import Settings, get_settings
from atlas.shared.database import create_pool


def create_app(settings: Settings | None = None, embedder: Embedder | None = None) -> FastAPI:
    settings = settings or get_settings()
    if embedder is None and settings.voyage_api_key is not None:
        embedder = VoyageEmbedder(settings.voyage_api_key, settings.embedding_model, settings.embedding_dimension)
    pool = create_pool(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # wait=False: the API starts even if Postgres is down; /health reports it.
        await pool.open(wait=False)
        app.state.pool = pool
        app.state.embedder = embedder
        yield
        await pool.close()

    app = FastAPI(title="Lunar Fire Atlas API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        try:
            async with pool.connection(timeout=2) as conn:
                await conn.execute("select 1")
            database = "ok"
        except Exception:
            database = "unavailable"
        return {"status": "ok", "database": database}

    app.include_router(experiments_router)
    app.include_router(search_router)
    return app


app = create_app()
