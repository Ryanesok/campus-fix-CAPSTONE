# Integrasi AI

- Model berjalan sebagai modul Python di dalam backend, bukan layanan terpisah.
- Kontrak: kelas dengan metode `predict(image_bytes: bytes) -> Prediction` (lihat `backend/app/ai/classifier.py`).
- Kelas keluaran: `AC`, `KURSI`, `LAMPU`, `PROYEKTOR`. "Lainnya" tidak diprediksi.
- Model dimuat sekali saat aplikasi mulai. Artefak model (`.pkl/.joblib`) tidak masuk Git.
- Yang perlu diserahkan tim AI: artefak model, kode preprocessing, versi library, dan hasil evaluasi.

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
