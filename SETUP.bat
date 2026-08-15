@echo off
cd /d "%~dp0"
if not exist "usb\SETUP.ps1" (
  echo usb\SETUP.ps1 is missing. Copy the whole Electroshack folder onto this USB.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0usb\SETUP.ps1\"'"
