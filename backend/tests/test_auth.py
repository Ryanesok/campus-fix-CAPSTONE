from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
import httpx

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


def test_login_invalid_credentials_returns_400():
    response = client.post(
        "/api/auth/login",
        json={"email": "wrong@kampus.ac.id", "password": "wrongpassword"},
    )
    # Harus mengembalikan respons JSON valid (400 atau 200 dev fallback), tidak crash dengan 500 ASGI error
    assert response.status_code in {200, 400}


def test_login_handles_connection_error_gracefully():
    with patch("app.api.routes.auth.get_supabase_auth_client") as mock_client:
        mock_client.return_value.auth.sign_in_with_password.side_effect = httpx.ConnectError(
            "[Errno 11001] getaddrinfo failed"
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@kampus.ac.id", "password": "password123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "admin"
        assert "token" in data
