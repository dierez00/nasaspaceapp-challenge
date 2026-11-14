from functools import lru_cache
from pathlib import Path

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
    claude_code_oauth_token: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
