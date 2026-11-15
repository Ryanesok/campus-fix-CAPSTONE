import io
import math
import time
from typing import Any, Dict, Tuple
import numpy as np
from PIL import Image, ImageOps

MODEL_INPUT_WIDTH = 224
MODEL_INPUT_HEIGHT = 224
MODEL_INPUT_SIZE = (MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT)
LETTERBOX_PAD_RGB = (128, 128, 128)
LETTERBOX_PAD_STYLE = "rgb(128, 128, 128)"

# Kompatibilitas Pillow >= 9.1 dan versi lama
_RESAMPLE_LANCZOS = getattr(getattr(Image, "Resampling", Image), "LANCZOS")


def _js_round(value: float) -> int:
    """Menyamai perilaku Math.round() di JavaScript untuk bilangan positif."""
    return int(math.floor(value + 0.5))


def compute_letterbox_geometry(
    src_width: int,
    src_height: int,
    target_width: int = MODEL_INPUT_WIDTH,
    target_height: int = MODEL_INPUT_HEIGHT,
) -> Dict[str, Any]:
    if (
        not isinstance(src_width, (int, float))
        or not isinstance(src_height, (int, float))
        or src_width <= 0
        or src_height <= 0
    ):
        raise ValueError(f"Dimensi gambar tidak valid: {src_width} x {src_height}")

    scale = min(target_width / src_width, target_height / src_height)
    draw_width = max(1, min(target_width, _js_round(src_width * scale)))
    draw_height = max(1, min(target_height, _js_round(src_height * scale)))
    offset_x = (target_width - draw_width) // 2
    offset_y = (target_height - draw_height) // 2

    return {
        "srcWidth": int(src_width),
        "srcHeight": int(src_height),
        "targetWidth": target_width,
        "targetHeight": target_height,
        "scale": scale,
        "drawWidth": draw_width,
        "drawHeight": draw_height,
        "offsetX": offset_x,
        "offsetY": offset_y,
    }


def decode_image_source_with_exif(image_bytes: bytes) -> Image.Image:
    if not image_bytes:
        raise ValueError("Sumber gambar kosong.")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()

        # 1. WAJIB terapkan orientasi EXIF SEBELUM konversi mode warna (.convert menghapus EXIF)
        img = ImageOps.exif_transpose(img) or img

        # 2. Jika gambar punya transparansi (PNG/WebP RGBA/LA/P), padukan di atas abu-abu (128, 128, 128)
        has_alpha = img.mode in ("RGBA", "LA") or (
            img.mode == "P" and "transparency" in img.info
        )
        if has_alpha:
            rgba = img.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (*LETTERBOX_PAD_RGB, 255))
            img = Image.alpha_composite(background, rgba).convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")

        return img
    except Exception as err:
        raise ValueError(f"Gagal mendekode gambar bytes: {err}") from err


def render_letterbox_canvas(img: Image.Image) -> Tuple[Image.Image, Dict[str, Any]]:
    w, h = img.size
    geometry = compute_letterbox_geometry(w, h)
    img_resized = img.resize(
        (geometry["drawWidth"], geometry["drawHeight"]),
        resample=_RESAMPLE_LANCZOS,
    )
    canvas = Image.new(
        "RGB",
        (geometry["targetWidth"], geometry["targetHeight"]),
        LETTERBOX_PAD_RGB,
    )
    canvas.paste(img_resized, (geometry["offsetX"], geometry["offsetY"]))
    return canvas, geometry


def canvas_to_model_input_tensor(canvas: Image.Image) -> np.ndarray:
    if canvas.size != MODEL_INPUT_SIZE:
        raise ValueError(
            f"Ukuran kanvas input harus {MODEL_INPUT_WIDTH}x{MODEL_INPUT_HEIGHT}, "
            f"diterima: {canvas.size[0]}x{canvas.size[1]}"
        )
    # Rentang piksel 0..255 float32 (tanpa /255.0 karena Rescaling sudah ada di dalam model)
    arr = np.asarray(canvas, dtype=np.float32)
    return np.expand_dims(arr, axis=0)


def preprocess_image_for_model(image_bytes: bytes) -> Dict[str, Any]:
    t0 = time.perf_counter()
    img = decode_image_source_with_exif(image_bytes)
    canvas, geometry = render_letterbox_canvas(img)
    tensor = canvas_to_model_input_tensor(canvas)
    t1 = time.perf_counter()
    return {
        "tensor": tensor,
        "canvas": canvas,
        "geometry": geometry,
        "preprocessTimeMs": round((t1 - t0) * 1000.0, 2),
    }


def letterbox_224(image_bytes: bytes) -> np.ndarray:
    return preprocess_image_for_model(image_bytes)["tensor"]


render_letterbox_image = render_letterbox_canvas