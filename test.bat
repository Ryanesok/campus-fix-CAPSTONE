@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo        CampusFix - Automated Test Suite
echo ===================================================
echo.

:: 1. Cek Virtual Environment
echo [1/3] Memeriksa Virtual Environment Python...
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment .venv tidak ditemukan di root!
    echo Jalankan setup venv terlebih dahulu.
    exit /b 1
)
echo [OK] Python venv ditemukan.
echo.

:: 2. Uji Modul AI Backend (backend/app/ai)
echo [2/3] Menguji Modul AI (backend/app/ai)...
set "PYTHONPATH=%~dp0backend"
.venv\Scripts\python.exe -c "import io; from PIL import Image; from app.ai.classifier import get_classifier; from app.ai.policy import apply_prediction_policy; buf = io.BytesIO(); Image.new('RGB', (32, 32), (128, 128, 128)).save(buf, format='JPEG'); pred, ev = apply_prediction_policy(get_classifier().predict_raw(buf.getvalue())); assert ev.threshold_used == 0.70 and pred.category.value in {'AC','KURSI','LAMPU','PROYEKTOR'}; print('   -> AI Output:', pred.model_dump(), '| threshold:', ev.threshold_used)"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Pengujian modul AI gagal!
    exit /b %ERRORLEVEL%
)
echo [OK] Modul AI berhasil diuji secara independen.
echo.

:: 3. Jalankan Pytest Backend API
echo [3/3] Menjalankan Unit Test Backend dan API Endpoint...
.venv\Scripts\python.exe -m pytest backend\tests -v
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Unit test backend gagal!
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [BERHASIL] Seluruh pengujian aplikasi lulus 100%%!
echo ===================================================
exit /b 0
