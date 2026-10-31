import secrets
from typing import Literal, Optional

from pydantic import Field, ValidationInfo, field_validator
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
        "replace-this",
        "change-me",
        "changeme",
        "your-secret",
        "example-secret",
        "default-secret",
        "development-secret",
    )
    if any(token in normalized for token in placeholder_tokens):
        return True

    return normalized in {"secret", "dummy"}


def _default_nebius_key() -> str:
    return "dev-nebius-api-key"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_ENV: Literal["development", "production", "test"] = "development"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./lifeos.db"

    # JWT
    SECRET_KEY: str = Field(default_factory=_default_secret_key)
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

    # Redis (optional, for rate limiting)
    REDIS_URL: str = ""

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
            return _default_nebius_key()
        return v.strip()

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        normalized = v.strip()
        lowered = normalized.lower()
        if not normalized or any(
            placeholder in lowered
            for placeholder in ("<your-", "replace-me", "change-me", "changeme", "placeholder")
        ):
            raise ValueError("DATABASE_URL must be set to a non-placeholder connection string.")
        return normalized


settings = Settings()
