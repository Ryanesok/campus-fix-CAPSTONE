# Kontrak API

Dokumentasi interaktif: `/docs` (Swagger) saat backend berjalan.

## Sudah tersedia
| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Cek status layanan |
| GET | `/api/auth/me` | Memvalidasi Bearer token dan mengembalikan user aktif |
| POST | `/api/predictions` | Prediksi kategori dari satu foto (belum membuat laporan) |

### Autentikasi

Endpoint yang membutuhkan autentikasi menerima header:

```text
Authorization: Bearer <access-token-supabase>
```

`/api/auth/me` mengembalikan role dari `public.profiles`, bukan dari input
frontend. Token diverifikasi melalui Supabase Auth.

### POST /api/predictions
- Masukan: `multipart/form-data`, field `photo` (JPEG/PNG/WebP, maks. `MAX_UPLOAD_MB`).
- Sukses 200:
```json
{ "success": true, "prediction": { "category": "AC", "confidence": 0.92 } }
```
- Error: `413` (terlalu besar), `415` (bukan gambar yang didukung), `422` (field `photo` tidak ada).
- Saat ini memakai `MockClassifier`; diganti model asli pada Milestone 3.

## Laporan
| Method | Path | Peran |
|---|---|---|
| POST | `/api/reports` | User terautentikasi: kirim laporan (foto, lokasi, deskripsi, kategori) |
| GET | `/api/reports/me` | Pelapor: riwayat laporan sendiri |
| GET | `/api/admin/reports` | Admin: daftar semua laporan |
| PATCH | `/api/admin/reports/{id}/status` | Admin: `accepted` / `rejected` / `completed` |

### POST /api/reports

Masukan menggunakan `multipart/form-data`:

- `photo`: satu JPEG/PNG/WebP, maksimal `MAX_UPLOAD_MB`.
- `location`: lokasi manual, maksimal 255 karakter.
- `description`: deskripsi kerusakan, maksimal 5000 karakter.
- `final_category`: `AC`, `KURSI`, `LAMPU`, `PROYEKTOR`, atau `LAINNYA`.
- `ai_category`: opsional, hasil prediksi model.

Foto disimpan sebagai objek private dengan path `<user-id>/<report-id>.<ext>`.
Response awal memiliki status `pending`.

### Status laporan

Transisi yang diperbolehkan:

```text
pending -> accepted
pending -> rejected
accepted -> completed
```

Transisi lain menghasilkan `409 Conflict`.
