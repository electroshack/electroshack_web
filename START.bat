@echo off
setlocal
cd /d C:\Electroshack\app\backend
if not exist package.json (
  echo Electroshack is not installed yet. Double-click SETUP.bat first.
  pause
  exit /b 1
)
start "Electroshack" cmd /k "npm start"
timeout /t 3 /nobreak >nul
start http://localhost:5000
endlocal
