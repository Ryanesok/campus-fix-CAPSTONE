from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.main import app
from app.models import UserRole

client = TestClient(app)


def test_reports_require_authentication():
    assert client.get("/api/reports/me").status_code == 401
    assert client.get("/api/admin/reports").status_code == 401
    response = client.patch(
        "/api/admin/reports/00000000-0000-0000-0000-000000000000/status",
        json={"status": "accepted"},
    )
    assert response.status_code == 401


def test_admin_reports_rejects_reporter():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=uuid4(), role=UserRole.REPORTER
    )
    try:
        response = client.get("/api/admin/reports")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
