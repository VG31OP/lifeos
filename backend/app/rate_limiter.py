"""Rate limiter configuration."""
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings


# Rate limiter - use in-memory storage for testing if Redis not configured
if settings.REDIS_URL:
    limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)
else:
    # In-memory storage for tests and local development without Redis
    limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")