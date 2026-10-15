# Database (draft)

Supabase PostgreSQL. Identitas login dikelola Supabase Auth (`auth.users`).

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
