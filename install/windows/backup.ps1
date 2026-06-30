param(
  [string]$InstallRoot = "C:\Electroshack",
  [string]$MongoUri = "mongodb://127.0.0.1:27017/electroshack",
  [int]$KeepDays = 30,
  [string]$CopyTo = ""
)

$ErrorActionPreference = "Stop"

$BackupRoot = Join-Path $InstallRoot "backups"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $BackupRoot "electroshack-$stamp"

if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) {
  throw "mongodump was not found. Install MongoDB Database Tools or add them to PATH."
}

mongodump --uri $MongoUri --out $outDir
Compress-Archive -Path $outDir -DestinationPath "$outDir.zip" -Force
Remove-Item $outDir -Recurse -Force

Get-ChildItem $BackupRoot -Filter "electroshack-*.zip" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force

if ($CopyTo) {
  New-Item -ItemType Directory -Force -Path $CopyTo | Out-Null
  Copy-Item "$outDir.zip" $CopyTo -Force
}

Write-Host "Backup complete: $outDir.zip"
