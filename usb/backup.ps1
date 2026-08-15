$ErrorActionPreference = "Stop"

$UsbDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $UsbDir
$BackupRoot = Join-Path $RepoRoot "backups"
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$DumpDir = Join-Path $BackupRoot "dump-$Stamp"
$ZipPath = Join-Path $BackupRoot "electroshack-$Stamp.zip"

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

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$mongodump = Find-MongoTool "mongodump"
if (-not $mongodump) {
  throw "mongodump not found. Run SETUP.bat first so MongoDB Database Tools are installed."
}

Write-Host "Dumping electroshack database to $DumpDir"
& $mongodump --uri "mongodb://127.0.0.1:27017/electroshack" --out $DumpDir
if ($LASTEXITCODE -ne 0) { throw "mongodump failed" }

Compress-Archive -Path $DumpDir -DestinationPath $ZipPath -Force
Remove-Item $DumpDir -Recurse -Force

Write-Host "Backup saved to $ZipPath"
