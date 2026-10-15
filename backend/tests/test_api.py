from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_predict_ok():
    r = client.post("/api/predictions", files={"photo": ("a.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 200
    assert r.json()["prediction"]["category"] in {"AC", "KURSI", "LAMPU", "PROYEKTOR"}


def test_predict_rejects_non_image():
    r = client.post("/api/predictions", files={"photo": ("a.jpg", b"bukan gambar", "image/jpeg")})
    assert r.status_code == 415


def test_predict_requires_file():
    assert client.post("/api/predictions").status_code == 422
