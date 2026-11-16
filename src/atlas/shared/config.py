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
    # LLM provider for the /query agents. With azure_openai, classifier_model and agent_model are
    # Azure deployment names, and the endpoint, API key and API version are required.
    llm_provider: Literal["claude", "azure_openai"] = "claude"
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: SecretStr | None = None
    azure_openai_api_version: str | None = None
    # Only sent when set: non-reasoning deployments reject reasoning_effort.
    azure_openai_reasoning_effort: Literal["low", "medium", "high"] | None = None
    query_cache_enabled: bool = True
    query_cache_file: Path = Path("data/query_cache.json")

    def azure_openai_problems(self) -> list[str]:
        """Names of the variables the azure_openai provider cannot start without (never their values)."""
        problems = [
            name
            for name, value in (
                ("AZURE_OPENAI_ENDPOINT", self.azure_openai_endpoint),
                ("AZURE_OPENAI_API_KEY", self.azure_openai_api_key),
                ("AZURE_OPENAI_API_VERSION", self.azure_openai_api_version),
            )
            if not value
        ]
        if self.classifier_model.startswith("claude") or self.agent_model.startswith("claude"):
            problems.append("CLASSIFIER_MODEL and AGENT_MODEL (must be Azure deployment names, not Claude models)")
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
