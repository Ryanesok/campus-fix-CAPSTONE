# backend/tests/test_api.py
import io
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# Generate valid tiny JPEG bytes for testing
img = Image.new("RGB", (32, 32), color="red")
buf = io.BytesIO()
img.save(buf, format="JPEG")
JPEG = buf.getvalue()


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_predict_ok():
    r = client.post("/api/predictions", files={"photo": ("a.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 200
    assert r.json()["prediction"]["category"] in {"AC", "KURSI", "LAMPU", "PROYEKTOR"}


def test_predict_ai_endpoint_ok():
    r = client.post("/api/ai/predict", files={"photo": ("a.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 200
    assert r.json()["prediction"]["category"] in {"AC", "KURSI", "LAMPU", "PROYEKTOR"}


def test_predict_rejects_non_image():
    r = client.post("/api/predictions", files={"photo": ("a.jpg", b"bukan gambar", "image/jpeg")})
    assert r.status_code == 415


def test_predict_requires_file():
    assert client.post("/api/predictions").status_code == 422

