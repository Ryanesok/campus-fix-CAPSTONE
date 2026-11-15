/**
 * @fileoverview Kebijakan evaluasi threshold terpisah untuk CampusFix.
 *
 * Prinsip desain:
 * 1. Logika threshold dipisahkan dari fungsi inferensi model agar nilai threshold
 *    dapat dikonfigurasi tanpa mengubah kode pemuatan model atau inferensi.
 * 2. Empat kandidat threshold eksplorasi (0.50, 0.60, 0.70, 0.80) disediakan
 *    sebagai konstanta konfigurasi. Tidak ada nilai threshold final yang dikunci
 *    secara sepihak sebelum evaluasi pada Calibration Set independen selesai.
 * 3. Skor softmax merupakan keluaran relatif 4 kelas (AC, Kursi, Lampu, Proyektor)
 *    dan BUKAN probabilitas keyakinan yang telah terkalibrasi.
 */

export const FACILITY_CLASS_NAMES = Object.freeze(['AC', 'Kursi', 'Lampu', 'Proyektor']);
export const MANUAL_CATEGORY_OTHER = 'Lainnya';
export const ALLOWED_REPORT_CATEGORIES = Object.freeze([
  ...FACILITY_CLASS_NAMES,
  MANUAL_CATEGORY_OTHER,
]);

/**
 * Empat kandidat threshold yang dieksplorasi sesuai rencana eksperimen.
 */
export const CANDIDATE_THRESHOLDS = Object.freeze([0.50, 0.60, 0.70, 0.80]);

/**
 * Memvalidasi apakah nilai threshold berada pada rentang numerik (0, 1].
 *
 * @param {number|null|undefined} threshold
 * @returns {number|null}
 */
export function validateThresholdValue(threshold) {
  if (threshold === null || threshold === undefined || threshold === '') {
    return null;
  }
  const numeric = Number(threshold);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1) {
    throw new Error(
      `Nilai threshold tidak valid (${threshold}). Gunakan angka pada rentang (0, 1], misalnya 0.50, 0.60, 0.70, atau 0.80.`
    );
  }
  return numeric;
}

/**
 * Mengevaluasi hasil skor prediksi terhadap threshold yang dikonfigurasi.
 *
 * @param {Object} prediction - Objek hasil inferensi dari facility_predictor.
 * @param {string} prediction.predictedCategory - Kategori argmax (AC/Kursi/Lampu/Proyektor).
 * @param {number} prediction.topScore - Skor softmax tertinggi pada rentang [0, 1].
 * @param {Object} [options={}]
 * @param {number|null} [options.threshold=null] - Nilai ambang batas (mis. 0.50, 0.60, 0.70, 0.80).
 * @returns {Object} Hasil evaluasi threshold untuk digunakan oleh antarmuka pengguna (UI).
 */
export function evaluateThreshold(prediction, options = {}) {
  if (!prediction || typeof prediction.topScore !== 'number' || !Number.isFinite(prediction.topScore)) {
    throw new Error('Data prediksi tidak valid untuk evaluasi threshold.');
  }

  const threshold = validateThresholdValue(options.threshold);
  const topScore = prediction.topScore;
  const scorePct = `${(topScore * 100).toFixed(1)}%`;

  if (threshold === null) {
    return {
      thresholdConfigured: false,
      thresholdUsed: null,
      isBelowThreshold: false,
      requiresManualConfirmation: false,
      status: 'no_threshold_configured',
      suggestedCategory: prediction.predictedCategory,
      allowedCategories: ALLOWED_REPORT_CATEGORIES,
      warningMessage: null,
      calibrationDisclaimer:
        'Skor softmax bukan probabilitas keyakinan yang terkalibrasi. Pengguna tetap dapat mengoreksi kategori atau memilih Lainnya secara manual.',
    };
  }

  const isBelowThreshold = topScore < threshold;
  const thresholdPct = `${(threshold * 100).toFixed(0)}%`;

  if (isBelowThreshold) {
    return {
      thresholdConfigured: true,
      thresholdUsed: threshold,
      isBelowThreshold: true,
      requiresManualConfirmation: true,
      status: 'below_threshold_manual_recommended',
      suggestedCategory: prediction.predictedCategory,
      allowedCategories: ALLOWED_REPORT_CATEGORIES,
      warningMessage:
        `Skor prediksi tertinggi (${scorePct} untuk ${prediction.predictedCategory}) berada di bawah ambang batas (${thresholdPct}). ` +
        `Silakan periksa dan pilih kategori fasilitas secara manual, atau pilih "${MANUAL_CATEGORY_OTHER}" jika objek bukan AC, Kursi, Lampu, atau Proyektor.`,
      calibrationDisclaimer:
        'Skor softmax bukan probabilitas keyakinan yang terkalibrasi. Objek di luar 4 kelas tetap memperoleh skor dari model.',
    };
  }

  return {
    thresholdConfigured: true,
    thresholdUsed: threshold,
    isBelowThreshold: false,
    requiresManualConfirmation: false,
    status: 'above_threshold_auto_suggested',
    suggestedCategory: prediction.predictedCategory,
    allowedCategories: ALLOWED_REPORT_CATEGORIES,
    warningMessage: null,
    calibrationDisclaimer:
      'Meskipun skor melewati threshold, pengguna tetap memegang kendali penuh untuk mengonfirmasi atau mengoreksi kategori laporan.',
  };
}

/**
 * Mengevaluasi satu hasil prediksi terhadap seluruh kandidat threshold sekaligus
 * (berguna untuk eksplorasi dan perbandingan kandidat di halaman uji).
 *
 * @param {Object} prediction
 * @param {readonly number[]} [candidates=CANDIDATE_THRESHOLDS]
 * @returns {Array<Object>}
 */
export function evaluateAllCandidateThresholds(prediction, candidates = CANDIDATE_THRESHOLDS) {
  return candidates.map((threshold) => evaluateThreshold(prediction, { threshold }));
}

