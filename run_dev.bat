@echo off
TITLE Campus Fix - Development Server Runner
echo ========================================
echo Memulai Backend (FastAPI + AI Model) dan Frontend (Static Server)...
echo ========================================

echo [1/2] Menjalankan Backend Uvicorn di http://127.0.0.1:8000 ...
start cmd /k "cd backend && ..\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"

echo [2/2] Menjalankan Frontend Server di http://localhost:5500 ...
start cmd /k "python -m http.server 5500 --directory frontend"

echo.
echo ========================================
echo Semua layanan berhasil dijalankan di terminal terpisah!
echo - Backend API ^& Docs: http://127.0.0.1:8000/docs
echo - Frontend Web App:   http://localhost:5500
echo ========================================
pause
