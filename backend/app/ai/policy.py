from dataclasses import dataclass
from typing import Dict, List, Sequence
from app.ai.classifier import FACILITY_CLASS_NAMES, RawInferenceResult
from app.schemas.prediction import FacilityCategory, Prediction

MANUAL_CATEGORY_OTHER = "Lainnya"
ALLOWED_REPORT_CATEGORIES: tuple[str, ...] = (*FACILITY_CLASS_NAMES, MANUAL_CATEGORY_OTHER)

# Empat kandidat threshold eksplorasi sesuai rencana eksperimen di threshold_policy.js
CANDIDATE_THRESHOLDS: tuple[float, ...] = (0.50, 0.60, 0.70, 0.80)

# Threshold aktif default hasil kalibrasi (selaras dengan frontend/js/app.js)
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.70

_CLASS_TO_ENUM: Dict[str, FacilityCategory] = {
    "AC": FacilityCategory.AC,
    "Kursi": FacilityCategory.KURSI,
    "Lampu": FacilityCategory.LAMPU,
    "Proyektor": FacilityCategory.PROYEKTOR,
}


@dataclass(frozen=True)
class ThresholdEvaluation:
    """Hasil evaluasi threshold (setara return object evaluateThreshold di threshold_policy.js)."""
    threshold_configured: bool
    threshold_used: float | None
    is_below_threshold: bool
    requires_manual_confirmation: bool
    status: str
    suggested_category: str
    allowed_categories: List[str]
    warning_message: str | None
    calibration_disclaimer: str


def map_class_to_enum(class_name: str) -> FacilityCategory:
    """Memetakan nama kelas model ke enum skema API secara ketat tanpa silent fallback."""
    if class_name not in _CLASS_TO_ENUM:
        raise ValueError(
            f"Nama kelas '{class_name}' tidak valid. Harus salah satu dari: {list(_CLASS_TO_ENUM.keys())}"
        )
    return _CLASS_TO_ENUM[class_name]


def validate_threshold_value(threshold: float | None) -> float | None:
    """Memvalidasi apakah nilai threshold berada pada rentang numerik (0, 1]."""
    if threshold is None:
        return None
    numeric = float(threshold)
    if not (0.0 < numeric <= 1.0):
        raise ValueError(
            f"Nilai threshold tidak valid ({threshold}). Gunakan angka pada rentang (0, 1], "
            "misalnya 0.50, 0.60, 0.70, atau 0.80."
        )
    return numeric


def evaluate_threshold(
    raw_result: RawInferenceResult,
    threshold: float | None = DEFAULT_CONFIDENCE_THRESHOLD,
) -> ThresholdEvaluation:
    """
    Mengevaluasi hasil skor prediksi mentah terhadap threshold yang dikonfigurasi.
    """
    validated_threshold = validate_threshold_value(threshold)
    top_score = raw_result.top_score
    predicted_category = raw_result.predicted_category
    score_pct = f"{top_score * 100:.1f}%"

    if validated_threshold is None:
        return ThresholdEvaluation(
            threshold_configured=False,
            threshold_used=None,
            is_below_threshold=False,
            requires_manual_confirmation=False,
            status="no_threshold_configured",
            suggested_category=predicted_category,
            allowed_categories=list(ALLOWED_REPORT_CATEGORIES),
            warning_message=None,
            calibration_disclaimer=(
                "Skor softmax bukan probabilitas keyakinan yang terkalibrasi. "
                "Pengguna tetap dapat mengoreksi kategori atau memilih Lainnya secara manual."
            ),
        )

    is_below = top_score < validated_threshold
    threshold_pct = f"{validated_threshold * 100:.0f}%"

    if is_below:
        return ThresholdEvaluation(
            threshold_configured=True,
            threshold_used=validated_threshold,
            is_below_threshold=True,
            requires_manual_confirmation=True,
            status="below_threshold_manual_recommended",
            suggested_category=predicted_category,
            allowed_categories=list(ALLOWED_REPORT_CATEGORIES),
            warning_message=(
                f"Skor prediksi tertinggi ({score_pct} untuk {predicted_category}) berada di bawah "
                f"ambang batas ({threshold_pct}). Silakan periksa dan pilih kategori fasilitas secara manual, "
                f'atau pilih "{MANUAL_CATEGORY_OTHER}" jika objek bukan AC, Kursi, Lampu, atau Proyektor.'
            ),
            calibration_disclaimer=(
                "Skor softmax bukan probabilitas keyakinan yang terkalibrasi. "
                "Objek di luar 4 kelas tetap memperoleh skor dari model."
            ),
        )

    return ThresholdEvaluation(
        threshold_configured=True,
        threshold_used=validated_threshold,
        is_below_threshold=False,
        requires_manual_confirmation=False,
        status="above_threshold_auto_suggested",
        suggested_category=predicted_category,
        allowed_categories=list(ALLOWED_REPORT_CATEGORIES),
        warning_message=None,
        calibration_disclaimer=(
            "Meskipun skor melewati threshold, pengguna tetap memegang kendali penuh "
            "untuk mengonfirmasi atau mengoreksi kategori laporan."
        ),
    )


def evaluate_all_candidate_thresholds(
    raw_result: RawInferenceResult,
    candidates: Sequence[float] = CANDIDATE_THRESHOLDS,
) -> List[ThresholdEvaluation]:
    """Mengevaluasi satu hasil prediksi terhadap seluruh kandidat threshold sekaligus."""
    return [evaluate_threshold(raw_result, threshold=t) for t in candidates]


def apply_prediction_policy(
    raw_result: RawInferenceResult,
    threshold: float | None = DEFAULT_CONFIDENCE_THRESHOLD,
) -> tuple[Prediction, ThresholdEvaluation]:
    """
    Titik masuk utama bagi endpoint API: menerapkan kebijakan threshold
    dan mengonversi hasil inferensi menjadi objek Prediction yang valid.
    """
    evaluation = evaluate_threshold(raw_result, threshold=threshold)
    prediction = Prediction(
        category=map_class_to_enum(raw_result.predicted_category),
        confidence=raw_result.top_score,
    )
    return prediction, evaluation