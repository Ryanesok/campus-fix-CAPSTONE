from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.main import app
from app.models import UserRole

client = TestClient(app)


def test_me_requires_token():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_returns_authenticated_user():
    user = CurrentUser(id=uuid4(), role=UserRole.ADMIN)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.get("/api/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"id": str(user.id), "role": "admin"}
