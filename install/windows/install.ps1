param(
  [string]$InstallRoot = "C:\Electroshack",
  [string]$PublicSiteUrl = "",
  [switch]$SkipDependencyInstall
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell window (Run as administrator)."
  }
}

function Install-WingetPackage($Id, $Name) {
  if ($SkipDependencyInstall) { return }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Warning "winget is not available. Install $Name manually, then rerun this script."
    return
  }
  Write-Host "Checking $Name..."
  $installed = winget list --id $Id --exact --source winget 2>$null
  if ($LASTEXITCODE -eq 0 -and $installed -match [regex]::Escape($Id)) {
    Write-Host "$Name is already installed."
    return
  }
  Write-Host "Installing $Name..."
  winget install --id $Id --exact --source winget --accept-package-agreements --accept-source-agreements
}

function Prompt-SecretOrDefault($Prompt, $Default) {
  $value = Read-Host $Prompt
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value.Trim()
}

function New-RandomSecret([int]$Length = 32) {
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_"
  -join (1..$Length | ForEach-Object { $chars[(Get-Random -Minimum 0 -Maximum $chars.Length)] })
}

Assert-Admin

$AppRoot = Join-Path $InstallRoot "app"
$DataRoot = Join-Path $InstallRoot "data"
$BackupRoot = Join-Path $InstallRoot "backups"
$LogRoot = Join-Path $InstallRoot "logs"

New-Item -ItemType Directory -Force -Path $InstallRoot, $AppRoot, $DataRoot, $BackupRoot, $LogRoot | Out-Null

Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS"
Install-WingetPackage "MongoDB.Server" "MongoDB Community Server"
Install-WingetPackage "Git.Git" "Git"
Install-WingetPackage "Cloudflare.cloudflared" "Cloudflare Tunnel"

$SourceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Write-Host "Copying app from $SourceRoot to $AppRoot..."
robocopy $SourceRoot $AppRoot /MIR /XD ".git" "node_modules" "client\node_modules" "backend\node_modules" "client\build" /XF ".env" | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE" }

$BackendRoot = Join-Path $AppRoot "backend"
$ClientRoot = Join-Path $AppRoot "client"
$EnvPath = Join-Path $BackendRoot ".env"

if (-not $PublicSiteUrl) {
  $PublicSiteUrl = Read-Host "Public URL for the app (example: https://app.electroshack.ca)"
  if ([string]::IsNullOrWhiteSpace($PublicSiteUrl)) { $PublicSiteUrl = "http://localhost:5000" }
}

$AdminPassword = Prompt-SecretOrDefault "Admin password (leave blank for a generated password)" (New-RandomSecret 18)
$JwtSecret = New-RandomSecret 64
$TwilioSid = Read-Host "Twilio Account SID (optional)"
$TwilioToken = Read-Host "Twilio Auth Token (optional)"
$TwilioMessagingSid = Read-Host "Twilio Messaging Service SID (preferred, optional)"
$TwilioFrom = Read-Host "Twilio From Number (optional if Messaging Service SID is set)"
$AdminEmail = Prompt-SecretOrDefault "Admin email" "admin@electroshack.ca"

@"
NODE_ENV=production
PORT=5000
TRUST_PROXY=1
MONGODB_URI=mongodb://127.0.0.1:27017/electroshack
PUBLIC_SITE_URL=$PublicSiteUrl
ADMIN_PASSWORD=$AdminPassword
JWT_SECRET=$JwtSecret
ADMIN_EMAIL=$AdminEmail
TWILIO_ACCOUNT_SID=$TwilioSid
TWILIO_AUTH_TOKEN=$TwilioToken
TWILIO_MESSAGING_SERVICE_SID=$TwilioMessagingSid
TWILIO_FROM_NUMBER=$TwilioFrom
ALLOW_IN_MEMORY_DB=false
"@ | Set-Content -Path $EnvPath -Encoding UTF8

Write-Host "Installing backend dependencies..."
Push-Location $BackendRoot
npm install
Pop-Location

Write-Host "Installing client dependencies and building local frontend..."
Push-Location $ClientRoot
npm install
npm run build
Pop-Location

Write-Host "Ensuring admin account exists..."
Push-Location $BackendRoot
npm run reset-admin
Pop-Location

Write-Host ""
Write-Host "Install complete."
Write-Host "Admin username: admin"
Write-Host "Admin password: $AdminPassword"
Write-Host "Next: run install-service.ps1 to make Electroshack start on boot."
