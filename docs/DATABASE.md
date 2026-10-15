# Database

Supabase PostgreSQL. Identitas login dikelola Supabase Auth (`auth.users`).
Skema database dikelola dengan Alembic dari direktori `backend/`.

## Tabel
- `profiles`: `id` (uuid, FK ke `auth.users.id`), `full_name`, `role` (`reporter` | `admin`), `created_at`.
- `reports`: `id` (uuid), `reporter_id` (FK `profiles.id`), `photo_path`, `location`, `description`, `ai_category`, `final_category` (`AC` | `KURSI` | `LAMPU` | `PROYEKTOR` | `LAINNYA`), `status`, `created_at`, `updated_at`.

## Status laporan
`pending` → `accepted` atau `rejected`; `accepted` → `completed`.
"Diterima" berarti disetujui, belum berarti sudah diperbaiki.

## Catatan
- Foto disimpan di Supabase Storage; tabel hanya menyimpan path-nya.
- `ai_category` menyimpan prediksi model, `final_category` pilihan akhir pelapor.
- Skema dibuat lewat migrasi Alembic, bukan manual di dashboard.
- Terapkan migration dari `backend/` dengan `python -m alembic upgrade head`.
- Periksa migration aktif dengan `python -m alembic current`.
- Jangan menjalankan `alembic downgrade` pada database bersama tanpa persetujuan tim.
- RLS aktif pada `profiles` dan `reports`.
- User baru Supabase Auth otomatis dibuatkan profile dengan role `reporter`.
- Hanya admin yang dapat memperbarui status laporan.
- Bucket `report-photos` bersifat private; path foto harus diawali dengan UUID user,
  misalnya `<user-id>/<report-id>.jpg`.
- Policy Storage membatasi akses foto berdasarkan UUID user atau role admin.
