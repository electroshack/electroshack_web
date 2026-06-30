param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"

$SourceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$OutRoot = Join-Path $Destination "Electroshack-Installer"

New-Item -ItemType Directory -Force -Path $OutRoot | Out-Null
robocopy $SourceRoot $OutRoot /MIR /XD ".git" "node_modules" "client\node_modules" "backend\node_modules" "client\build" /XF ".env" | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-Host "USB installer copied to $OutRoot"
Write-Host "On the store PC, run:"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\install\windows\install.ps1"
