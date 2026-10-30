from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging
from sqlalchemy import text
from app.config import settings
from app.database import engine, init_db, close_db
from app.routes import auth, tasks, memories, documents, chat
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    from app.ai_service import ai_service
    await ai_service.client.close()
    await close_db()


app = FastAPI(
    title="LifeOS API",
    description="Personal AI Operating System API",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(memories.router)
app.include_router(documents.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {"message": "LifeOS API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok", "backend": "operational"}


@app.get("/health/db")
async def health_db():
    """Check database connectivity."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        logger.exception("Database health check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "disconnected"},
        )


@app.get("/health/ai")
async def health_ai():
    """Probe configured chat and embedding models with real provider requests."""
    from app.ai_service import ai_service

    configured = settings.NEBIUS_API_KEY != "dev-nebius-api-key"
    result = {
        "status": "unavailable",
        "provider": "nebius",
        "credentials_configured": configured,
        "chat_inference": "not_configured" if not configured else "unavailable",
        "embedding_generation": "not_configured" if not configured else "unavailable",
    }
    if not configured:
        return JSONResponse(status_code=503, content=result)

    try:
        await asyncio.wait_for(
            ai_service.client.chat.completions.create(
                model=ai_service.chat_model,
                messages=[{"role": "user", "content": "Reply with OK."}],
                max_tokens=8,
                temperature=0,
            ),
            timeout=15,
        )
        result["chat_inference"] = "ok"
    except Exception:
        logger.exception("Nebius chat health probe failed")

    try:
        await asyncio.wait_for(ai_service.get_embedding("health check"), timeout=15)
        result["embedding_generation"] = "ok"
    except Exception:
        logger.exception("Nebius embedding health probe failed")

    if result["chat_inference"] == "ok" and result["embedding_generation"] == "ok":
        result["status"] = "ok"
        return result
    return JSONResponse(status_code=503, content=result)