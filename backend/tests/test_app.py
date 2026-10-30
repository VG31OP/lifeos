"""Test configuration and basic imports."""

import pytest

from app.main import app
from app.config import settings


def test_app_creation():
    """Test that FastAPI app is created correctly."""
    assert app is not None
    assert app.title == "LifeOS API"


def test_settings():
    """Test that settings are loaded."""
    assert settings.NVIDIA_CHAT_MODEL == "nvidia/Llama-3.1-Nemotron-70B-Instruct"
    assert settings.DATABASE_URL is not None
    assert settings.SECRET_KEY is not None