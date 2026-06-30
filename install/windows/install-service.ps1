param(
  [string]$InstallRoot = "C:\Electroshack",
  [string]$TunnelToken = ""
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell window (Run as administrator)."
  }
}

function Register-StartupTask($Name, $Executable, $Arguments, $WorkingDirectory) {
  $action = New-ScheduledTaskAction -Execute $Executable -Argument $Arguments -WorkingDirectory $WorkingDirectory
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
}

Assert-Admin

$BackendRoot = Join-Path $InstallRoot "app\backend"
$LogRoot = Join-Path $InstallRoot "logs"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

$Node = (Get-Command node -ErrorAction Stop).Source
$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source

$StartBackendScript = Join-Path $InstallRoot "start-backend.ps1"
@"
Set-Location "$BackendRoot"
`$env:NODE_ENV = "production"
npm start *> "$LogRoot\backend.log"
"@ | Set-Content -Path $StartBackendScript -Encoding UTF8

Register-StartupTask `
  -Name "Electroshack Backend" `
  -Executable $PowerShell `
  -Arguments "-NoProfile -ExecutionPolicy Bypass -File `"$StartBackendScript`"" `
  -WorkingDirectory $BackendRoot

if ($TunnelToken) {
  $Cloudflared = (Get-Command cloudflared.exe -ErrorAction Stop).Source
  Register-StartupTask `
    -Name "Electroshack Cloudflare Tunnel" `
    -Executable $Cloudflared `
    -Arguments "tunnel --no-autoupdate run --token $TunnelToken" `
    -WorkingDirectory $InstallRoot
  Write-Host "Cloudflare Tunnel task installed."
} else {
  Write-Warning "No tunnel token provided. Create a Cloudflare Tunnel and rerun: .\install-service.ps1 -TunnelToken <token>"
}

Write-Host "Startup tasks installed:"
Get-ScheduledTask -TaskName "Electroshack Backend","Electroshack Cloudflare Tunnel" -ErrorAction SilentlyContinue |
  Select-Object TaskName, State

Write-Host ""
Write-Host "Start now with:"
Write-Host "  Start-ScheduledTask -TaskName 'Electroshack Backend'"
Write-Host "  Start-ScheduledTask -TaskName 'Electroshack Cloudflare Tunnel'"
