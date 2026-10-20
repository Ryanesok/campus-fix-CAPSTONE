# Frontend
Dikerjakan oleh anggota tim frontend (HTML, CSS, Bootstrap, JavaScript). Berkomunikasi dengan backend hanya lewat REST API (lihat `docs/API.md`). Jangan menyimpan `service_role` key di sini.

## Environment

Frontend hanya membutuhkan konfigurasi publik:

```text
BACKEND_API_URL=http://127.0.0.1:8000
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Jika frontend memakai Vite, gunakan prefix `VITE_` untuk ketiga variabel.
Jika memakai Next.js, gunakan prefix `NEXT_PUBLIC_`. Jangan memasukkan
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, atau password database ke frontend.

Lihat [`docs/FRONTEND_AI_HANDOFF.md`](../docs/FRONTEND_AI_HANDOFF.md) untuk
kontrak endpoint, autentikasi, upload foto, dan integrasi AI.
