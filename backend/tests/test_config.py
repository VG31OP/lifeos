import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.mark.parametrize(
    "secret_key",
    [
        "short",
        "replace-me-with-a-secure-random-string-32-plus-chars",
        "replace-with-a-long-random-string",
        "replace-this-with-a-random-secret",
        "your-secret-key-change-in-production",
        "change-me-to-a-secure-random-string-32-plus-chars",
    ],
)
def test_secret_key_rejects_short_and_placeholder_values(secret_key):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, APP_ENV="development", SECRET_KEY=secret_key)


def test_secret_key_is_required_outside_development():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, APP_ENV="production", SECRET_KEY="")


def test_secret_key_rejects_documented_placeholder_outside_development():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(
            _env_file=None,
            APP_ENV="production",
            SECRET_KEY="change-me-to-a-secure-random-string-32-plus-chars",
        )


def test_development_generates_secret_only_when_missing(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    settings = Settings(_env_file=None, APP_ENV="development")

    assert len(settings.SECRET_KEY) >= 32


@pytest.mark.parametrize("database_url", ["", "your-database-url", "replace-me"])
def test_database_url_rejects_empty_and_placeholder_values(database_url):
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(
            _env_file=None,
            APP_ENV="development",
            SECRET_KEY="valid-secret-key-with-at-least-32-characters",
            DATABASE_URL=database_url,
        )


def test_database_url_uses_local_default_when_absent(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(
        _env_file=None,
        APP_ENV="development",
        SECRET_KEY="valid-secret-key-with-at-least-32-characters",
    )

    assert settings.DATABASE_URL == Settings.model_fields["DATABASE_URL"].default
