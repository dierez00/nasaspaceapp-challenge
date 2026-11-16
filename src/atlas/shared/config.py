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
    # Azure deployment names, and the API key and either the base URL or endpoint plus API version are required.
    llm_provider: Literal["claude", "azure_openai"] = "claude"
    # Azure v1 API (".../openai/v1/", no api-version): when set, endpoint and api version are not needed.
    azure_openai_base_url: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: SecretStr | None = None
    azure_openai_api_version: str | None = None
    # Default deployment for the classifier and the agents when CLASSIFIER_MODEL / AGENT_MODEL are not set.
    azure_openai_deployment: str | None = None
    # Overrides the reasoning effort of every agent; unset uses "none" for the classifier and
    # agent_effort for the others.
    azure_openai_reasoning_effort: Literal["none", "minimal", "low", "medium", "high"] | None = None
    query_cache_enabled: bool = True
    query_cache_file: Path = Path("data/query_cache.json")

    def azure_classifier_deployment(self) -> str:
        return self._azure_deployment(self.classifier_model)

    def azure_agent_deployment(self) -> str:
        return self._azure_deployment(self.agent_model)

    def _azure_deployment(self, model: str) -> str:
        """A Claude model name (the default) is not a deployment: AZURE_OPENAI_DEPLOYMENT replaces it."""
        if model.startswith("claude") and self.azure_openai_deployment:
            return self.azure_openai_deployment
        return model

    def azure_openai_problems(self) -> list[str]:
        """Names of the variables the azure_openai provider cannot start without (never their values)."""
        problems = []
        if not self.azure_openai_api_key:
            problems.append("AZURE_OPENAI_API_KEY")
        if not self.azure_openai_base_url:
            problems += [
                name
                for name, value in (
                    ("AZURE_OPENAI_ENDPOINT", self.azure_openai_endpoint),
                    ("AZURE_OPENAI_API_VERSION", self.azure_openai_api_version),
                )
                if not value
            ]
            if not self.azure_openai_endpoint or not self.azure_openai_api_version:
                problems.append("(or AZURE_OPENAI_BASE_URL instead of endpoint and API version)")
        if self.azure_classifier_deployment().startswith("claude") or self.azure_agent_deployment().startswith("claude"):
            problems.append(
                "AZURE_OPENAI_DEPLOYMENT (or CLASSIFIER_MODEL and AGENT_MODEL as Azure deployment names, not Claude models)"
            )
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
