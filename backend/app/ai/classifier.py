"""Antarmuka modul AI.

Backend hanya bergantung pada `ImageClassifier.predict`. Rekan AI cukup
membuat kelas baru (mis. SklearnClassifier) yang memenuhi kontrak ini,
lalu mendaftarkannya di `get_classifier`.
"""
from typing import Protocol

from app.schemas.prediction import FacilityCategory, Prediction


class ImageClassifier(Protocol):
    def predict(self, image_bytes: bytes) -> Prediction: ...


class MockClassifier:
    """Pengganti sementara sampai model scikit-learn siap (Milestone 2)."""

    def predict(self, image_bytes: bytes) -> Prediction:
        return Prediction(category=FacilityCategory.AC, confidence=0.5)


_classifier: ImageClassifier | None = None


def get_classifier() -> ImageClassifier:
    """Model dimuat sekali lalu dipakai ulang, bukan per request."""
    global _classifier
    if _classifier is None:
        _classifier = MockClassifier()  # ganti dengan model asli nanti
    return _classifier
