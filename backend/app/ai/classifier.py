"""Antarmuka modul AI untuk backend CampusFix.

Menghubungkan backend dengan modul model AI terpisah di folder `ai/`.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Protocol

# Tambahkan root proyek ke sys.path jika belum ada agar folder `ai` dapat diimpor
_repo_root = Path(__file__).resolve().parents[3]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from app.schemas.prediction import FacilityCategory, Prediction

try:
    from ai.predictor import get_facility_predictor
except ImportError:
    get_facility_predictor = None


class ImageClassifier(Protocol):
    def predict(self, image_bytes: bytes) -> Prediction: ...


class CampusFixClassifier:
    """Classifier yang memanggil modul AI modular di root `ai/`."""

    def __init__(self) -> None:
        if get_facility_predictor is not None:
            self._predictor = get_facility_predictor()
        else:
            self._predictor = None

    def predict(self, image_bytes: bytes) -> Prediction:
        if self._predictor is not None:
            try:
                category_str, confidence, _ = self._predictor.predict(image_bytes)
                category = FacilityCategory(category_str.upper())
                return Prediction(category=category, confidence=confidence)
            except Exception:
                pass
        return Prediction(category=FacilityCategory.AC, confidence=0.5)


_classifier: ImageClassifier | None = None


def get_classifier() -> ImageClassifier:
    """Model dimuat sekali lalu dipakai ulang, bukan per request."""
    global _classifier
    if _classifier is None:
        _classifier = CampusFixClassifier()
    return _classifier
