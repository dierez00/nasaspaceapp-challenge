from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://atlas:atlas@localhost:5433/atlas"
    data_dir: Path = Path("data")
    cors_origins: list[str] = ["http://localhost:3000"]
    voyage_api_key: SecretStr | None = None
    embedding_model: str = "voyage-4"
    embedding_dimension: int = 1024
    rerank_model: str = "rerank-2.5"
    rerank_candidates: int = 30
    claude_code_oauth_token: SecretStr | None = None

    # Agents (see curren_repo_context/). AGENTS_MOCK=1 answers /query without Claude, Voyage or Postgres.
    agents_mock: bool = False
    # Cut 1: "rules" skips the composer LLM and builds the UI from fixed rules.
    compositor_mode: Literal["agent", "rules"] = "agent"
    # Cut 2: "direct" skips the researcher LLM and returns the vector search hits as citations.
    investigador_mode: Literal["agent", "direct"] = "agent"
    classifier_model: str = "claude-haiku-5-5"
    agent_model: str = "claude-opus-5-5"
    agent_effort: Literal["low", "medium", "high"] = "low"
    query_cache_enabled: bool = True
    query_cache_file: Path = Path("data/query_cache.json")


@lru_cache
def get_settings() -> Settings:
    return Settings()
