@echo off
cd /d "%~dp0"
if exist "%~dp0PAUSE.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0PAUSE.ps1\"'"
) else if exist "%~dp0usb\PAUSE.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0usb\PAUSE.ps1\"'"
) else if exist "C:\Electroshack\PAUSE.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"C:\Electroshack\PAUSE.ps1\"'"
) else (
  echo PAUSE.ps1 is missing. Run SETUP.bat first.
  pause
)
