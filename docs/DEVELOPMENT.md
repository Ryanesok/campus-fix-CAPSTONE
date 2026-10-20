# Panduan Pengembangan

1. Siapkan Python 3.12 dan buat virtual environment di `backend/`.
2. `pip install -r requirements.txt`, salin `.env.example` ke `.env`.
3. Pastikan `DATABASE_URL` menunjuk ke database Supabase yang benar.
4. Jalankan migration dengan `python -m alembic upgrade head`.
5. Jalankan `uvicorn app.main:app --reload`.
6. Jalankan `pytest` sebelum membuat pull request.
7. Perubahan skema database selalu lewat Alembic.

## Supabase setelah setup awal

Migration kedua mengaktifkan RLS, policy Storage, dan trigger profile otomatis.
Pastikan bucket `report-photos` sudah dibuat sebagai bucket private dengan MIME
`image/jpeg`, `image/png`, dan `image/webp`, serta batas 5 MB.
Endpoint pembuatan laporan menggunakan `SUPABASE_SERVICE_ROLE_KEY` hanya di
backend untuk menyimpan foto ke bucket private. Jangan pernah memasukkan key ini
ke frontend atau commit ke repository.

Untuk membuat admin pertama:

1. Buat user melalui Authentication > Users atau alur sign-up aplikasi.
2. Salin UUID user tersebut.
3. Jalankan SQL berikut di Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = '<UUID_USER_ADMIN>';
```

Jangan memberi role admin berdasarkan input dari frontend. Perubahan role hanya
boleh dilakukan oleh anggota tim yang berwenang melalui database/dashboard.

## Menjalankan frontend terintegrasi

Dengan backend tetap berjalan pada port `8000`, buka terminal kedua:

```powershell
Set-Location G:\project\Web\campus-fix-CAPSTONE\frontend
python -m http.server 5500
```

Buka `http://127.0.0.1:5500`. Jalankan migration terbaru dengan
`python -m alembic upgrade head` agar kolom `reports.admin_note` tersedia.
