/**
 * @fileoverview Preprocessing gambar di browser untuk inferensi CampusFix.
 *
 * Wajib konsisten dengan pipeline training Huda (Notebook 02 & 03):
 * 1. Terapkan orientasi EXIF (imageOrientation: 'from-image').
 * 2. Konversi gambar ke RGB 3-channel.
 * 3. Pertahankan rasio aspek (aspect-ratio-preserving resize) dan tempatkan
 *    di tengah kanvas 224 x 224 (centered letterbox) dengan warna padding RGB(128, 128, 128).
 * 4. Kembalikan tensor float32 berukuran [1, 224, 224, 3] dengan rentang piksel 0..255.
 * 5. JANGAN melakukan normalisasi di luar model karena layer Rescaling(1/127.5, offset=-1)
 *    sudah tertanam di dalam arsitektur model MobileNetV2.
 */

export const MODEL_INPUT_WIDTH = 224;
export const MODEL_INPUT_HEIGHT = 224;
export const LETTERBOX_PAD_RGB = Object.freeze([128, 128, 128]);
export const LETTERBOX_PAD_STYLE = 'rgb(128, 128, 128)';

/**
 * Menghitung geometri letterbox 224 x 224 yang konsisten dengan Pillow ImageOps.pad(..., centering=(0.5, 0.5)).
 *
 * Pada Pillow ImageOps.pad:
 * - scale = min(targetW / srcW, targetH / srcH)
 * - resizedW = round(srcW * scale), resizedH = round(srcH * scale)
 * - offsetX = floor((targetW - resizedW) * 0.5), offsetY = floor((targetH - resizedH) * 0.5)
 *
 * @param {number} srcWidth
 * @param {number} srcHeight
 * @param {number} [targetWidth=MODEL_INPUT_WIDTH]
 * @param {number} [targetHeight=MODEL_INPUT_HEIGHT]
 * @returns {{
 *   srcWidth: number,
 *   srcHeight: number,
 *   targetWidth: number,
 *   targetHeight: number,
 *   scale: number,
 *   drawWidth: number,
 *   drawHeight: number,
 *   offsetX: number,
 *   offsetY: number
 * }}
 */
export function computeLetterboxGeometry(
  srcWidth,
  srcHeight,
  targetWidth = MODEL_INPUT_WIDTH,
  targetHeight = MODEL_INPUT_HEIGHT
) {
  if (!Number.isFinite(srcWidth) || !Number.isFinite(srcHeight) || srcWidth <= 0 || srcHeight <= 0) {
    throw new Error(`Dimensi gambar tidak valid: ${srcWidth} x ${srcHeight}`);
  }
  const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
  const drawWidth = Math.max(1, Math.min(targetWidth, Math.round(srcWidth * scale)));
  const drawHeight = Math.max(1, Math.min(targetHeight, Math.round(srcHeight * scale)));
  const offsetX = Math.floor((targetWidth - drawWidth) / 2);
  const offsetY = Math.floor((targetHeight - drawHeight) / 2);

  return {
    srcWidth,
    srcHeight,
    targetWidth,
    targetHeight,
    scale,
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
  };
}

/**
 * Memuat sumber gambar (File, Blob, HTMLImageElement, HTMLCanvasElement, atau ImageBitmap)
 * menjadi objek drawable dengan orientasi EXIF yang sudah diterapkan.
 *
 * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|ImageBitmap} source
 * @returns {Promise<{ drawable: CanvasImageSource, width: number, height: number, shouldClose: boolean }>}
 */
export async function decodeImageSourceWithExif(source) {
  if (!source) {
    throw new Error('Sumber gambar kosong atau tidak diberikan.');
  }

  // 1. Jika File atau Blob: gunakan createImageBitmap dengan imageOrientation: 'from-image' bila didukung
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    if (source.size === 0) {
      throw new Error('File gambar kosong (0 byte).');
    }
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(source, {
          imageOrientation: 'from-image',
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'default',
        });
        if (!bitmap.width || !bitmap.height) {
          bitmap.close();
          throw new Error('Gambar memiliki ukuran 0 piksel.');
        }
        return {
          drawable: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          shouldClose: true,
        };
      } catch (err) {
        // Fallback ke HTMLImageElement jika browser gagal pada opsi createImageBitmap tertentu
      }
    }

    const objectUrl = URL.createObjectURL(source);
    try {
      const img = new Image();
      img.decoding = 'async';
      // CSS default di browser modern adalah image-orientation: from-image
      img.style.imageOrientation = 'from-image';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('File bukan gambar yang valid atau format gambar rusak.'));
        img.src = objectUrl;
      });
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch (_) {
          // Abaikan jika decode() sudah selesai saat onload
        }
      }
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        throw new Error('Ukuran gambar tidak valid setelah didekode.');
      }
      return { drawable: img, width, height, shouldClose: false };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // 2. Jika ImageBitmap
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    if (!source.width || !source.height) {
      throw new Error('ImageBitmap memiliki dimensi tidak valid.');
    }
    return { drawable: source, width: source.width, height: source.height, shouldClose: false };
  }

  // 3. Jika HTMLCanvasElement
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    if (!source.width || !source.height) {
      throw new Error('Canvas sumber memiliki dimensi 0.');
    }
    return { drawable: source, width: source.width, height: source.height, shouldClose: false };
  }

  // 4. Jika HTMLImageElement (atau objek image-like)
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    if (!source.complete) {
      await new Promise((resolve, reject) => {
        source.addEventListener('load', resolve, { once: true });
        source.addEventListener(
          'error',
          () => reject(new Error('Gagal memuat elemen gambar (HTMLImageElement).')),
          { once: true }
        );
      });
    }
    if (typeof source.decode === 'function') {
      try {
        await source.decode();
      } catch (_) {
        // Jika gambar sudah didekode tetapi decode() gagal pada sebagian browser, periksa naturalWidth
      }
    }
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    if (!width || !height) {
      throw new Error('Gambar tidak valid atau gagal dimuat (naturalWidth/naturalHeight = 0).');
    }
    return { drawable: source, width, height, shouldClose: false };
  }

  throw new Error('Tipe sumber gambar tidak didukung. Gunakan File, Blob, HTMLImageElement, atau HTMLCanvasElement.');
}

/**
 * Membuat kanvas 224 x 224 dengan centered letterbox dan padding abu-abu RGB(128, 128, 128).
 *
 * @param {CanvasImageSource} drawable
 * @param {number} srcWidth
 * @param {number} srcHeight
 * @param {Object} [options={}]
 * @param {HTMLCanvasElement} [options.targetCanvas] - Kanvas tujuan opsional (mis. untuk pratinjau di UI).
 * @param {boolean} [options.progressiveDownscale=false] - Jika true, mengecilkan bertahap (x0.5) sebelum ukuran akhir.
 * @returns {{
 *   canvas: HTMLCanvasElement,
 *   geometry: ReturnType<typeof computeLetterboxGeometry>
 * }}
 */
export function renderLetterboxCanvas(drawable, srcWidth, srcHeight, options = {}) {
  const geometry = computeLetterboxGeometry(
    srcWidth,
    srcHeight,
    MODEL_INPUT_WIDTH,
    MODEL_INPUT_HEIGHT
  );

  const canvas = options.targetCanvas || document.createElement('canvas');
  canvas.width = geometry.targetWidth;
  canvas.height = geometry.targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Gagal mendapatkan konteks 2D dari HTMLCanvasElement.');
  }

  // Isi seluruh latar dengan warna abu-abu RGB(128, 128, 128) sesuai spesifikasi training
  ctx.fillStyle = LETTERBOX_PAD_STYLE;
  ctx.fillRect(0, 0, geometry.targetWidth, geometry.targetHeight);

  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }

  let sourceToDraw = drawable;
  let currentW = srcWidth;
  let currentH = srcHeight;

  // Opsional: multi-step progressive downscale jika diaktifkan
  if (options.progressiveDownscale && (currentW > geometry.drawWidth * 2 || currentH > geometry.drawHeight * 2)) {
    const stepCanvas = document.createElement('canvas');
    const stepCtx = stepCanvas.getContext('2d');
    stepCtx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in stepCtx) {
      stepCtx.imageSmoothingQuality = 'high';
    }

    while (currentW * 0.5 > geometry.drawWidth && currentH * 0.5 > geometry.drawHeight) {
      const nextW = Math.max(geometry.drawWidth, Math.round(currentW * 0.5));
      const nextH = Math.max(geometry.drawHeight, Math.round(currentH * 0.5));
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = nextW;
      tempCanvas.height = nextH;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in tempCtx) {
        tempCtx.imageSmoothingQuality = 'high';
      }
      tempCtx.drawImage(sourceToDraw, 0, 0, currentW, currentH, 0, 0, nextW, nextH);
      sourceToDraw = tempCanvas;
      currentW = nextW;
      currentH = nextH;
    }
  }

  ctx.drawImage(
    sourceToDraw,
    0,
    0,
    currentW,
    currentH,
    geometry.offsetX,
    geometry.offsetY,
    geometry.drawWidth,
    geometry.drawHeight
  );

  return { canvas, geometry };
}

/**
 * Mengonversi kanvas 224 x 224 menjadi tensor float32 [1, 224, 224, 3] dengan nilai piksel 0..255.
 * PENTING: Tidak melakukan normalisasi karena Rescaling(1/127.5, offset=-1) sudah ada di dalam model.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} tf - Instance TensorFlow.js (@tensorflow/tfjs).
 * @returns {import('@tensorflow/tfjs').Tensor4D} Tensor float32 [1, 224, 224, 3] pada rentang 0..255.
 */
export function canvasToModelInputTensor(canvas, tf) {
  if (!tf || !tf.browser || typeof tf.browser.fromPixels !== 'function') {
    throw new Error('Instance TensorFlow.js (tf.browser.fromPixels) tidak tersedia.');
  }
  if (!canvas || canvas.width !== MODEL_INPUT_WIDTH || canvas.height !== MODEL_INPUT_HEIGHT) {
    throw new Error(
      `Ukuran kanvas input harus ${MODEL_INPUT_WIDTH}x${MODEL_INPUT_HEIGHT}, diterima: ${canvas?.width}x${canvas?.height}`
    );
  }

  return tf.tidy(() => {
    const rgbUint8 = tf.browser.fromPixels(canvas, 3);
    const rgbFloat255 = rgbUint8.toFloat();
    return rgbFloat255.expandDims(0);
  });
}

/**
 * Fungsi tingkat tinggi untuk melakukan preprocessing penuh dari sumber gambar
 * menjadi kanvas letterbox 224 x 224 dan tensor input model [1, 224, 224, 3] (float32, 0..255).
 *
 * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|ImageBitmap} imageSource
 * @param {Object} tf - Instance TensorFlow.js.
 * @param {Object} [options={}]
 * @param {HTMLCanvasElement} [options.previewCanvas] - Kanvas opsional untuk menampilkan hasil letterbox.
 * @param {boolean} [options.progressiveDownscale=false]
 * @returns {Promise<{
 *   tensor: import('@tensorflow/tfjs').Tensor4D,
 *   canvas: HTMLCanvasElement,
 *   geometry: ReturnType<typeof computeLetterboxGeometry>,
 *   preprocessTimeMs: number
 * }>}
 */
export async function preprocessImageForModel(imageSource, tf, options = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const decoded = await decodeImageSourceWithExif(imageSource);
  try {
    const { canvas, geometry } = renderLetterboxCanvas(
      decoded.drawable,
      decoded.width,
      decoded.height,
      {
        targetCanvas: options.previewCanvas,
        progressiveDownscale: Boolean(options.progressiveDownscale),
      }
    );
    const tensor = canvasToModelInputTensor(canvas, tf);
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      tensor,
      canvas,
      geometry,
      preprocessTimeMs: Number((t1 - t0).toFixed(2)),
    };
  } finally {
    if (decoded.shouldClose && typeof decoded.drawable.close === 'function') {
      decoded.drawable.close();
    }
  }
}

