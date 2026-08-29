@echo off
cd /d "%~dp0"
if exist "%~dp0usb\backup.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0usb\backup.ps1"
) else if exist "%~dp0backup.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
) else (
  echo backup.ps1 is missing. Run SETUP.bat first.
)
pause
