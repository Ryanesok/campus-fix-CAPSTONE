# Panduan Kontribusi

## Branch
- `main`: selalu dalam kondisi berjalan.
- Fitur baru: `feat/<nama>`, perbaikan: `fix/<nama>`, dokumentasi: `docs/<nama>`.

## Commit
Format sederhana: `feat: add report endpoint`, `fix: validate uploaded image`, `docs: update setup guide`.

## Pull request
Gunakan template PR. Perubahan yang menyentuh kontrak API atau skema database harus ditinjau anggota lain.

## Rahasia
Jangan commit `.env`, kunci Supabase (terutama `service_role`), model `.pkl/.joblib`, atau dataset.
