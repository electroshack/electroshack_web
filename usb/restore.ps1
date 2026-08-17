param(
  [string]$BackupZip
)

$ErrorActionPreference = "Stop"

$UsbDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $UsbDir
$BackupRoot = Join-Path $RepoRoot "backups"

function Find-MongoTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $paths = @(
    "C:\Program Files\MongoDB\Tools\100\bin\$Name.exe",
    "C:\Program Files\MongoDB\Database Tools\bin\$Name.exe"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  $found = Get-ChildItem "C:\Program Files\MongoDB" -Recurse -Filter "$Name.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($found) { return $found }
  return $null
}

$mongorestore = Find-MongoTool "mongorestore"
if (-not $mongorestore) {
  throw "mongorestore not found. Run SETUP.bat first so MongoDB Database Tools are installed."
}

if (-not $BackupZip) {
  $latest = Get-ChildItem $BackupRoot -Filter "*.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw "No zip backups found in $BackupRoot" }
  $BackupZip = $latest.FullName
}

if (-not (Test-Path $BackupZip)) { throw "Backup file not found: $BackupZip" }

$temp = Join-Path $env:TEMP ("electroshack-restore-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $temp | Out-Null
Expand-Archive -Path $BackupZip -DestinationPath $temp -Force

$dump = Get-ChildItem $temp -Directory | Select-Object -First 1
if (-not $dump) { throw "Zip did not contain a mongodump folder." }

Write-Host "Restoring $($dump.FullName) into mongodb://127.0.0.1:27017/electroshack"
& $mongorestore --uri "mongodb://127.0.0.1:27017/electroshack" --drop $dump.FullName
if ($LASTEXITCODE -ne 0) { throw "mongorestore failed" }

Remove-Item $temp -Recurse -Force
Write-Host "Restore complete from $BackupZip"
