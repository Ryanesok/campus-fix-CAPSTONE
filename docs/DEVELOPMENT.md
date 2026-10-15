# Panduan Pengembangan

1. Siapkan Python 3.12 dan buat virtual environment di `backend/`.
2. `pip install -r requirements.txt`, salin `.env.example` ke `.env`.
3. Jalankan `uvicorn app.main:app --reload`.
4. Jalankan `pytest` sebelum membuat pull request.
5. Perubahan skema database selalu lewat Alembic.
