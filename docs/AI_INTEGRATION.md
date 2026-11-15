# Integrasi AI

- Model berjalan sebagai modul Python di dalam backend (`backend/app/ai/`), bukan layanan terpisah.
- Kontrak: `TfGraphModelClassifier.predict_raw(image_bytes: bytes) -> RawInferenceResult` di `backend/app/ai/classifier.py`, dievaluasi melalui `apply_prediction_policy` di `backend/app/ai/policy.py` (ambang batas default `0.70`).
- Kelas keluaran: `AC`, `KURSI`, `LAMPU`, `PROYEKTOR`. "Lainnya" tidak diprediksi.
- Model TensorFlow `SavedModel` (`backend/app/ai/model/CampusFix_Integration_Bundle/saved_model/`) dimuat sekali saat aplikasi mulai (`loader.py`).
- Yang perlu diserahkan tim AI: artefak `SavedModel` + kontrak JSON, kode preprocessing (`EXIF` + letterbox `224x224` `RGB(128, 128, 128)`, `0..255` tanpa `/255`), versi library (`tensorflow-cpu`, `Pillow`, `numpy`), kalibrasi threshold (`0.70`), dan hasil evaluasi foto lapangan.

## Kontrak rinci

Model menerima bytes gambar JPEG, PNG, atau WebP yang sudah lolos validasi
backend. Preprocessing (resize, normalisasi, ekstraksi fitur, dan konversi
warna jika diperlukan) menjadi tanggung jawab classifier.

Model harus mengembalikan:

```python
Prediction(category=FacilityCategory.LAMPU, confidence=0.92)
```

Confidence harus berada pada rentang `0.0` sampai `1.0`. `LAINNYA` hanya
tersedia sebagai pilihan manual pada laporan dan bukan keluaran model.

Lihat [`FRONTEND_AI_HANDOFF.md`](FRONTEND_AI_HANDOFF.md) untuk contoh request,
response, alur frontend, dan daftar informasi yang harus diserahkan tim AI.
