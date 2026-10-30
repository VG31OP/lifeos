import secrets
from typing import Literal, Optional

from pydantic import Field, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_secret_key() -> str:
    return secrets.token_urlsafe(32)


def _is_placeholder_value(value: str) -> bool:
    if value is None:
        return True

    normalized = value.strip().lower()
    if not normalized:
        return True

    placeholder_tokens = (
        "replace-me",
        "replace-with",
        "change-me",
        "changeme",
        "your-secret",
        "your-nebius",
        "example-secret",
        "placeholder",
        "default-secret",
        "development-secret",
    )
    if any(token in normalized for token in placeholder_tokens):
        return True

    return normalized in {"secret", "test", "dummy", "dev"}


def _default_nebius_key() -> str:
    return "dev-nebius-api-key"


class Settings(BaseSettings):
    APP_ENV: Literal["development", "production", "test"] = "production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos"

    # JWT
    SECRET_KEY: str = Field(default="", validate_default=True)
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
    def validate_secret_key(cls, v: str, info: ValidationInfo) -> str:
        normalized = (v or "").strip()
        if not normalized and info.data.get("APP_ENV") == "development":
            return _default_secret_key()
        if _is_placeholder_value(normalized) or len(normalized) < 32:
            raise ValueError("SECRET_KEY must be set to a non-placeholder value with at least 32 characters.")
        return normalized

    @field_validator("NEBIUS_API_KEY")
    @classmethod
    def validate_nebius_key(cls, v: str) -> str:
        if _is_placeholder_value(v):
            raise ValueError("NEBIUS_API_KEY must not use a placeholder value.")
        return v.strip()

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        normalized = v.strip()
        lowered = normalized.lower()
        if not normalized or any(
            placeholder in lowered
            for placeholder in ("******", "<your-", "your-", "replace-me", "change-me", "changeme", "placeholder")
        ):
            raise ValueError("DATABASE_URL must be set to a non-placeholder connection string.")
        return normalized

settings = Settings()
