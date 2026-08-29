#Requires -RunAsAdministrator
$ErrorActionPreference = "Continue"

$InstallRoot = "C:\Electroshack"

Write-Host "Pausing Electroshack on this PC..."
Write-Host "The database stays on disk. Nothing is deleted."
Write-Host "Use START.bat (or the Desktop icon) when the PC is at the store."
Write-Host ""

schtasks /Change /TN "Electroshack Local Server" /DISABLE 2>$null | Out-Null
schtasks /Change /TN "Electroshack HTTPS" /DISABLE 2>$null | Out-Null

Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "Electroshack\\app\\backend" -or $_.CommandLine -match "electroshack.*server\.js" } |
  ForEach-Object {
    Write-Host ("Stopping node PID {0}" -f $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Get-CimInstance Win32_Process -Filter "Name='caddy.exe'" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host ("Stopping Caddy PID {0}" -f $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

$mongo = Get-Service | Where-Object { $_.Name -eq "MongoDB" -or $_.DisplayName -like "MongoDB*" } | Select-Object -First 1
if ($mongo) {
  if ($mongo.Status -eq "Running") {
    Stop-Service $mongo.Name -Force -ErrorAction SilentlyContinue
    Write-Host ("Stopped {0}" -f $mongo.Name)
  }
  Set-Service $mongo.Name -StartupType Manual -ErrorAction SilentlyContinue
}

$pidFile = Join-Path $InstallRoot "backend.pid"
if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "Paused. You can shut down and move this PC."
Write-Host "At the store, double-click START.bat or the Electroshack desktop icon."
Write-Host ""
Read-Host "Press Enter to close"
