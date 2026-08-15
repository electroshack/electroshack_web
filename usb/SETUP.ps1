#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$UsbDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $UsbDir
$InstallRoot = "C:\Electroshack"
$AppDir = Join-Path $InstallRoot "app"
$BackendDir = Join-Path $AppDir "backend"
$ClientDir = Join-Path $AppDir "client"
$LogDir = Join-Path $InstallRoot "logs"
$LogFile = Join-Path $InstallRoot "install.log"
$BackupRoot = Join-Path $RepoRoot "backups"

New-Item -ItemType Directory -Force -Path $InstallRoot, $LogDir, $BackupRoot | Out-Null

function Write-Log([string]$Message) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Refresh-Path {
  $extra = @(
    "C:\Program Files\nodejs",
    "C:\Program Files\MongoDB\Tools\100\bin"
  )
  Get-ChildItem "C:\Program Files\MongoDB\Server" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $extra += (Join-Path $_.FullName "bin")
  }
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = (($extra + $machinePath + $userPath) -join ";")
}

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WingetPackage([string]$Id) {
  Write-Log "Installing $Id (skipped if already present)"
  & winget install --id $Id -e --accept-package-agreements --accept-source-agreements --disable-interactivity
  Refresh-Path
}

Write-Log "Electroshack local setup started"
Write-Log "USB folder: $UsbDir"
Write-Log "Repo root: $RepoRoot"

if (-not (Test-Path (Join-Path $RepoRoot "backend\package.json"))) {
  throw "Could not find the Electroshack repo next to this usb folder. Copy the whole project onto the USB so SETUP.bat is at the root of the stick."
}

if (-not (Test-Command "winget")) {
  throw "winget is required. Install App Installer from the Microsoft Store, then run SETUP.bat again."
}

Refresh-Path
if (-not (Test-Command "node")) { Install-WingetPackage "OpenJS.NodeJS.LTS" }
if (-not (Test-Command "mongod")) { Install-WingetPackage "MongoDB.Server" }
if (-not (Test-Command "mongodump")) { Install-WingetPackage "MongoDB.DatabaseTools" }
Refresh-Path

if (-not (Test-Command "node")) { throw "Node.js is still missing after install. Reboot and run SETUP.bat again." }
if (-not (Test-Command "npm")) { throw "npm is still missing after install. Reboot and run SETUP.bat again." }

Write-Log ("Node {0}" -f (node -v))

Write-Log "Copying app to $AppDir"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
& robocopy $RepoRoot $AppDir /E /XD .git node_modules build backups /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

$credentials = Join-Path $UsbDir "credentials.env"
if (-not (Test-Path $credentials)) {
  throw "usb\credentials.env is missing."
}
# Copy the file as-is. Do not expand it in PowerShell — the password contains $.
Copy-Item $credentials -Destination (Join-Path $BackendDir ".env") -Force
Write-Log "Copied USB credentials into backend\.env"

Write-Log "Installing backend packages"
Push-Location $BackendDir
npm install --omit=dev
if ($LASTEXITCODE -ne 0) { throw "backend npm install failed" }
Pop-Location

Write-Log "Installing client packages and building storefront"
Push-Location $ClientDir
npm install
if ($LASTEXITCODE -ne 0) { throw "client npm install failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "client build failed" }
Pop-Location

Write-Log "Starting MongoDB"
$mongo = Get-Service | Where-Object { $_.Name -eq "MongoDB" -or $_.DisplayName -like "MongoDB*" } | Select-Object -First 1
if ($mongo) {
  if ($mongo.Status -ne "Running") { Start-Service $mongo.Name }
  Set-Service $mongo.Name -StartupType Automatic
  Write-Log ("MongoDB service: {0}" -f $mongo.Name)
} else {
  Write-Log "WARNING: MongoDB Windows service not found. SETUP will still try to start the app."
}

Write-Log "Creating admin login from USB credentials"
Push-Location $BackendDir
node scripts/resetAdminPassword.js
if ($LASTEXITCODE -ne 0) { throw "Admin password reset failed. Is MongoDB running?" }
Pop-Location

$startCmdPath = Join-Path $InstallRoot "start-backend.cmd"
$nodeExe = (Get-Command node).Source
@(
  "@echo off",
  "setlocal",
  ("set PATH={0};%PATH%" -f (Split-Path $nodeExe)),
  "if not exist `"$LogDir`" mkdir `"$LogDir`"",
  "cd /d `"$BackendDir`"",
  "echo %DATE% %TIME% starting Electroshack >> `"$LogDir\backend.log`"",
  "`"$nodeExe`" server.js >> `"$LogDir\backend.log`" 2>&1"
) | Set-Content -Path $startCmdPath -Encoding ASCII

schtasks /Create /TN "Electroshack Local Server" /TR "`"$startCmdPath`"" /SC ONLOGON /RL HIGHEST /F | Out-Null
Write-Log "Registered Windows logon task: Electroshack Local Server"

netsh advfirewall firewall delete rule name="Electroshack TCP 5000" 2>$null | Out-Null
netsh advfirewall firewall add rule name="Electroshack TCP 5000" dir=in action=allow protocol=TCP localport=5000 | Out-Null
Write-Log "Opened Windows Firewall for port 5000 (shop LAN)"

Write-Log "Starting Electroshack"
Start-Process -FilePath $startCmdPath
Start-Sleep -Seconds 5
Start-Process "http://localhost:5000"

Write-Log "Setup finished. Login with the credentials in usb\README.txt"
Write-Host ""
Write-Host "Open http://localhost:5000"
Write-Host "Admin login is in usb\README.txt on this USB stick."
Write-Host "Backups go into backups\ on this USB. Use BACKUP.bat / RESTORE.bat."
Write-Host ""
Read-Host "Press Enter to close"
