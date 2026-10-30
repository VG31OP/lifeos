import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.ai_service import ai_service
from app.main import app


pytestmark = pytest.mark.skipif(
    os.getenv("LIFEOS_INTEGRATION_TESTS") != "1",
    reason="Requires the pgvector PostgreSQL service configured in CI",
)


def create_account(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "secure-test-password", "full_name": "Test User"},
    )
    assert response.status_code == 200
    response = client.post(
        "/auth/login",
        data={"username": email, "password": "secure-test-password"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_registration_login_task_crud_and_user_isolation():
    with TestClient(app) as client:
        owner_token = create_account(client, f"owner-{uuid.uuid4()}@example.test")
        other_token = create_account(client, f"other-{uuid.uuid4()}@example.test")

        created = client.post(
            "/tasks",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"title": "Read the task back", "priority": "high"},
        )
        assert created.status_code == 200
        task = created.json()

        summary = client.get("/tasks/count/summary", headers={"Authorization": f"Bearer {owner_token}"})
        assert summary.status_code == 200
        assert summary.json()["total"] == 1

        hidden = client.get(f"/tasks/{task['id']}", headers={"Authorization": f"Bearer {other_token}"})
        assert hidden.status_code == 404

        updated = client.patch(
            f"/tasks/{task['id']}",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"status": "completed"},
        )
        assert updated.status_code == 200
        assert updated.json()["completed_at"] is not None

        deleted = client.delete(f"/tasks/{task['id']}", headers={"Authorization": f"Bearer {owner_token}"})
        assert deleted.status_code == 200
        assert client.get(
            f"/tasks/{task['id']}",
            headers={"Authorization": f"Bearer {owner_token}"},
        ).status_code == 404


def test_memory_endpoint_requires_explicit_consent(monkeypatch):
    async def fake_embedding(_: str) -> list[float]:
        return [0.0] * 1024

    monkeypatch.setattr(ai_service, "get_embedding", fake_embedding)
    with TestClient(app) as client:
        token = create_account(client, f"memory-{uuid.uuid4()}@example.test")
        headers = {"Authorization": f"Bearer {token}"}

        denied = client.post(
            "/memories",
            headers=headers,
            json={"content": "Keep this private", "consented": False},
        )
        assert denied.status_code == 400

        saved = client.post(
            "/memories",
            headers=headers,
            json={"content": "Keep this private", "consented": True},
        )
        assert saved.status_code == 200
        assert saved.json()["consented"] is True
        assert len(client.get("/memories", headers=headers).json()) == 1


def test_document_processing_failure_is_recorded(monkeypatch):
    async def fail_embeddings(_: list[str]) -> list[list[float]]:
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(ai_service, "get_embeddings", fail_embeddings)
    with TestClient(app) as client:
        token = create_account(client, f"document-{uuid.uuid4()}@example.test")
        headers = {"Authorization": f"Bearer {token}"}

        failed = client.post(
            "/documents/upload",
            headers=headers,
            files={"file": ("notes.txt", b"Document content", "text/plain")},
        )
        assert failed.status_code == 422

        documents = client.get("/documents", headers=headers)
        assert documents.status_code == 200
        document = documents.json()[0]
        assert document["processing_status"] == "failed"

        deleted = client.delete(f"/documents/{document['id']}", headers=headers)
        assert deleted.status_code == 200
