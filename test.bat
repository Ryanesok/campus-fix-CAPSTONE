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

:: 2. Uji Modul AI Terpisah (ai/predictor.py)
echo [2/3] Menguji Modul AI (ai/predictor.py)...
.venv\Scripts\python.exe -c "from ai.predictor import predict_facility; res = predict_facility(b'test-img-bytes'); assert 'category' in res and 'confidence' in res, 'Format output AI tidak valid'; print('   -> AI Output:', res)"
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
