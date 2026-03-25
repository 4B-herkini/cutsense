@echo off
chcp 65001 >nul
title CutSense - AI Video Editor

echo ========================================
echo   CutSense v1.0 - AI Video Editor
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install: winget install Python.Python.3.12
    pause
    exit /b
)
echo [OK] Python found

REM Check FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] FFmpeg not found. Install: winget install FFmpeg
    pause
    exit /b
)
echo [OK] FFmpeg found

REM Create venv if not exists
if not exist "venv" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install dependencies
echo [2/3] Installing dependencies...
pip install -r backend\requirements.txt -q
if errorlevel 1 (
    echo [ERROR] Dependencies install failed.
    pause
    exit /b
)
echo [OK] Dependencies installed

REM Create folders
if not exist "uploads" mkdir uploads
if not exist "outputs" mkdir outputs

REM Kill existing process on port 9000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000 ^| findstr LISTENING 2^>nul') do (
    echo [!] Port 9000 occupied - killing PID %%a...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)

REM Start server
echo [3/3] Starting CutSense server...
echo.
echo   http://localhost:9000
echo   Press Ctrl+C to stop
echo ========================================
echo.

cd backend
uvicorn main:app --host 0.0.0.0 --port 9000 --reload

echo.
echo ========================================
echo   Server stopped. Check above for errors.
echo ========================================
pause
