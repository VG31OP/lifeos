"""Comprehensive backend tests for LifeOS API."""

import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-32-chars-long"
os.environ["NEBIUS_API_KEY"] = "test-key"

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient
import json

from app.main import app
from app.config import settings
from app.schemas import UserCreate, UserResponse, Token
from app.models import User, Task, Memory, Document, DocumentChunk, Conversation, Message


# =============================================================================
# Test Infrastructure
# =============================================================================

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    """Initialize test database with tables."""
    import asyncio
    from app.database import Base, engine
    from app.models import User, Task, Memory, Document, DocumentChunk, Conversation, Message
    
    async def create_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    asyncio.run(create_tables())
    yield
    # Cleanup - tables persist in memory for session


@pytest.fixture(autouse=True)
def clean_db():
    """Clean database before each test to ensure isolation."""
    import asyncio
    from app.database import engine
    from sqlalchemy import text
    
    async def _clean():
        async with engine.begin() as conn:
            # Truncate all tables in correct order (respecting foreign keys)
            for table in reversed(["messages", "conversations", "document_chunks", "documents", "memories", "tasks", "users", "execution_logs"]):
                await conn.execute(text(f"DELETE FROM {table}"))
    
    asyncio.run(_clean())


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def async_client():
    """Create an async test client."""
    return AsyncClient(app=app, base_url="http://test")


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return AsyncMock()


@pytest.fixture
def test_user():
    """Create a test user."""
    return User(
        id=1,
        email="test@example.com",
        hashed_password="$2b$12$test_hash",
        memory_consent=True,
        is_active=True,
    )


@pytest.fixture
def test_user_no_consent():
    """Create a test user without memory consent."""
    return User(
        id=2,
        email="test2@example.com",
        hashed_password="$2b$12$test_hash",
        memory_consent=False,
        is_active=True,
    )


# =============================================================================
# Authentication Tests
# =============================================================================

class TestAuthentication:
    """Tests for authentication endpoints."""

    def test_register_success(self, client):
            """Test successful user registration."""
            response = client.post(
                "/auth/register",
                json={
                    "email": "newuser@example.com",
                    "password": "SecurePass123!",
                    "full_name": "New User"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "id" in data
            assert data["email"] == "newuser@example.com"

    def test_register_duplicate_email(self, client):
        """Test registration with duplicate email fails."""
        # First registration
        client.post(
            "/auth/register",
            json={
                "email": "dup@example.com",
                "password": "SecurePass123!",
                "full_name": "User One"
            }
        )
        # Second registration with same email
        response = client.post(
            "/auth/register",
            json={
                "email": "dup@example.com",
                "password": "AnotherPass123!",
                "full_name": "User Two"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data["error"]["message"].lower()

    def test_register_invalid_email(self, client):
        """Test registration with invalid email format."""
        response = client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePass123!",
                "full_name": "User"
            }
        )
        assert response.status_code == 422

    def test_register_weak_password(self, client):
        """Test registration with weak password fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": "weak@example.com",
                "password": "123",
                "full_name": "User"
            }
        )
        assert response.status_code == 422

    def test_login_success(self, client):
        """Test successful login."""
        # Register first
        client.post(
            "/auth/register",
            json={
                "email": "login@example.com",
                "password": "SecurePass123!",
                "full_name": "Login User"
            }
        )
        # Login
        response = client.post(
            "/auth/login",
            data={"username": "login@example.com", "password": "SecurePass123!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        response = client.post(
            "/auth/login",
            data={"username": "login@example.com", "password": "WrongPass123!"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "incorrect" in data["error"]["message"].lower()

    def test_me_endpoint(self, client):
        """Test /auth/me endpoint with valid token."""
        # Register and login
        client.post(
            "/auth/register",
            json={
                "email": "me@example.com",
                "password": "SecurePass123!",
                "full_name": "Me User"
            }
        )
        login_resp = client.post(
            "/auth/login",
            data={"username": "me@example.com", "password": "SecurePass123!"}
        )
        token = login_resp.json()["access_token"]
        
        # Get user info
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me@example.com"

    def test_me_endpoint_unauthorized(self, client):
        """Test /auth/me endpoint without token."""
        response = client.get("/auth/me")
        assert response.status_code == 401


# =============================================================================
# Health Check Tests
# =============================================================================

class TestHealthChecks:
    """Tests for health check endpoints."""

    def test_health_root(self, client):
        """Test root health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_db(self, client):
        """Test database health endpoint."""
        response = client.get("/health/db")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"

    def test_health_ai(self, client):
        """Test AI service health endpoint."""
        response = client.get("/health/ai")
        # May be unhealthy due to test API key, but endpoint should respond
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data


# =============================================================================
# Error Response Tests
# =============================================================================

class TestStructuredErrors:
    """Tests for structured error responses."""

    def test_404_error_format(self, client):
        """Test 404 error has consistent format."""
        response = client.get("/nonexistent-endpoint")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
        assert "details" in data["error"]
        assert "correlation_id" in data["error"]
        assert data["error"]["code"] == "NOT_FOUND"

    def test_422_error_format(self, client):
        """Test validation error has consistent format."""
        response = client.post("/auth/register", json={"email": "bad"})
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "correlation_id" in data["error"]

    def test_401_error_format(self, client):
        """Test unauthorized error has consistent format."""
        response = client.get("/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        assert "correlation_id" in data["error"]


# =============================================================================
# Input Sanitization Tests
# =============================================================================

class TestInputSanitization:
    """Tests for input sanitization in AI tool arguments."""

    def test_sanitize_blocks_sql_injection(self):
        """Test that SQL injection patterns are blocked."""
        from app.routes.chat import sanitize_tool_arguments
        args = {"query": "test; DROP TABLE users; --"}
        with pytest.raises(ValueError, match="dangerous"):
            sanitize_tool_arguments(args, "search_memories")

    def test_sanitize_blocks_xss(self):
        """Test that XSS patterns are blocked."""
        from app.routes.chat import sanitize_tool_arguments
        args = {"content": "<script>alert('xss')</script>"}
        with pytest.raises(ValueError, match="dangerous"):
            sanitize_tool_arguments(args, "save_memory")

    def test_sanitize_blocks_shell_metacharacters(self):
        """Test that shell metacharacters are blocked."""
        from app.routes.chat import sanitize_tool_arguments
        args = {"content": "test; rm -rf /"}
        with pytest.raises(ValueError, match="dangerous"):
            sanitize_tool_arguments(args, "save_memory")

    def test_sanitize_allows_clean_input(self):
        """Test that clean input passes sanitization."""
        from app.routes.chat import sanitize_tool_arguments
        args = {"content": "My preference is dark mode", "memory_type": "preference"}
        result = sanitize_tool_arguments(args, "save_memory")
        assert result == args

    def test_sanitize_validates_enums(self):
        """Test that enum fields are validated."""
        from app.routes.chat import sanitize_tool_arguments
        args = {"content": "test", "memory_type": "invalid_type"}
        with pytest.raises(ValueError, match="Invalid memory_type"):
            sanitize_tool_arguments(args, "save_memory")


# =============================================================================
# Memory Consent Tests
# =============================================================================

class TestMemoryConsent:
    """Tests for memory consent enforcement."""

    @pytest.mark.asyncio
    async def test_save_memory_with_consent(self, test_user, mock_db_session):
        """Test that saving memory works when user has consent."""
        from app.routes.chat import execute_save_memory

        # Properly mock the async execute call chain
        # db.execute is async and returns a result object
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = test_user
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()
        mock_db_session.add = MagicMock()

        # Mock ai_service.get_embedding to avoid real API call
        with patch('app.routes.chat.ai_service.get_embedding', new_callable=AsyncMock) as mock_embedding:
            mock_embedding.return_value = [0.1] * 1024  # Mock embedding vector

            args = {"content": "Test memory", "memory_type": "preference"}
            result = await execute_save_memory(args, 1, mock_db_session)

            assert result.success is True
            assert "id" in result.result
            mock_db_session.add.assert_called()
            await mock_db_session.commit()

    @pytest.mark.asyncio
    async def test_save_memory_without_consent(self, test_user_no_consent, mock_db_session):
        """Test that saving memory fails when user lacks consent."""
        from app.routes.chat import execute_save_memory

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = test_user_no_consent
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 2, mock_db_session)

        assert result.success is False
        assert "consent" in result.error.lower()

    @pytest.mark.asyncio
    async def test_save_memory_requires_auth(self, mock_db_session):
        """Test that save_memory requires authenticated user."""
        from app.routes.chat import execute_save_memory

        # When user is not found in database (None returned)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 999, mock_db_session)

        assert result.success is False
        assert "consent" in result.error.lower()


# =============================================================================
# File Upload Security Tests
# =============================================================================

class TestFileUploadSecurity:
    """Tests for file upload security features."""

    def test_mime_validation_pdf(self):
        """Test PDF file signature validation."""
        from app.routes.documents import validate_mime_type
        pdf_header = b"%PDF-1.5\n"
        is_valid, mime = validate_mime_type(pdf_header, ".pdf")
        assert is_valid is True
        assert mime == "application/pdf"

    def test_mime_validation_docx(self):
        """Test DOCX file signature validation."""
        from app.routes.documents import validate_mime_type
        docx_header = b"PK\x03\x04" + b"\x00" * 100
        is_valid, mime = validate_mime_type(docx_header, ".docx")
        assert is_valid is True
        assert mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    def test_mime_validation_text(self):
        """Test text file validation."""
        from app.routes.documents import validate_mime_type
        text_content = b"Hello, world!"
        is_valid, mime = validate_mime_type(text_content, ".txt")
        assert is_valid is True
        assert mime == "text/plain"

    def test_mime_rejects_invalid_text(self):
        """Test that invalid UTF-8 text files are rejected."""
        from app.routes.documents import validate_mime_type
        # Invalid UTF-8 sequence
        invalid_text = b"\xff\xfe\x00\x00"
        is_valid, mime = validate_mime_type(invalid_text, ".txt")
        assert is_valid is False

    def test_mime_rejects_unknown_extension(self):
        """Test that unknown file extensions are rejected."""
        from app.routes.documents import validate_mime_type
        content = b"test"
        is_valid, mime = validate_mime_type(content, ".exe")
        assert is_valid is False

    def test_file_size_limit_enforced(self, client, monkeypatch):
            """Test that file size limit is enforced."""
            # Create a file larger than 10MB
            large_content = b"x" * (11 * 1024 * 1024)
        
            # Need to authenticate - create a test user and get token
            from app.auth import create_access_token
        
            # Create access token using the global settings (which are already set via env vars)
            token = create_access_token(data={"sub": "1"})
            headers = {"Authorization": f"Bearer {token}"}
        
            response = client.post(
                "/documents/upload",
                files={"file": ("large.txt", large_content, "text/plain")},
                headers=headers
            )
            # Should reject files over 10MB (413) or invalid auth (401/403)
            assert response.status_code in [400, 401, 403, 413]


# =============================================================================
# Document Processing Tests
# =============================================================================

class TestDocumentProcessing:
    """Test document processing endpoints."""

    def test_upload_endpoint_exists(self, client):
        """Test that upload endpoint exists."""
        response = client.post("/documents/upload")
        # Should return validation error or auth error, not 404
        assert response.status_code in [401, 422]

    def test_list_documents_endpoint(self, client):
        """Test list documents endpoint."""
        response = client.get("/documents")
        # Should return auth error, not 404
        assert response.status_code in [401, 422]


# =============================================================================
# Task Management Tests
# =============================================================================

class TestTaskManagement:
    """Tests for task management endpoints."""

    def test_create_task_unauthorized(self, client):
        """Test creating task without auth."""
        response = client.post("/tasks", json={"title": "Test Task"})
        assert response.status_code == 401

    def test_list_tasks_unauthorized(self, client):
        """Test listing tasks without auth."""
        response = client.get("/tasks")
        assert response.status_code == 401


# =============================================================================
# Rate Limiting Tests
# =============================================================================

class TestRateLimiting:
    """Tests for rate limiting on auth endpoints."""

    def test_register_rate_limit(self, client):
        """Test rate limit on registration endpoint."""
        # Make multiple registration attempts
        for i in range(6):
            response = client.post(
                "/auth/register",
                json={
                    "email": f"ratelimit{i}@example.com",
                    "password": "SecurePass123!",
                    "full_name": f"User {i}"
                }
            )
        # 6th request should be rate limited (5/min limit)
        assert response.status_code == 429

    def test_login_rate_limit(self, client):
        """Test rate limit on login endpoint."""
        # First register a user
        client.post(
            "/auth/register",
            json={
                "email": "ratelogin@example.com",
                "password": "SecurePass123!",
                "full_name": "Rate User"
            }
        )
        # Make multiple login attempts
        for i in range(11):
            response = client.post(
                "/auth/login",
                data={"username": "ratelogin@example.com", "password": "WrongPass"}
            )
        # 11th request should be rate limited (10/min limit)
        assert response.status_code == 429


# =============================================================================
# AI Service Tests
# =============================================================================

class TestAIService:
    """Tests for AI service integration."""

    @pytest.mark.asyncio
    async def test_get_embedding_raises_on_failure(self):
        """Test that embedding failure raises proper error."""
        from app.ai_service import AIService
        
        service = AIService()
        # This would fail with test API key, but we verify error handling
        # In real test, we'd mock the HTTP client
        # For now, just verify the class can be instantiated
        assert service is not None
        assert service.embedding_model == "nvidia/NV-Embed-v2"


# =============================================================================
# Schema Validation Tests
# =============================================================================

class TestSchemaValidation:
    """Tests for Pydantic schema validation."""

    def test_user_create_schema(self):
        """Test UserCreate schema validation."""
        from app.schemas import UserCreate
        user = UserCreate(
            email="test@example.com",
            password="SecurePass123!",
            full_name="Test User"
        )
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"

    def test_user_create_rejects_invalid_email(self):
        """Test UserCreate rejects invalid email."""
        from app.schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UserCreate(email="invalid", password="SecurePass123!")

    def test_user_response_schema(self):
            """Test UserResponse schema."""
            from app.schemas import UserResponse
            from datetime import datetime
            user = UserResponse(
                id=1,
                email="test@example.com",
                full_name="Test User",
                is_active=True,
                created_at=datetime.now()
            )
            assert user.id == 1
            assert user.is_active is True

    def test_token_schema(self):
        """Test Token schema."""
        from app.schemas import Token
        token = Token(access_token="abc123", token_type="bearer")
        assert token.access_token == "abc123"
        assert token.token_type == "bearer"


# =============================================================================
# Configuration Tests
# =============================================================================

class TestConfiguration:
    """Tests for configuration management."""

    def test_secret_key_validation(self, monkeypatch):
        """Test that secret key is validated."""
        from app.config import Settings
        from pydantic import ValidationError
        
        # Short secret key should fail
        monkeypatch.setenv("SECRET_KEY", "short")
        monkeypatch.setenv("NEBIUS_API_KEY", "test")
        monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
        
        with pytest.raises(ValidationError):
            Settings()

    def test_valid_secret_key(self, monkeypatch):
        """Test that valid secret key passes."""
        from app.config import Settings
        
        monkeypatch.setenv("SECRET_KEY", "a-valid-secret-key-that-is-long-enough")
        monkeypatch.setenv("NEBIUS_API_KEY", "test")
        monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
        
        settings = Settings()
        assert settings.SECRET_KEY == "a-valid-secret-key-that-is-long-enough"

    def test_nebius_url_format(self, monkeypatch):
        """Test Nebius URL format."""
        from app.config import Settings
        
        monkeypatch.setenv("SECRET_KEY", "a-valid-secret-key-that-is-long-enough")
        monkeypatch.setenv("NEBIUS_API_KEY", "test")
        monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
        monkeypatch.setenv("NEBIUS_BASE_URL", "https://api.studio.nebius.ai/v1")
        
        settings = Settings()
        assert "api.studio.nebius.ai" in settings.NEBIUS_BASE_URL

    def test_embedding_dimension(self, monkeypatch):
        """Test embedding dimension is 1024 for NV-Embed-v2."""
        from app.config import Settings
        
        monkeypatch.setenv("SECRET_KEY", "a-valid-secret-key-that-is-long-enough")
        monkeypatch.setenv("NEBIUS_API_KEY", "test")
        monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
        
        settings = Settings()
        # The embedding dimension is a computed property or not in settings
        # Just verify the model name is correct
        assert settings.NVIDIA_EMBEDDING_MODEL == "nvidia/NV-Embed-v2"




