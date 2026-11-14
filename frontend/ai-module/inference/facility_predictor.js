/**
 * @fileoverview Modul inferensi kategori fasilitas kampus untuk browser.
 *
 * Mengintegrasikan preprocessing gambar (224x224 RGB letterbox 0..255),
 * eksekusi model TensorFlow.js GraphModel, manajemen memori tensor,
 * dan evaluasi kebijakan threshold yang terpisah.
 */

import { resolveTfRuntime, loadFacilityModel } from '../model/model_loader.js';
import {
  preprocessImageForModel,
  canvasToModelInputTensor,
} from '../preprocessing/image_preprocessor.js';
import {
  FACILITY_CLASS_NAMES,
  ALLOWED_REPORT_CATEGORIES,
  evaluateThreshold,
  evaluateAllCandidateThresholds,
} from './threshold_policy.js';

/**
 * Mengekstrak tensor keluaran tunggal dari hasil execute / executeAsync GraphModel.
 *
 * @param {any} rawResult
 * @returns {import('@tensorflow/tfjs').Tensor}
 */
function extractOutputTensor(rawResult) {
  if (!rawResult) {
    throw new Error('Model tidak mengembalikan tensor keluaran.');
  }
  if (Array.isArray(rawResult)) {
    return rawResult[0];
  }
  if (typeof rawResult.data === 'function') {
    return rawResult;
  }
  const values = Object.values(rawResult);
  if (values.length > 0 && typeof values[0]?.data === 'function') {
    return values[0];
  }
  throw new Error('Format tensor keluaran GraphModel tidak dikenali.');
}

/**
 * Menjalankan inferensi pada tensor input [1, 224, 224, 3] (float32, 0..255)
 * dan mengembalikan rincian skor keempat kelas beserta metrik waktu dan memori.
 *
 * @param {import('@tensorflow/tfjs').GraphModel} model
 * @param {import('@tensorflow/tfjs').Tensor4D} inputTensor - Tensor [1, 224, 224, 3] (float32, 0..255).
 * @param {Object} [options={}]
 * @param {number|null} [options.threshold=null] - Ambang batas opsional (mis. 0.50, 0.60, 0.70, 0.80).
 * @param {Object} [options.tf] - Instance TensorFlow.js opsional.
 * @returns {Promise<Object>}
 */
export async function runModelInferenceOnTensor(model, inputTensor, options = {}) {
  const tf = resolveTfRuntime(options.tf);
  if (!model || (typeof model.execute !== 'function' && typeof model.executeAsync !== 'function')) {
    throw new Error('Instance GraphModel tidak valid atau belum dimuat.');
  }
  if (!inputTensor || !Array.isArray(inputTensor.shape) || inputTensor.shape.length !== 4) {
    throw new Error(`Tensor input harus berdimensi 4 [1, 224, 224, 3], diterima: ${inputTensor?.shape}`);
  }

  let rawResult = null;
  const tStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    // Gunakan execute sinkron bila tersedia (karena MobileNetV2 tidak memiliki op alur kontrol async),
    // atau fallback ke executeAsync.
    if (typeof model.execute === 'function') {
      rawResult = model.execute(inputTensor);
    } else {
      rawResult = await model.executeAsync(inputTensor);
    }

    const outTensor = extractOutputTensor(rawResult);
    const rawScores = Array.from(await outTensor.data());
    const tEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const inferenceTimeMs = Number((tEnd - tStart).toFixed(2));

    if (rawScores.length !== FACILITY_CLASS_NAMES.length) {
      throw new Error(
        `Jumlah skor keluaran (${rawScores.length}) tidak sesuai dengan jumlah kelas (${FACILITY_CLASS_NAMES.length}).`
      );
    }
    if (!rawScores.every((v) => Number.isFinite(v))) {
      throw new Error('Skor keluaran model mengandung nilai NaN atau Infinity.');
    }

    // Urutkan indeks dari skor tertinggi ke terendah
    const rankedIndices = rawScores
      .map((score, index) => ({ index, className: FACILITY_CLASS_NAMES[index], score }))
      .sort((a, b) => b.score - a.score);

    const top1 = rankedIndices[0];
    const top2 = rankedIndices[1];
    const margin = Number((top1.score - top2.score).toFixed(6));

    const scoresByClass = {};
    FACILITY_CLASS_NAMES.forEach((name, idx) => {
      scoresByClass[name] = rawScores[idx];
    });

    const basePrediction = {
      predictedCategory: top1.className,
      predictedIndex: top1.index,
      topScore: top1.score,
      topScorePercentage: `${(top1.score * 100).toFixed(1)}%`,
      runnerUpCategory: top2.className,
      runnerUpScore: top2.score,
      margin,
      scores: rawScores,
      scoresByClass,
      rankedPredictions: rankedIndices,
      classNames: FACILITY_CLASS_NAMES,
      allowedReportCategories: ALLOWED_REPORT_CATEGORIES,
      inferenceTimeMs,
    };

    const thresholdEvaluation = evaluateThreshold(basePrediction, {
      threshold: options.threshold ?? null,
    });
    const candidateEvaluations = evaluateAllCandidateThresholds(basePrediction);

    return {
      ...basePrediction,
      thresholdEvaluation,
      candidateEvaluations,
      memoryInfo: typeof tf.memory === 'function' ? tf.memory() : null,
    };
  } finally {
    if (rawResult) {
      tf.dispose(rawResult);
    }
  }
}

/**
 * Fungsi lengkap untuk memprediksi kategori fasilitas dari sumber gambar
 * (File, Blob, HTMLImageElement, HTMLCanvasElement, atau ImageBitmap).
 *
 * Menjamin tensor input selalu dibersihkan (dispose) di blok finally.
 *
 * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|ImageBitmap} imageSource
 * @param {Object} [options={}]
 * @param {import('@tensorflow/tfjs').GraphModel} [options.model] - Model yang sudah dimuat (jika kosong, otomatis memanggil loadFacilityModel).
 * @param {string} [options.modelUrl] - URL model.json jika model belum dimuat.
 * @param {number|null} [options.threshold=null] - Nilai threshold opsional (mis. 0.50, 0.60, 0.70, 0.80).
 * @param {HTMLCanvasElement} [options.previewCanvas] - Kanvas opsional untuk menampilkan hasil letterbox 224x224.
 * @param {boolean} [options.progressiveDownscale=false]
 * @param {Object} [options.tf] - Instance TensorFlow.js opsional.
 * @returns {Promise<Object>}
 */
export async function predictFacilityFromImage(imageSource, options = {}) {
  const tf = resolveTfRuntime(options.tf);
  let activeModel = options.model || null;
  let loadStats = null;

  if (!activeModel) {
    const loaded = await loadFacilityModel({
      modelUrl: options.modelUrl,
      tf,
    });
    activeModel = loaded.model;
    loadStats = loaded.stats;
  }

  const prep = await preprocessImageForModel(imageSource, tf, {
    previewCanvas: options.previewCanvas,
    progressiveDownscale: options.progressiveDownscale,
  });

  try {
    const prediction = await runModelInferenceOnTensor(activeModel, prep.tensor, {
      threshold: options.threshold ?? null,
      tf,
    });

    return {
      ...prediction,
      preprocessTimeMs: prep.preprocessTimeMs,
      totalTimeMs: Number((prep.preprocessTimeMs + prediction.inferenceTimeMs).toFixed(2)),
      letterboxGeometry: prep.geometry,
      letterboxCanvas: prep.canvas,
      modelLoadStats: loadStats,
    };
  } finally {
    prep.tensor.dispose();
  }
}

/**
 * Menjalankan prediksi dari kanvas 224x224 yang sudah di-letterbox sebelumnya.
 *
 * @param {import('@tensorflow/tfjs').GraphModel} model
 * @param {HTMLCanvasElement} letterboxCanvas
 * @param {Object} [options={}]
 * @returns {Promise<Object>}
 */
export async function predictFacilityFromLetterboxCanvas(model, letterboxCanvas, options = {}) {
  const tf = resolveTfRuntime(options.tf);
  const inputTensor = canvasToModelInputTensor(letterboxCanvas, tf);
  try {
    return await runModelInferenceOnTensor(model, inputTensor, options);
  } finally {
    inputTensor.dispose();
  }
}

