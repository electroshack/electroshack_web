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

function Wait-Port([int]$Port, [int]$Seconds = 90) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
      if ($tcp.TcpTestSucceeded) { return $true }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

function Invoke-NpmRetry([string]$Label, [scriptblock]$Block) {
  $last = $null
  foreach ($attempt in 1, 2, 3) {
    Write-Log "$Label (attempt $attempt)"
    & $Block
    if ($LASTEXITCODE -eq 0) { return }
    $last = $LASTEXITCODE
    Start-Sleep -Seconds 8
  }
  throw "$Label failed after 3 tries (exit $last). This PC needs internet for the first install."
}

Write-Log "Electroshack local setup started"
Write-Log "USB folder: $UsbDir"
Write-Log "Repo root: $RepoRoot"

if (-not (Test-Path (Join-Path $RepoRoot "backend\package.json"))) {
  if (Test-Path (Join-Path $UsbDir "..\backend\package.json")) {
    $RepoRoot = (Resolve-Path (Join-Path $UsbDir "..")).Path
  }
}
if (-not (Test-Path (Join-Path $RepoRoot "backend\package.json"))) {
  throw "Could not find backend\package.json. The USB must contain the whole Electroshack folder (backend, client, usb). Open D:\ and confirm those folders exist next to SETUP.bat."
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
Invoke-NpmRetry "backend npm install" { npm install --omit=dev }
Pop-Location

Write-Log "Installing client packages and building storefront"
Push-Location $ClientDir
Invoke-NpmRetry "client npm install" { npm install }
Write-Log "Building client"
npm run build
if ($LASTEXITCODE -ne 0) { throw "client build failed" }
Pop-Location

Write-Log "Starting MongoDB"
$mongo = Get-Service | Where-Object { $_.Name -eq "MongoDB" -or $_.DisplayName -like "MongoDB*" } | Select-Object -First 1
if ($mongo) {
  Set-Service $mongo.Name -StartupType Automatic
  if ($mongo.Status -ne "Running") { Start-Service $mongo.Name }
  Write-Log ("MongoDB service: {0}" -f $mongo.Name)
} else {
  Write-Log "WARNING: MongoDB Windows service not found. SETUP will still try to start the app."
}
if (-not (Wait-Port 27017 120)) {
  throw "MongoDB did not open port 27017. Reboot this PC, then run SETUP.bat again."
}
Write-Log "MongoDB is listening on 27017"

Write-Log "Creating admin login from USB credentials"
Push-Location $BackendDir
$adminOk = $false
foreach ($attempt in 1, 2, 3) {
  node scripts/resetAdminPassword.js
  if ($LASTEXITCODE -eq 0) { $adminOk = $true; break }
  Write-Log "Admin reset failed (attempt $attempt), waiting for Mongo..."
  Start-Sleep -Seconds 5
}
if (-not $adminOk) { throw "Admin password reset failed. Is MongoDB running? See C:\Electroshack\install.log" }
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

# - PC-local launcher so the USB can be unplugged. START.bat and a Desktop shortcut point here.
Copy-Item (Join-Path $UsbDir "START.bat") (Join-Path $InstallRoot "START.bat") -Force
Copy-Item (Join-Path $UsbDir "PAUSE.bat") (Join-Path $InstallRoot "PAUSE.bat") -Force
Copy-Item (Join-Path $UsbDir "PAUSE.ps1") (Join-Path $InstallRoot "PAUSE.ps1") -Force
Copy-Item (Join-Path $UsbDir "STOP.bat") (Join-Path $InstallRoot "STOP.bat") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $BackendDir "scripts") | Out-Null
Copy-Item (Join-Path $UsbDir "send-at-sms.ps1") (Join-Path $BackendDir "scripts\send-at-sms.ps1") -Force
$Wsh = New-Object -ComObject WScript.Shell
$shortcutPaths = @(
  (Join-Path $env:PUBLIC "Desktop\Electroshack.lnk"),
  (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\Electroshack.lnk")
)
foreach ($lnk in $shortcutPaths) {
  $dir = Split-Path $lnk
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $sc = $Wsh.CreateShortcut($lnk)
  $sc.TargetPath = Join-Path $InstallRoot "START.bat"
  $sc.WorkingDirectory = $InstallRoot
  $sc.WindowStyle = 7
  $sc.Description = "Electroshack store PC"
  $sc.Save()
}
$pauseLnk = Join-Path $env:PUBLIC "Desktop\Pause Electroshack.lnk"
$sc = $Wsh.CreateShortcut($pauseLnk)
$sc.TargetPath = Join-Path $InstallRoot "PAUSE.bat"
$sc.WorkingDirectory = $InstallRoot
$sc.Description = "Stop Electroshack so this PC can be moved"
$sc.Save()
Write-Log "Installed START.bat, PAUSE.bat, and Desktop / Start Menu shortcuts on this PC"

netsh advfirewall firewall delete rule name="Electroshack TCP 5000" 2>$null | Out-Null
netsh advfirewall firewall add rule name="Electroshack TCP 5000" dir=in action=allow protocol=TCP localport=5000 | Out-Null
Write-Log "Opened Windows Firewall for port 5000 (shop LAN)"

Write-Log "Starting Electroshack"
Start-Process -FilePath $startCmdPath
if (Wait-Port 5000 60) {
  Write-Log "Server is up on port 5000"
} else {
  Write-Log "WARNING: port 5000 not ready yet. Open C:\Electroshack\logs\backend.log"
}
Start-Process "http://localhost:5000"

Write-Log "Setup finished. The app lives on this PC at C:\Electroshack. You can unplug the USB."
Write-Host ""
Write-Host "Open http://localhost:5000  (or the Electroshack icon on the Desktop)"
Write-Host "Admin login is in usb\README.txt on this USB stick."
Write-Host "To pause before moving this PC to the store: double-click PAUSE.bat (or Pause Electroshack on the Desktop)."
Write-Host ""
Read-Host "Press Enter to close"
