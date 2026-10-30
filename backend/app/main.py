import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.config import settings
from app.database import init_db, close_db
from app.routes import auth, tasks, memories, documents, chat
from app.rate_limiter import limiter


class APIError(Exception):
    """Base API error with structured response."""
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        details: dict = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="LifeOS API",
    description="Personal AI Operating System API",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiter
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


def create_error_response(
    request: Request,
    status_code: int,
    error_code: str,
    message: str,
    details: dict = None
) -> JSONResponse:
    """Create a structured error response with correlation ID."""
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4())[:8])
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": error_code,
                "message": message,
                "details": details or {},
                "correlation_id": correlation_id,
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "path": str(request.url.path),
            }
        },
    )


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    """Add correlation ID to request state."""
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4())[:8])
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response


@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return create_error_response(request, exc.status_code, exc.error_code, exc.message, exc.details)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    error_codes = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }
    return create_error_response(request, exc.status_code, error_codes.get(exc.status_code, "HTTP_ERROR"), exc.detail)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return create_error_response(
        request, 
        422, 
        "VALIDATION_ERROR", 
        "Request validation failed", 
        {"errors": exc.errors()}
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log the exception here in production
    return create_error_response(request, 500, "INTERNAL_ERROR", "An unexpected error occurred")


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
    return {"status": "healthy"}


@app.get("/health/db")
async def health_db():
    """Check database connectivity."""
    from app.database import get_db
    from sqlalchemy import text
    try:
        async for session in get_db():
            await session.execute(text("SELECT 1"))
            return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}


@app.get("/health/ai")
async def health_ai():
    """Check AI provider connectivity."""
    from app.ai_service import ai_service
    try:
        # Test with a simple embedding request
        await ai_service.get_embedding("health check")
        return {"status": "ok", "ai_provider": "nebius"}
    except Exception as e:
        return {"status": "error", "ai_provider": "unavailable", "error": str(e)}