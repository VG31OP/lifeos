from typing import Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_secret_key() -> str:
    return "local-dev-secret-key-0123456789abcdef"


def _default_nebius_key() -> str:
    return "dev-nebius-api-key"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos"

    # JWT
    SECRET_KEY: str = _default_secret_key()
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Nebius AI Cloud
    NEBIUS_API_KEY: str = _default_nebius_key()
    NEBIUS_API_URL: Optional[str] = None
    NEBIUS_BASE_URL: str = "https://api.studio.nebius.ai/v1"

    # NVIDIA Models
    NVIDIA_CHAT_MODEL: str = "nvidia/Llama-3.1-Nemotron-70B-Instruct"
    NVIDIA_EMBEDDING_MODEL: str = "nvidia/NV-Embed-v2"

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def resolve_nebius_base_url(cls, data):
        if isinstance(data, dict):
            api_url = data.get("NEBIUS_API_URL")
            if api_url and not data.get("NEBIUS_BASE_URL"):
                data["NEBIUS_BASE_URL"] = api_url
        return data

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        placeholder_values = {"", "your-secret-key-change-in-production", "changeme", "replace-me", "secret"}
        if v in placeholder_values or len(v) < 32:
            return _default_secret_key()
        return v

    @field_validator("NEBIUS_API_KEY")
    @classmethod
    def validate_nebius_key(cls, v: str) -> str:
        placeholder_values = {"", "your-nebius-api-key", "changeme", "replace-me", "test"}
        if v in placeholder_values:
            return _default_nebius_key()
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or "******" in v or "<your-" in v.lower():
            return "postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos"
        return v


settings = Settings()