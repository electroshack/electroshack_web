@echo off
setlocal EnableExtensions
set APP=C:\Electroshack
if not exist "%APP%\start-backend.cmd" (
  echo Electroshack is not installed yet. Double-click SETUP.bat first.
  pause
  exit /b 1
)

schtasks /Change /TN "Electroshack Local Server" /ENABLE >nul 2>&1
schtasks /Change /TN "Electroshack HTTPS" /ENABLE >nul 2>&1

sc query MongoDB >nul 2>&1 && (
  sc config MongoDB start= auto >nul 2>&1
  net start MongoDB >nul 2>&1
)

powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/api/health -TimeoutSec 2).StatusCode } catch { 0 }" | findstr "200" >nul
if %ERRORLEVEL%==0 (
  echo Electroshack is already running.
  start http://localhost:5000
  endlocal
  exit /b 0
)

start "" /MIN "%APP%\start-backend.cmd"
timeout /t 6 /nobreak >nul
start http://localhost:5000
endlocal
