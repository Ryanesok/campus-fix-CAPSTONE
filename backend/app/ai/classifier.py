from dataclasses import dataclass
import logging
import time
from typing import Dict, List, Protocol
import numpy as np
import tensorflow as tf

from app.ai.loader import get_model
from app.ai.preprocessing import letterbox_224

logger = logging.getLogger(__name__)

# Urutan indeks keluaran tensor model (wajib identik dengan urutan kelas saat training)
FACILITY_CLASS_NAMES: tuple[str, ...] = ("AC", "Kursi", "Lampu", "Proyektor")


@dataclass(frozen=True)
class RankedClassScore:
    index: int
    class_name: str
    score: float


@dataclass(frozen=True)
class RawInferenceResult:
    """
    Representasi hasil inferensi mentah dari model (setara basePrediction di facility_predictor.js),
    sebelum dievaluasi oleh kebijakan threshold di policy.py.
    """
    predicted_category: str
    predicted_index: int
    top_score: float
    runner_up_category: str
    runner_up_score: float
    margin: float
    scores: List[float]
    scores_by_class: Dict[str, float]
    ranked_predictions: List[RankedClassScore]
    inference_time_ms: float

try:
    from ai.predictor import get_facility_predictor
except ImportError:
    get_facility_predictor = None


class ImageClassifier(Protocol):
    def predict_raw(self, image_bytes: bytes) -> RawInferenceResult: ...


class TfGraphModelClassifier:
    """
    Menjalankan inferensiSavedModel via serving_default signature dan mengembalikan
    distribusi skor lengkap untuk seluruh kelas tanpa logika bisnis/threshold.
    """
    def __init__(self, model_path: str | None = None):
        self.model_path = model_path

    def predict_raw(self, image_bytes: bytes) -> RawInferenceResult:
        model = get_model(self.model_path)
        input_tensor = letterbox_224(image_bytes)  # [1, 224, 224, 3] float32 0..255

        if input_tensor.shape != (1, 224, 224, 3):
            raise ValueError(f"Bentuk tensor input tidak sesuai: {input_tensor.shape}")

        t_start = time.perf_counter()
        infer = model.signatures["serving_default"]
        results = infer(image_rgb_0_255=tf.constant(input_tensor))

        output_tensor = results.get("output_0")
        if output_tensor is None:
            output_tensor = next(iter(results.values()))

        raw_scores = output_tensor.numpy()[0].astype(np.float64)
        t_end = time.perf_counter()
        inference_time_ms = round((t_end - t_start) * 1000.0, 2)

        # Validasi keluaran tensor (replikasi guard di facility_predictor.js)
        if raw_scores.shape[0] != len(FACILITY_CLASS_NAMES):
            raise ValueError(
                f"Jumlah skor keluaran ({raw_scores.shape[0]}) tidak sesuai dengan "
                f"jumlah kelas ({len(FACILITY_CLASS_NAMES)})."
            )
        if not np.all(np.isfinite(raw_scores)):
            raise ValueError("Skor keluaran model mengandung nilai NaN atau Infinity.")

        # Pastikan skor berada dalam bentuk distribusi probabilitas softmax [0..1]
        if not np.isclose(np.sum(raw_scores), 1.0, atol=1e-3) or np.any(raw_scores < 0):
            raw_scores = tf.nn.softmax(raw_scores).numpy()

        scores_list = [float(s) for s in raw_scores]

        # Urutkan skor dari tertinggi ke terendah
        sorted_indices = np.argsort(raw_scores)[::-1]
        ranked_predictions = [
            RankedClassScore(
                index=int(idx),
                class_name=FACILITY_CLASS_NAMES[int(idx)],
                score=float(raw_scores[int(idx)]),
            )
            for idx in sorted_indices
        ]

        top1 = ranked_predictions[0]
        top2 = ranked_predictions[1]
        margin = round(top1.score - top2.score, 6)

        scores_by_class = {
            name: scores_list[i] for i, name in enumerate(FACILITY_CLASS_NAMES)
        }

        logger.debug(
            "Raw inference (%sms): top1=%s (%.4f), runner_up=%s (%.4f), margin=%.4f, all=%s",
            inference_time_ms,
            top1.class_name,
            top1.score,
            top2.class_name,
            top2.score,
            margin,
            {k: round(v, 4) for k, v in scores_by_class.items()},
        )

        return RawInferenceResult(
            predicted_category=top1.class_name,
            predicted_index=top1.index,
            top_score=top1.score,
            runner_up_category=top2.class_name,
            runner_up_score=top2.score,
            margin=margin,
            scores=scores_list,
            scores_by_class=scores_by_class,
            ranked_predictions=ranked_predictions,
            inference_time_ms=inference_time_ms,
        )


_classifier: ImageClassifier | None = None


def get_classifier() -> ImageClassifier:
    global _classifier
    if _classifier is None:
        _classifier = TfGraphModelClassifier()
    return _classifier