# Backend Handoff untuk Frontend dan AI

Dokumen ini adalah acuan integrasi untuk Campus Fix. Backend berjalan di
`http://127.0.0.1:8000` saat development.

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
