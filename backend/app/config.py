from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import field_validator


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "******localhost:5432/lifeos"

    # JWT
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Nebius AI Cloud
    NEBIUS_API_KEY: str = ""
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
    def validate_secret_key(cls, v: str) -> str:
        if not v or v == "your-secret-key-change-in-production" or len(v) < 32:
            raise ValueError("SECRET_KEY must be set to a secure random string (32+ chars)")
        return v

    @field_validator("NEBIUS_API_KEY")
    @classmethod
    def validate_nebius_key(cls, v: str) -> str:
        if not v:
            raise ValueError("NEBIUS_API_KEY is required")
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if "******" in v:
            raise ValueError("DATABASE_URL must be a valid PostgreSQL connection string")
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()