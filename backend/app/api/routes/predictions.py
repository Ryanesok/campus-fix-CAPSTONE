from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.ai.classifier import ImageClassifier, get_classifier
from app.core.config import Settings, get_settings
from app.schemas.prediction import PredictionResponse

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

# Periksa isi file (magic bytes), bukan hanya ekstensi atau Content-Type.
_SIGNATURES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")


def _is_allowed_image(data: bytes) -> bool:
    if data.startswith(_SIGNATURES):
        return True
    return data[:4] == b"RIFF" and data[8:12] == b"WEBP"


@router.post("", response_model=PredictionResponse)
async def predict(
    photo: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    classifier: ImageClassifier = Depends(get_classifier),
) -> PredictionResponse:
    data = await photo.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, f"Ukuran foto maksimal {settings.max_upload_mb} MB.")
    if not _is_allowed_image(data):
        raise HTTPException(415, "Format foto harus JPEG, PNG, atau WebP.")
    # Prediksi TIDAK membuat laporan permanen.
    return PredictionResponse(prediction=classifier.predict(data))
