/**
 * @fileoverview Pengelola siklus hidup (lifecycle) pemuatan model TensorFlow.js GraphModel CampusFix.
 *
 * Mendukung dua mode pemuatan dependency dengan satu implementasi modul inti:
 * 1. Vanilla ES Modules di browser melalui <script type="importmap"> (CDN).
 * 2. NPM Bundler (Vite, Webpack, Rollup, dsb.) melalui `import * as tf from '@tensorflow/tfjs'`.
 *
 * Mengelola caching instance model agar tidak dimuat berulang kali setiap kali
 * pengguna memilih foto baru, serta menyediakan warm-up opsional dan pelepasan memori.
 */

import * as tfNamespace from '@tensorflow/tfjs';
import { MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT } from '../preprocessing/image_preprocessor.js';

export const DEFAULT_MODEL_URL = '/frontend/model/tfjs_graph_model/model.json';

/**
 * Menyelesaikan objek runtime TensorFlow.js baik dari ESM namespace, default export,
 * injeksi parameter, maupun fallback global window.tf.
 *
 * @param {Object} [customTf]
 * @returns {Object} Instance TensorFlow.js yang aktif.
 */
export function resolveTfRuntime(customTf = null) {
  if (customTf && typeof customTf.loadGraphModel === 'function') {
    return customTf;
  }
  if (tfNamespace && typeof tfNamespace.loadGraphModel === 'function') {
    return tfNamespace
  }
  if (tfNamespace && tfNamespace.default && typeof tfNamespace.default.loadGraphModel === 'function') {
    return tfNamespace.default;
  }
  if (typeof globalThis !== 'undefined' && globalThis.tf && typeof globalThis.tf.loadGraphModel === 'function') {
    return globalThis.tf;
  }
  throw new Error(
    'Runtime TensorFlow.js (@tensorflow/tfjs) tidak ditemukan. Pastikan importmap CDN atau paket npm @tensorflow/tfjs sudah terpasang.'
  );
}

// State singleton untuk menyimpan model yang sudah dimuat di memori browser
let cachedModel = null;
let cachedModelUrl = null;
let loadingPromise = null;
let lastLoadStats = null;

/**
 * Mengembalikan status pemuatan model saat ini.
 *
 * @returns {{
 *   isLoaded: boolean,
 *   isLoading: boolean,
 *   modelUrl: string|null,
 *   loadStats: Object|null
 * }}
 */
export function getModelStatus() {
  return {
    isLoaded: cachedModel !== null,
    isLoading: loadingPromise !== null,
    modelUrl: cachedModelUrl,
    loadStats: lastLoadStats ? { ...lastLoadStats } : null,
  };
}

/**
 * Memuat TensorFlow.js GraphModel dengan caching singleton dan warm-up opsional.
 *
 * @param {Object} [options={}]
 * @param {string} [options.modelUrl=DEFAULT_MODEL_URL] - URL menuju model.json.
 * @param {boolean} [options.forceReload=false] - Paksa muat ulang meskipun sudah ada di cache.
 * @param {boolean} [options.warmUp=true] - Jalankan inferensi dummy [1,224,224,3] untuk kompilasi shader WebGL.
 * @param {Function} [options.onProgress] - Callback progress pemuatan (fractions 0..1).
 * @param {Object} [options.tf] - Instance TensorFlow.js opsional.
 * @returns {Promise<{
 *   model: import('@tensorflow/tfjs').GraphModel,
 *   stats: {
 *     modelUrl: string,
 *     backend: string,
 *     tfjsVersion: string,
 *     loadTimeMs: number,
 *     warmUpTimeMs: number,
 *     fromCache: boolean
 *   }
 * }>}
 */
export async function loadFacilityModel(options = {}) {
  const tf = resolveTfRuntime(options.tf);
  const modelUrl = options.modelUrl || DEFAULT_MODEL_URL;
  const forceReload = Boolean(options.forceReload);
  const shouldWarmUp = options.warmUp !== false;

  if (!forceReload && cachedModel && cachedModelUrl === modelUrl) {
    return {
      model: cachedModel,
      stats: {
        ...lastLoadStats,
        fromCache: true,
      },
    };
  }

  // Cegah pemuatan ganda bersamaan (concurrent requests) untuk URL yang sama
  if (!forceReload && loadingPromise && cachedModelUrl === modelUrl) {
    return loadingPromise;
  }

  if (forceReload && cachedModel) {
    disposeFacilityModel();
  }

  cachedModelUrl = modelUrl;

  loadingPromise = (async () => {
    try {
      if (typeof tf.ready === 'function') {
        await tf.ready();
      }

      const tLoadStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const loadOptions = {};
      if (typeof options.onProgress === 'function') {
        loadOptions.onProgress = options.onProgress;
      }

      const model = await tf.loadGraphModel(modelUrl, loadOptions);
      const tLoadEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const loadTimeMs = Number((tLoadEnd - tLoadStart).toFixed(2));

      let warmUpTimeMs = 0;
      if (shouldWarmUp) {
        const tWarmStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const dummyInput = tf.zeros([1, MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH, 3], 'float32');
        let dummyOut = null;
        try {
          if (typeof model.execute === 'function') {
            dummyOut = model.execute(dummyInput);
          } else {
            dummyOut = await model.executeAsync(dummyInput);
          }
          const outTensor = Array.isArray(dummyOut)
            ? dummyOut[0]
            : dummyOut && typeof dummyOut.data !== 'function'
            ? Object.values(dummyOut)[0]
            : dummyOut;
          if (outTensor && typeof outTensor.data === 'function') {
            await outTensor.data();
          }
        } finally {
          dummyInput.dispose();
          if (dummyOut) {
            tf.dispose(dummyOut);
          }
        }
        const tWarmEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        warmUpTimeMs = Number((tWarmEnd - tWarmStart).toFixed(2));
      }

      cachedModel = model;
      lastLoadStats = {
        modelUrl,
        backend: typeof tf.getBackend === 'function' ? tf.getBackend() : 'unknown',
        tfjsVersion: tf.version?.tfjs || tf.version_core || 'unknown',
        loadTimeMs,
        warmUpTimeMs,
        fromCache: false,
      };

      return {
        model: cachedModel,
        stats: { ...lastLoadStats },
      };
    } catch (err) {
      cachedModel = null;
      cachedModelUrl = null;
      lastLoadStats = null;
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Gagal memuat model TensorFlow.js dari "${modelUrl}": ${reason}`);
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Melepaskan model dari memori browser dan mengosongkan cache singleton.
 */
export function disposeFacilityModel() {
  if (cachedModel && typeof cachedModel.dispose === 'function') {
    cachedModel.dispose();
  }
  cachedModel = null;
  cachedModelUrl = null;
  lastLoadStats = null;
  loadingPromise = null;
}

