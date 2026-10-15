# Kontrak API (draft)

Dokumentasi interaktif: `/docs` (Swagger) saat backend berjalan.

## Sudah tersedia
| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Cek status layanan |
| POST | `/api/predictions` | Prediksi kategori dari satu foto (belum membuat laporan) |

### POST /api/predictions
- Masukan: `multipart/form-data`, field `photo` (JPEG/PNG/WebP, maks. `MAX_UPLOAD_MB`).
- Sukses 200:
```json
{ "success": true, "prediction": { "category": "AC", "confidence": 0.92 } }
```
- Error: `413` (terlalu besar), `415` (bukan gambar yang didukung), `422` (field `photo` tidak ada).
- Saat ini memakai `MockClassifier`; diganti model asli pada Milestone 3.

## Direncanakan
| Method | Path | Peran |
|---|---|---|
| POST | `/api/reports` | Pelapor: kirim laporan (foto, lokasi, deskripsi, kategori final) |
| GET | `/api/reports/me` | Pelapor: riwayat laporan sendiri |
| GET | `/api/admin/reports` | Admin: daftar semua laporan |
| PATCH | `/api/admin/reports/{id}/status` | Admin: `accepted` / `rejected` / `completed` |
