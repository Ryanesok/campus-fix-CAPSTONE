@echo off
setlocal

echo ===================================================
echo           CampusFix - Start Application
echo ===================================================
echo.

:: 1. Validasi Python Virtual Environment
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment .venv tidak ditemukan di root!
    echo Harap buat atau aktifkan virtual environment terlebih dahulu.
    echo.
    pause
    exit /b 1
)

:: 2. Jalankan Backend (FastAPI di Port 8000)
echo [1/2] Menjalankan Server Backend di http://127.0.0.1:8000 ...
start "CampusFix - Backend API" cmd /k "title CampusFix Backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000"

:: 3. Jalankan Frontend (HTTP Server di Port 5500)
echo [2/2] Menjalankan Server Frontend di http://127.0.0.1:5500 ...
start "CampusFix - Frontend Web" cmd /k "title CampusFix Frontend && .\.venv\Scripts\python.exe -m http.server 5500 --directory frontend"

:: 4. Buka Browser Otomatis
echo.
echo Membuka aplikasi di browser...
timeout /t 2 /nobreak >nul
start http://127.0.0.1:5500

echo.
echo ===================================================
echo Aplikasi CampusFix Berhasil Dijalankan!
echo ---------------------------------------------------
echo  - Frontend Web UI : http://127.0.0.1:5500
echo  - Backend API     : http://127.0.0.1:8000
echo  - API Docs        : http://127.0.0.1:8000/docs
echo ===================================================
echo.
echo Catatan: Untuk menghentikan aplikasi, tutup jendela
echo console Backend dan Frontend yang baru terbuka.
echo.
pause
