// CampusFix — contoh inferensi browser dengan @tensorflow/tfjs
// Syarat: tfjs_graph_model/model.json + *.bin berhasil dikonversi & di-host oleh web.
// Jalankan setelah instalasi: npm install @tensorflow/tfjs
import * as tf from '@tensorflow/tfjs';
const MODEL_BASE = '/models/campusfix'; // Sesuaikan dengan folder public di frontend
const CLASS_NAMES = ['AC', 'Kursi', 'Lampu', 'Proyektor'];

export async function loadCampusFixModel() {
  return await tf.loadGraphModel(`${MODEL_BASE}/model.json`);
}

function makeCanvasFromImage(img) {
  // img: HTMLImageElement yang sudah dimuat (await img.decode()).
  // Pastikan browser memperlakukan orientasi EXIF seperti pada data preparation.
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, 224, 224);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('Ukuran foto tidak valid');
  const s = Math.min(224 / w, 224 / h);
  const tw = w * s, th = h * s;
  ctx.drawImage(img, (224 - tw) / 2, (224 - th) / 2, tw, th);
  return canvas;
}

export async function predictFacility(model, img) {
  const canvas = makeCanvasFromImage(img);
  // Input float32 pada rentang 0..255; model yang melakukan normalisasi [-1,1].
  const input = tf.tidy(() => tf.browser.fromPixels(canvas, 3).toFloat().expandDims(0));
  let result;
  try {
    result = await model.executeAsync(input);
    const tensor = Array.isArray(result) ? result[0] :
      ((result && typeof result.data !== 'function') ? Object.values(result)[0] : result);
    const scores = Array.from(await tensor.data());
    if (scores.length !== 4) throw new Error(`Skor output tak sesuai: ${scores.length}`);
    const index = scores.indexOf(Math.max(...scores));
    return { category: CLASS_NAMES[index], scores, softmaxScore: scores[index] };
  } finally {
    input.dispose();
    if (result) tf.dispose(result);
  }
}
// Penting: pengguna dapat mengoreksi kategori. Tambahkan kategori manual "Lainnya".
// Softmax score bukan ukuran kepercayaan yang terkalibrasi.
