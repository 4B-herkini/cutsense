@echo off
chcp 65001 >nul
title CutSense - AI Video Editor

REM Log everything to debug.log
set LOGFILE=%~dp0debug.log
echo ======================================== > "%LOGFILE%"
echo   CutSense Debug Log >> "%LOGFILE%"
echo   Started: %date% %time% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"

echo ========================================
echo   CutSense v1.0 - AI Video Editor
echo ========================================
echo.

REM Check Python
echo [CHECK] Python... >> "%LOGFILE%"
python --version >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found >> "%LOGFILE%"
    echo [ERROR] Python not found. Install: winget install Python.Python.3.12
    pause
    exit /b
)

REM Check FFmpeg
echo [CHECK] FFmpeg... >> "%LOGFILE%"
ffmpeg -version >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] FFmpeg not found >> "%LOGFILE%"
    echo [ERROR] FFmpeg not found. Install: winget install FFmpeg
    pause
    exit /b
)

REM Check pip
echo [CHECK] pip... >> "%LOGFILE%"
pip --version >> "%LOGFILE%" 2>&1

REM Create venv if not exists
if not exist "venv" (
    echo [1/3] Creating virtual environment...
    echo [STEP] Creating venv... >> "%LOGFILE%"
    python -m venv venv >> "%LOGFILE%" 2>&1
)

REM Activate venv and install
echo [2/3] Installing dependencies...
echo [STEP] Activating venv... >> "%LOGFILE%"
call venv\Scripts\activate.bat >> "%LOGFILE%" 2>&1

echo [STEP] Installing requirements... >> "%LOGFILE%"
pip install -r backend\requirements.txt >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] pip install failed >> "%LOGFILE%"
    echo [ERROR] Dependencies install failed. Check debug.log
    pause
    exit /b
)

REM Create folders
if not exist "uploads" mkdir uploads
if not exist "outputs" mkdir outputs

REM Verify Python can import modules
echo [STEP] Verifying imports... >> "%LOGFILE%"
python -c "import fastapi; import uvicorn; print('[OK] FastAPI + Uvicorn ready')" >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Module import failed >> "%LOGFILE%"
    echo [ERROR] Module import failed. Check debug.log
    pause
    exit /b
)

REM Start server
echo [3/3] Starting CutSense server...
echo.
echo   Backend:  http://localhost:9000
echo   Frontend: http://localhost:9000 (open in browser)
echo.
echo   Press Ctrl+C to stop
echo ========================================

echo [STEP] Starting uvicorn... >> "%LOGFILE%"
echo [TIME] %date% %time% >> "%LOGFILE%"

cd backend
uvicorn main:app --host 0.0.0.0 --port 9000 --reload >> "%~dp0debug.log" 2>&1
