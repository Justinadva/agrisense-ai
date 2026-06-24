@echo off
title AgriSense AI Server
echo.
echo ================================================
echo   AgriSense AI Server - Starting...
echo ================================================
echo.

REM Check if venv exists, create if not
if not exist "venv\Scripts\python.exe" (
    echo [1/3] Membuat virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Gagal membuat venv! Pastikan Python 3.10+ terinstall.
        pause
        exit /b 1
    )
)

REM Install/update dependencies in venv
echo [2/3] Mengecek dependencies...
.\venv\Scripts\pip install fastapi "uvicorn[standard]" ultralytics opencv-python Pillow numpy python-multipart -q
if errorlevel 1 (
    echo [ERROR] Gagal install dependencies!
    pause
    exit /b 1
)

echo [3/3] Menjalankan server AI...
echo.
echo   Model : best (10) (2).pt
echo   URL   : http://localhost:8000
echo   Docs  : http://localhost:8000/docs
echo.
echo   Tekan Ctrl+C untuk berhenti.
echo ================================================
echo.

.\venv\Scripts\python main.py
pause
