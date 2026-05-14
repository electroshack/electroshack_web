# One-off resume after 429: parts 31..N + hub. Edit $outDir, $utc, $pre if reusing pattern.
$ErrorActionPreference = "Stop"
$outDir = "C:\Users\ayaan\AppData\Local\Temp\rentry_hub_20260429205511"
$utc = "2026-04-29T20:55:11.604Z"
$BundleTitle = "electroshack-web"
$enc = New-Object System.Text.UTF8Encoding $false
$totalParts = 127
$pre = @(
  "1`thttps://rentry.co/ka3rf8ye",
  "2`thttps://rentry.co/ipd45pqm",
  "3`thttps://rentry.co/ub97vvqk",
  "4`thttps://rentry.co/zo5bs26k",
  "5`thttps://rentry.co/zgqktq6a",
  "6`thttps://rentry.co/9e6qn7rn",
  "7`thttps://rentry.co/xg7w39uo",
  "8`thttps://rentry.co/phdqm6ot",
  "9`thttps://rentry.co/xpqpwe8a",
  "10`thttps://rentry.co/gxranhwv",
  "11`thttps://rentry.co/3hit8o2b",
  "12`thttps://rentry.co/izxo3gu2",
  "13`thttps://rentry.co/skx9gtsu",
  "14`thttps://rentry.co/vnias3xw",
  "15`thttps://rentry.co/oy56prrr",
  "16`thttps://rentry.co/buiqgokh",
  "17`thttps://rentry.co/qfpxxi35",
  "18`thttps://rentry.co/4xzh9wzo",
  "19`thttps://rentry.co/f9xyki8v",
  "20`thttps://rentry.co/2bgzy9zg",
  "21`thttps://rentry.co/yondg5ks",
  "22`thttps://rentry.co/gwwdrn8a",
  "23`thttps://rentry.co/gqgk24pc",
  "24`thttps://rentry.co/p7m625tc",
  "25`thttps://rentry.co/zrpz6of5",
  "26`thttps://rentry.co/yqsek5gh",
  "27`thttps://rentry.co/vdqyxkh3",
  "28`thttps://rentry.co/honzvv7y",
  "29`thttps://rentry.co/s4esh99o",
  "30`thttps://rentry.co/9sgggnvd",
  "31`thttps://rentry.co/xsoqoca7"
)
function Invoke-RentryNew([string]$txtPath, [string]$jar) {
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
  $attempt = 0
  while ($true) {
    $attempt++
    curl.exe -sS -b $jar -c $jar -X POST "https://rentry.co/api/new" -H "Referer: https://rentry.co" --data-urlencode "csrfmiddlewaretoken=$tok" --data-urlencode "url=" --data-urlencode "edit_code=" --data-urlencode "text@$txtPath" -o $resp
    $raw = Get-Content $resp -Raw
    $j = $raw | ConvertFrom-Json
    if ($j.status -eq "200") {
      $u = if ($j.url) { $j.url } else { "https://rentry.co/" + $j.url_short }
      return @{ url = $u; edit = $j.edit_code }
    }
    if ($raw -match "429") {
      $wait = [Math]::Min(360, 90 + ($attempt * 45))
      Write-Host "429 wait ${wait}s"
      Start-Sleep -Seconds $wait
      continue
    }
    throw $raw
  }
}
$meta = [System.Collections.ArrayList]@()
foreach ($x in $pre) { [void]$meta.Add($x) }
for ($n = 32; $n -le $totalParts; $n++) {
  $pf = Join-Path $outDir ("part_{0:D4}.txt" -f $n)
  $jar = Join-Path $outDir ("jar_resume_{0:D4}.txt" -f $n)
  Write-Host "Upload part $n"
  $r = Invoke-RentryNew $pf $jar
  [void]$meta.Add("$n`t$($r.url)")
  Write-Host $r.url
  Start-Sleep -Seconds 18
}
[IO.File]::WriteAllLines((Join-Path $outDir "PART_META.tsv"), $meta.ToArray(), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# $BundleTitle - hub (one link)")
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
foreach ($line in $meta) {
  $c = $line -split "`t"
  [void]$sb.AppendLine("| $($c[0]) | $($c[1]) |")
}
$hubPath = Join-Path $outDir "HUB.md"
$hubBody = $sb.ToString()
if ($hubBody.Length -gt 195000) { throw "Hub too large" }
[IO.File]::WriteAllText($hubPath, $hubBody, $enc)
$hubJar = Join-Path $outDir "jar_hub_resume.txt"
$H = Invoke-RentryNew $hubPath $hubJar
Write-Host "HUB $($H.url) edit=$($H.edit)"
