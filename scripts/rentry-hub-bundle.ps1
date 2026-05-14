# rentry-hub-bundle.ps1 - hub index links all DATA parts
# Requires: git, curl.exe
param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path, [string]$BundleTitle = "repo-bundle", [int]$ChunkChars = 170000, [switch]$Upload, [int]$UploadMaxParts = 999999)
$ErrorActionPreference = "Stop"
if (-not (Get-Command git -EA SilentlyContinue)) { throw "git missing" }
if (-not (Get-Command curl.exe -EA SilentlyContinue)) { throw "curl.exe missing" }
$utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fff") + "Z"
$outDir = Join-Path $env:TEMP ("rentry_hub_" + (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss"))
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$enc = New-Object System.Text.UTF8Encoding $false
$zipPath = Join-Path $outDir "archive.zip"
Push-Location $RepoRoot
try { git archive --format=zip -o $zipPath HEAD } finally { Pop-Location }
$zipBytes = [IO.File]::ReadAllBytes($zipPath)
$b64 = [Convert]::ToBase64String($zipBytes)
$totalParts = [Math]::Max(1, [Math]::Ceiling($b64.Length / $ChunkChars))
Write-Host "ZIP $($zipBytes.Length) b64 $($b64.Length) parts $totalParts"
$partPaths = @()
for ($i = 0; $i -lt $totalParts; $i++) {
  $n = $i + 1; $start = $i * $ChunkChars
  $len = [Math]::Min($ChunkChars, $b64.Length - $start)
  $slice = $b64.Substring($start, $len)
  $hdr = "# DATA part $n / $totalParts`n# UTC_ARCHIVE: $utc`n# CONCAT_ORDER: 1..$totalParts`n`n---BEGIN_B64---`n`n"
  $pf = Join-Path $outDir ("part_{0:D4}.txt" -f $n)
  [IO.File]::WriteAllText($pf, ($hdr + $slice), $enc)
  $partPaths += $pf
}
function Invoke-RentryNew([string]$txtPath,[string]$jar){
  $h = Join-Path $outDir ("home_{0}.html" -f [guid]::NewGuid().ToString("N"))
  Remove-Item $jar -EA SilentlyContinue
  curl.exe -sS -c $jar -b $jar "https://rentry.co/" -o $h | Out-Null
  $tok = $null
  foreach ($line in Get-Content $jar) {
    if ($line.StartsWith("#")) { continue }
    $f = $line -split "`t", -1
    if ($f.Length -ge 7 -and $f[5] -eq "csrftoken") { $tok = $f[6]; break }
  }
  if (-not $tok) { throw "no csrf" }
  $resp = $txtPath + ".resp.json"
  curl.exe -sS -b $jar -c $jar -X POST "https://rentry.co/api/new" -H "Referer: https://rentry.co" --data-urlencode "csrfmiddlewaretoken=$tok" --data-urlencode "url=" --data-urlencode "edit_code=" --data-urlencode "text@$txtPath" -o $resp
  $j = Get-Content $resp -Raw | ConvertFrom-Json
  if ($j.status -ne "200") { throw (Get-Content $resp -Raw) }
  $u = if ($j.url) { $j.url } else { "https://rentry.co/" + $j.url_short }
  return @{ url=$u; edit=$j.edit_code }
}
if (-not $Upload) { Write-Host "Ready: $outDir`nAdd -Upload"; exit 0 }
$meta = @()
$posted = 0
foreach ($pf in $partPaths) {
  if ($posted -ge $UploadMaxParts) { break }
  $jar = Join-Path $outDir ("jar_{0:D4}.txt" -f ($posted+1))
  $r = Invoke-RentryNew $pf $jar
  $meta += "{0}`t{1}`t{2}" -f ($posted+1), $r.url, $r.edit
  Write-Host "PART $($posted+1) $($r.url)"
  Start-Sleep -Seconds 3
  $posted++
}
$incomplete = ($posted -lt $totalParts)
[IO.File]::WriteAllLines((Join-Path $outDir "PART_META.tsv"), $meta, $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# $BundleTitle - hub (one link)")
if ($incomplete) {
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("> **INCOMPLETE:** This hub lists only the first **$posted** of **$totalParts** data parts (hit ``-UploadMaxParts``). Re-run with a higher limit (or omit it) to publish the full bundle.")
  [void]$sb.AppendLine("")
}
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**UTC:** ``$utc``")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Rebuild")
[void]$sb.AppendLine("1. Open each Part link in order.")
[void]$sb.AppendLine("2. Copy only text after ``---BEGIN_B64---`` from each page.")
[void]$sb.AppendLine("3. Concatenate into one base64 string (no newlines). Save as bundle.b64")
[void]$sb.AppendLine("4. Windows: ``certutil -decode bundle.b64 bundle.zip``")
[void]$sb.AppendLine("5. Unzip bundle.zip")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Parts")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| Part | Link |")
[void]$sb.AppendLine("| ---: | :--- |")
foreach ($line in $meta) { $c = $line -split "`t"; [void]$sb.AppendLine("| $($c[0]) | $($c[1]) |") }
$hubPath = Join-Path $outDir "HUB.md"
$hubBody = $sb.ToString()
if ($hubBody.Length -gt 195000) { throw "Hub too large" }
[IO.File]::WriteAllText($hubPath, $hubBody, $enc)
$hubJar = Join-Path $outDir "jar_hub.txt"
$H = Invoke-RentryNew $hubPath $hubJar
Write-Host "HUB $($H.url) edit=$($H.edit)"
