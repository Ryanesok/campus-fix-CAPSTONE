# Campus Fix

Aplikasi web responsif untuk melaporkan kerusakan fasilitas kampus. AI mengategorikan jenis fasilitas (AC, Kursi, Lampu, Proyektor) dari foto, admin meninjau laporan, dan pelapor memantau status perbaikan.

## Alur
Login → unggah/ambil foto → kategori otomatis tampil → isi lokasi, deskripsi, koreksi kategori bila perlu → kirim → admin menerima/menolak → admin menandai selesai → pelapor melihat status "Selesai".

## Tech stack
| Komponen | Teknologi |
|---|---|
| Frontend | HTML, CSS, Bootstrap, JavaScript |
| Backend | Python 3.12 + FastAPI |
| Database & Storage | Supabase (PostgreSQL + Storage) |
| AI | scikit-learn |
| ORM / Migrasi | SQLAlchemy / Alembic |
| Pengujian | pytest, Postman |

## Struktur
```
ai/        Modul & model AI terpisah (model/, ai_module/, predictor.py)
backend/   API FastAPI (app/, tests/, alembic/)
frontend/  Antarmuka web
docs/      API, database, integrasi AI, panduan pengembangan
```

Panduan integrasi lengkap untuk frontend dan tim AI tersedia di
[`docs/FRONTEND_AI_HANDOFF.md`](docs/FRONTEND_AI_HANDOFF.md).

## Menjalankan Aplikasi
Jalankan satu perintah berikut di root proyek untuk menyalakan Backend & Frontend sekaligus:
```bat
run.bat
```
Atau jika menggunakan PowerShell:
```powershell
.\run.bat
```
Script ini akan:
- Menjalankan server **Backend API** di `http://127.0.0.1:8000` (docs: `/docs`)
- Menjalankan server **Frontend Web** di `http://127.0.0.1:5500`
- Membuka halaman aplikasi di browser secara otomatis.

## Pengujian Otomatis
Jalankan satu perintah berikut di root proyek untuk menguji seluruh aplikasi:
```bat
test.bat
```
Atau jika menggunakan PowerShell:
```powershell
.\test.bat
```

## Menjalankan backend
```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1   |  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # lalu isi nilainya
uvicorn app.main:app --reload
```
Buka http://127.0.0.1:8000/docs untuk dokumentasi API interaktif, dan jalankan `pytest` untuk pengujian.

## Batasan proyek
- Web responsif saja (bukan aplikasi native); dua peran: Pelapor dan Admin.
- AI hanya mengklasifikasikan jenis fasilitas dari gambar, bukan mendiagnosis kerusakan.
- Kategori dapat dikoreksi pelapor; "Lainnya" dipilih manual.
- Satu laporan = satu foto; lokasi diisi manual (tanpa GPS/peta).
- Tanpa penugasan teknisi, inventaris, QR code, notifikasi WhatsApp/email, chatbot, atau analisis biaya.
