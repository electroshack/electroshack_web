@echo off
setlocal
set APP=C:\Electroshack
if not exist "%APP%\start-backend.cmd" (
  echo Electroshack is not installed yet. Double-click SETUP.bat first.
  pause
  exit /b 1
)
sc query MongoDB >nul 2>&1 && net start MongoDB >nul 2>&1
start "" /MIN "%APP%\start-backend.cmd"
timeout /t 4 /nobreak >nul
start http://localhost:5000
endlocal
