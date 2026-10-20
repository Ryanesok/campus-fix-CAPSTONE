# Backend Handoff untuk Frontend dan AI

Dokumen ini adalah acuan integrasi untuk Campus Fix. Backend berjalan di
`http://127.0.0.1:8000` saat development.

## Environment variables

### Frontend

Frontend membutuhkan hanya nilai publik berikut:

```env
BACKEND_API_URL=http://127.0.0.1:8000
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=publishable-or-anon-key
```

Nama variabel harus mengikuti framework frontend:

- Vite: `VITE_BACKEND_API_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`.
- Next.js: `NEXT_PUBLIC_BACKEND_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- HTML/JavaScript tanpa bundler: jangan membuat `.env` yang dibaca browser;
  gunakan konfigurasi runtime atau file konfigurasi publik yang tidak berisi
  secret.

Nilai `SUPABASE_URL` dan anon/publishable key memang boleh berada di frontend.
Keduanya bukan secret. Namun, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, dan
password database tidak boleh pernah berada di frontend.

Contoh `.env.example` untuk frontend berbasis Vite:

```env
VITE_BACKEND_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=
```

File `.env` frontend tetap harus di-ignore Git. Commit hanya `.env.example`.

### Backend

Backend menggunakan environment di
[`backend/.env.example`](../backend/.env.example):

```env
APP_ENV=development
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=report-photos
DATABASE_URL=postgresql+psycopg://...
MAX_UPLOAD_MB=5
```

`SUPABASE_SERVICE_ROLE_KEY` hanya digunakan oleh backend untuk Storage private.
Jangan menyalin file backend `.env` ke frontend.

### AI

Model AI berjalan di dalam backend, bukan di browser. Karena itu tim AI tidak
perlu mengelola Supabase key atau database credential. Minimal, tim AI perlu
menyerahkan:

- artefak model;
- preprocessing;
- versi Python dan library;
- ukuran input;
- mapping label;
- confidence;
- metrik evaluasi.

Lokasi model yang diharapkan:

```text
backend/app/ai/models/
```

Folder tersebut di-ignore Git. Jika implementasi classifier membutuhkan
konfigurasi runtime seperti lokasi file model, tambahkan variabel backend
seperti `AI_MODEL_PATH` ke `backend/.env.example`; jangan membuat env AI yang
berisi credential Supabase.

## Menjalankan backend

```powershell
Set-Location G:\project\Web\campus-fix-CAPSTONE\backend
C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --reload
```

Dokumentasi interaktif tersedia di `http://127.0.0.1:8000/docs`.

## Autentikasi

Login dilakukan melalui Supabase Auth. Setelah login, frontend memperoleh
`access_token`. Token tersebut harus dikirim ke endpoint yang dilindungi:

```http
Authorization: Bearer <access_token>
```

Jangan mengirim `SUPABASE_SERVICE_ROLE_KEY` ke browser. Frontend hanya boleh
menggunakan Supabase URL dan anon/publishable key.

### Memeriksa user aktif

```http
GET /api/auth/me
```

Response:

```json
{
  "id": "uuid-user",
  "role": "reporter"
}
```

Nilai role hanya `reporter` atau `admin` dan ditentukan dari database backend.

## Alur frontend

1. Login melalui Supabase Auth.
2. Simpan session Supabase di state aplikasi.
3. Kirim access token pada request backend.
4. Kirim foto ke `POST /api/predictions`.
5. Tampilkan kategori dan confidence.
6. Biarkan pelapor mengoreksi kategori, termasuk memilih `LAINNYA`.
7. Kirim form final ke `POST /api/reports`.
8. Tampilkan status dari `GET /api/reports/me`.
9. Admin menggunakan endpoint `/api/admin/*`.

Untuk request `multipart/form-data`, jangan menetapkan header
`Content-Type` secara manual; browser akan membuat multipart boundary.

## Endpoint prediksi AI

```http
POST /api/predictions
Content-Type: multipart/form-data
```

Field:

```text
photo: JPEG, PNG, atau WebP; maksimum 5 MB
```

Response:

```json
{
  "success": true,
  "prediction": {
    "category": "LAMPU",
    "confidence": 0.92
  }
}
```

Kategori yang boleh dikembalikan model:

```text
AC
KURSI
LAMPU
PROYEKTOR
```

`LAINNYA` tidak boleh dikembalikan model. Kategori tersebut hanya dipilih
secara manual oleh pelapor pada form laporan.

## Endpoint laporan

### Membuat laporan

```http
POST /api/reports
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Field:

```text
photo: file JPEG, PNG, atau WebP; maksimum 5 MB
location: teks wajib, maksimum 255 karakter
description: teks wajib, maksimum 5000 karakter
final_category: AC | KURSI | LAMPU | PROYEKTOR | LAINNYA
ai_category: AC | KURSI | LAMPU | PROYEKTOR (opsional)
```

`final_category` adalah pilihan akhir pelapor. `ai_category` adalah hasil
prediksi sebelum koreksi dan boleh dikosongkan jika prediksi tidak tersedia.

Response `201 Created`:

```json
{
  "id": "uuid-report",
  "reporter_id": "uuid-user",
  "photo_path": "uuid-user/uuid-report.jpg",
  "location": "Gedung A - Ruang 101",
  "description": "Lampu tidak menyala",
  "ai_category": "LAMPU",
  "final_category": "LAMPU",
  "status": "pending",
  "created_at": "2026-10-15T00:00:00Z",
  "updated_at": "2026-10-15T00:00:00Z"
}
```

Foto disimpan di bucket Supabase Storage private. `photo_path` bukan URL
publik dan tidak boleh langsung ditempelkan ke elemen `<img>`.

### Riwayat pelapor

```http
GET /api/reports/me
Authorization: Bearer <access_token>
```

Response berupa array laporan milik user aktif.

### Daftar laporan admin

```http
GET /api/admin/reports
Authorization: Bearer <admin_access_token>
```

Hanya user dengan role `admin` yang dapat mengakses endpoint ini.

### Mengubah status

```http
PATCH /api/admin/reports/{report_id}/status
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

Body:

```json
{
  "status": "accepted"
}
```

Transisi yang valid:

```text
pending -> accepted
pending -> rejected
accepted -> completed
```

Transisi lain menghasilkan `409 Conflict`.

## Status HTTP umum

| Status | Arti |
|---|---|
| `201` | Laporan berhasil dibuat |
| `401` | Token tidak ada, tidak valid, atau kedaluwarsa |
| `403` | Role tidak memiliki akses |
| `409` | Transisi status tidak valid |
| `413` | Foto melebihi 5 MB |
| `415` | Format atau isi foto tidak didukung |
| `422` | Field request tidak valid atau tidak lengkap |
| `502` | Upload Storage gagal |
| `503` | Konfigurasi Storage backend belum tersedia |

## Kontrak untuk tim AI

Backend mengharapkan implementasi yang memenuhi:

```python
class ImageClassifier(Protocol):
    def predict(self, image_bytes: bytes) -> Prediction: ...
```

Implementasi model harus:

- Menerima bytes gambar asli.
- Melakukan preprocessing di dalam classifier.
- Mengembalikan satu dari empat kategori model.
- Mengembalikan confidence antara `0.0` dan `1.0`, atau `None` jika model
  tidak menyediakan confidence.
- Tidak melatih model atau memuat ulang model pada setiap request.

Tim AI perlu menyerahkan:

- artefak model `.pkl` atau `.joblib`;
- kode preprocessing yang sama dengan saat training;
- versi Python dan library;
- ukuran/resolusi input;
- mapping label;
- contoh prediksi;
- metrik evaluasi.

Artefak model dan dataset tidak boleh di-commit tanpa kesepakatan tim.
Implementasi model menggantikan `MockClassifier` di
`backend/app/ai/classifier.py`, tetapi response API harus tetap sama.

## CORS development

Tambahkan origin frontend lokal ke `CORS_ORIGINS` di `backend/.env`, misalnya:

```env
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

Setelah mengubah `.env`, restart Uvicorn.
