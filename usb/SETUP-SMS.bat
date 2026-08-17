@echo off
cd /d "%~dp0"
if exist "%~dp0SETUP-SMS.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-SMS.ps1"
) else if exist "%~dp0usb\SETUP-SMS.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0usb\SETUP-SMS.ps1"
) else (
  echo SETUP-SMS.ps1 is missing.
  pause
  exit /b 1
)
pause
