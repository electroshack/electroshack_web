@echo off
cd /d "%~dp0"
if exist "usb\ENABLE-INTERNET.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0usb\ENABLE-INTERNET.ps1\"'"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0ENABLE-INTERNET.ps1\"'"
)
