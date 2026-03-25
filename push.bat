@echo off
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -u
git status --short
echo.
git commit -m "update"
echo.
git push origin master
echo.
echo === Done ===
echo.
pause
