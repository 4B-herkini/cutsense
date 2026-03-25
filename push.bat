@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   CutSense Git Push
echo ========================================
echo.

REM 상태 확인
git status --short
echo.

REM 스테이징 (추적 중인 파일만 — 새 파일은 수동 add)
git add -u

git diff --cached --quiet
if errorlevel 1 (
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set D=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set T=%%a:%%b
    git commit -m "update %D% %T%"
    echo.
    echo [OK] Committed
) else (
    echo [INFO] Nothing changed - skip commit
)

echo.
echo Pushing to GitHub...
echo.
git push origin master 2>&1

if errorlevel 1 (
    echo.
    echo ========================================
    echo   [ERROR] Push failed!
    echo   - GitHub 인증 확인: gh auth login
    echo   - 또는 PAT 토큰 확인
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   Push complete!
    echo ========================================
)

echo.
pause
