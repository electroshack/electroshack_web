$ErrorActionPreference = "Stop"

$UsbDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $UsbDir "SETUP-SMS.ps1"))) {
  $UsbDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "usb"
}
$RepoRoot = Split-Path -Parent $UsbDir
$Credentials = Join-Path $UsbDir "credentials.env"
$LiveEnv = "C:\Electroshack\app\backend\.env"
$SendScript = Join-Path $UsbDir "send-at-sms.ps1"

Write-Host "Electroshack SMS stick setup"
Write-Host "A SIM card reader cannot send texts. Use a USB LTE/GSM modem with a SIM slot."
Write-Host ""

$ports = [System.IO.Ports.SerialPort]::GetPortNames()
if (-not $ports -or $ports.Count -eq 0) {
  Write-Host "No COM ports found. Plug in the USB modem, wait for Windows to install drivers, then run this again."
  exit 1
}

Write-Host "COM ports:"
for ($i = 0; $i -lt $ports.Count; $i++) {
  Write-Host ("  [{0}] {1}" -f ($i + 1), $ports[$i])
}

$choice = Read-Host "Enter the number of the modem COM port"
$idx = 0
[void][int]::TryParse($choice, [ref]$idx)
if ($idx -lt 1 -or $idx -gt $ports.Count) {
  throw "Invalid selection."
}
$port = $ports[$idx - 1]
$baud = "115200"

function Set-EnvKey([string]$Path, [string]$Key, [string]$Value) {
  if (-not (Test-Path $Path)) { return $false }
  $lines = Get-Content $Path
  $found = $false
  $next = foreach ($line in $lines) {
    if ($line -match ("^\s*{0}=" -f [regex]::Escape($Key))) {
      $found = $true
      "{0}={1}" -f $Key, $Value
    } else {
      $line
    }
  }
  if (-not $found) { $next += ("{0}={1}" -f $Key, $Value) }
  Set-Content -Path $Path -Value $next -Encoding ASCII
  return $true
}

if (Test-Path $Credentials) {
  [void](Set-EnvKey $Credentials "SMS_MODEM_PORT" $port)
  [void](Set-EnvKey $Credentials "SMS_MODEM_BAUD" $baud)
  Write-Host "Wrote SMS_MODEM_PORT=$port to usb\credentials.env"
}
if (Test-Path $LiveEnv) {
  [void](Set-EnvKey $LiveEnv "SMS_MODEM_PORT" $port)
  [void](Set-EnvKey $LiveEnv "SMS_MODEM_BAUD" $baud)
  Write-Host "Wrote SMS_MODEM_PORT=$port to C:\Electroshack\app\backend\.env"
  Write-Host "Restart Electroshack (START.bat) so the app picks up the port."
} else {
  Write-Host "App is not installed yet. Run SETUP.bat first, then SETUP-SMS.bat again if needed."
}

$test = Read-Host "Send a test text now? Enter a 10-digit phone number, or leave blank to skip"
if ($test) {
  $digits = ($test -replace "\D", "")
  if ($digits.Length -eq 10) { $to = "+1$digits" }
  elseif ($digits.Length -eq 11 -and $digits.StartsWith("1")) { $to = "+$digits" }
  else { throw "Need a 10-digit North American number." }
  $env:SMS_TO = $to
  $env:SMS_BODY = "Electroshack SMS stick test. This COM port works."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $SendScript -Port $port -Baud ([int]$baud)
  Write-Host "Test sent to $to"
}

Write-Host ""
Write-Host "Receipts and grocery in-stock alerts will text the customer phone when the stick is plugged in."
Write-Host "If the stick is unplugged, texts queue under Messages as not sent."
