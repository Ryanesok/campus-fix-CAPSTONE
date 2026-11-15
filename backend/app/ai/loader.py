import logging
import os
import time
import numpy as np
import tensorflow as tf

from app.ai.preprocessing import MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH

logger = logging.getLogger(__name__)

_model = None
_loaded_model_path: str | None = None


def get_default_model_path() -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "model", "CampusFix_Integration_Bundle", "saved_model")


def get_model(model_path: str | None = None, warm_up: bool = True):
    global _model, _loaded_model_path

    target_path = model_path or get_default_model_path()
    if _model is not None and _loaded_model_path == target_path:
        return _model

    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Direktori SavedModel tidak ditemukan di: {target_path}")

    t_load_start = time.perf_counter()
    loaded = tf.saved_model.load(target_path)

    if "serving_default" not in loaded.signatures:
        raise RuntimeError(
            f"Signature 'serving_default' tidak ditemukan pada model. "
            f"Tersedia: {list(loaded.signatures.keys())}"
        )

    t_load_ms = round((time.perf_counter() - t_load_start) * 1000.0, 2)

    warm_up_ms = 0.0
    if warm_up:
        t_warm_start = time.perf_counter()
        dummy_input = np.zeros((1, MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH, 3), dtype=np.float32)
        loaded.signatures["serving_default"](image_rgb_0_255=tf.constant(dummy_input))
        warm_up_ms = round((time.perf_counter() - t_warm_start) * 1000.0, 2)

    _model = loaded
    _loaded_model_path = target_path
    logger.info(
        "SavedModel berhasil dimuat dari '%s' (load=%sms, warm_up=%sms)",
        target_path,
        t_load_ms,
        warm_up_ms,
    )
    return _model