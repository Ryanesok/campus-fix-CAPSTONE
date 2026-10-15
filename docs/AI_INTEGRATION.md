# Integrasi AI

- Model berjalan sebagai modul Python di dalam backend, bukan layanan terpisah.
- Kontrak: kelas dengan metode `predict(image_bytes: bytes) -> Prediction` (lihat `backend/app/ai/classifier.py`).
- Kelas keluaran: `AC`, `KURSI`, `LAMPU`, `PROYEKTOR`. "Lainnya" tidak diprediksi.
- Model dimuat sekali saat aplikasi mulai. Artefak model (`.pkl/.joblib`) tidak masuk Git.
- Yang perlu diserahkan tim AI: artefak model, kode preprocessing, versi library, dan hasil evaluasi.
