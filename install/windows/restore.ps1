param(
  [Parameter(Mandatory = $true)]
  [string]$BackupZip,
  [string]$MongoUri = "mongodb://127.0.0.1:27017/electroshack",
  [switch]$DropExisting
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupZip)) { throw "Backup file not found: $BackupZip" }
if (-not (Get-Command mongorestore -ErrorAction SilentlyContinue)) {
  throw "mongorestore was not found. Install MongoDB Database Tools or add them to PATH."
}

$temp = Join-Path $env:TEMP ("electroshack-restore-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temp | Out-Null

try {
  Expand-Archive -Path $BackupZip -DestinationPath $temp -Force
  $dumpRoot = Get-ChildItem $temp -Directory | Select-Object -First 1
  if (-not $dumpRoot) { throw "Backup zip did not contain a mongodump folder." }

  $args = @("--uri", $MongoUri)
  if ($DropExisting) { $args += "--drop" }
  $args += $dumpRoot.FullName

  mongorestore @args
  Write-Host "Restore complete from $BackupZip"
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
