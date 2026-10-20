# Kontrak API

Dokumentasi interaktif: `/docs` saat backend berjalan.

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Cek status layanan |
| POST | `/api/auth/login` | Login dengan email dan password |
| POST | `/api/auth/register` | Registrasi pelapor |
| GET | `/api/auth/me` | Memvalidasi token dan mengembalikan user aktif |
| POST | `/api/predictions` | Prediksi kategori dari satu foto |
| POST | `/api/reports` | Pelapor mengirim laporan |
| GET | `/api/reports/me` | Pelapor melihat riwayat laporan sendiri |
| GET | `/api/admin/reports` | Admin melihat semua laporan |
| PATCH | `/api/admin/reports/{id}/status` | Admin memperbarui status laporan |

## Autentikasi

Endpoint yang membutuhkan autentikasi menerima header:

```text
Authorization: Bearer <access-token>
```

Login dan registrasi mengembalikan response yang dipakai frontend:

```json
{
  "token": "access-token",
  "user": {
    "id": "uuid-user",
    "role": "reporter"
  }
}
```

Role selalu dibaca dari `public.profiles`, bukan dari input frontend.
Role `admin` hanya dapat diberikan melalui database atau dashboard Supabase.

## Prediksi

Input menggunakan `multipart/form-data` dengan field `photo` (JPEG, PNG, atau
WebP, maksimal `MAX_UPLOAD_MB`).

```json
{ "success": true, "prediction": { "category": "AC", "confidence": 0.92 } }
```

## Laporan

Input `POST /api/reports` menggunakan `multipart/form-data`:

- `photo`: satu JPEG/PNG/WebP, maksimal `MAX_UPLOAD_MB`;
- `location`: lokasi manual, maksimal 255 karakter;
- `description`: deskripsi kerusakan, maksimal 5000 karakter;
- `category`: `AC`, `KURSI`, `LAMPU`, `PROYEKTOR`, atau `LAINNYA`;
- `ai_category`: opsional, hasil prediksi model.

Backend memetakan `category` dari frontend ke kolom database
`final_category`. Response memiliki field `category`, `photo_url`,
`admin_note`, `status`, dan metadata laporan.

Status yang digunakan API:

```text
pending, accepted, rejected, completed
```

Transisi yang diperbolehkan:

```text
pending -> accepted
pending -> rejected
accepted -> completed
```

Transisi lain menghasilkan `409 Conflict`.
