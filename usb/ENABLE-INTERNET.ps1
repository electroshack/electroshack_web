#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$InstallRoot = "C:\Electroshack"
$AppDir = Join-Path $InstallRoot "app"
$BackendDir = Join-Path $AppDir "backend"
$EnvPath = Join-Path $BackendDir ".env"
$Caddyfile = Join-Path $InstallRoot "Caddyfile"
$LogDir = Join-Path $InstallRoot "logs"

function Set-EnvFileValue([string]$Path, [string]$Key, [string]$Value) {
  if (-not (Test-Path $Path)) { throw "Missing $Path — run SETUP.bat first." }
  $lines = @(Get-Content -Path $Path)
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match ("^" + [regex]::Escape($Key) + "=")) {
      $found = $true
      "{0}={1}" -f $Key, $Value
    } else {
      $line
    }
  }
  if (-not $found) { $out += ("{0}={1}" -f $Key, $Value) }
  Set-Content -Path $Path -Value $out -Encoding ascii
}

Write-Host ""
Write-Host "Electroshack internet access"
Write-Host "The database stays on this PC. This only publishes HTTPS so customers"
Write-Host "at home can open their ticket links. Uses GoDaddy DNS you already have."
Write-Host "No Cloudflare, ngrok, or extra accounts."
Write-Host ""

if (-not (Test-Path $EnvPath)) {
  throw "C:\Electroshack\app\backend\.env not found. Run SETUP.bat first."
}

$defaultHost = "app.electroshack.ca"
$hostname = Read-Host "Public hostname [$defaultHost]"
if ([string]::IsNullOrWhiteSpace($hostname)) { $hostname = $defaultHost }
$hostname = $hostname.Trim().ToLower().Replace("https://", "").Replace("http://", "").TrimEnd("/")

$publicUrl = "https://$hostname"
$publicIp = ""
try { $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 10).Trim() } catch { $publicIp = "(could not detect)" }

Write-Host ""
Write-Host "This PC's public IP right now: $publicIp"
Write-Host "In GoDaddy DNS for electroshack.ca add:"
Write-Host "  Type A    Name $($hostname.Replace('.electroshack.ca','').Replace('electroshack.ca','@'))    Value $publicIp    TTL 600"
Write-Host "If the name is app.electroshack.ca, the host/name field is: app"
Write-Host ""
Write-Host "On the store router, forward TCP 80 and 443 to this PC."
Write-Host "The PC must stay on. If the ISP changes your IP, update the GoDaddy A record."
Write-Host ""

Set-EnvFileValue $EnvPath "PUBLIC_SITE_URL" $publicUrl
Set-EnvFileValue $EnvPath "TRUST_PROXY" "1"
Write-Host "Updated PUBLIC_SITE_URL=$publicUrl"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

foreach ($port in 80, 443, 5000) {
  $rule = "Electroshack TCP $port"
  netsh advfirewall firewall delete rule name=$rule 2>$null | Out-Null
  netsh advfirewall firewall add rule name=$rule dir=in action=allow protocol=TCP localport=$port | Out-Null
}
Write-Host "Opened Windows Firewall for ports 80, 443, and 5000."

$caddy = Get-Command caddy -ErrorAction SilentlyContinue
if (-not $caddy) {
  Write-Host "Installing Caddy (HTTPS reverse proxy)..."
  winget install --id CaddyServer.Caddy -e --accept-package-agreements --accept-source-agreements --disable-interactivity
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
  $caddy = Get-Command caddy -ErrorAction SilentlyContinue
}
if (-not $caddy) {
  throw "Caddy is not on PATH. Reboot, then run ENABLE-INTERNET.bat again."
}

@(
  "{",
  "  email admin@electroshack.ca",
  "}",
  "$hostname {",
  "  encode gzip",
  "  reverse_proxy 127.0.0.1:5000",
  "}"
) | Set-Content -Path $Caddyfile -Encoding ascii

$startCaddy = Join-Path $InstallRoot "start-caddy.cmd"
@(
  "@echo off",
  ("set PATH={0};%PATH%" -f (Split-Path $caddy.Source)),
  "`"$($caddy.Source)`" run --config `"$Caddyfile`" >> `"$LogDir\caddy.log`" 2>&1"
) | Set-Content -Path $startCaddy -Encoding ASCII

schtasks /Create /TN "Electroshack HTTPS" /TR "`"$startCaddy`"" /SC ONLOGON /RL HIGHEST /F | Out-Null
Start-Process -FilePath $startCaddy
Write-Host "Caddy is serving HTTPS for $hostname -> http://127.0.0.1:5000"
Write-Host ""
Write-Host "After DNS + port-forward propagate, customers open:"
Write-Host "  $publicUrl/ticket/<token>"
Write-Host "Staff still use http://localhost:5000 on this PC."
Write-Host ""
Write-Host "Restart the Electroshack app (START.bat) so ticket emails/SMS use the new URL."
Write-Host ""
Read-Host "Press Enter to close"
