@echo off
cd /d "%~dp0"

echo ========================================
echo   CutSense Git Push
echo ========================================
echo.

git add -A

git diff --cached --quiet
if errorlevel 1 (
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set D=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set T=%%a:%%b
    git commit -m "update %D% %T%"
    echo [OK] Committed
) else (
    echo [INFO] Nothing changed - skip commit
)

echo.
echo Pushing to GitHub...
git push origin master
if errorlevel 1 (
    echo [ERROR] Push failed - check internet or auth
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Push complete!
echo ========================================
timeout /t 3 >nul
