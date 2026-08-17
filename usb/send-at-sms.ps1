param(
  [Parameter(Mandatory = $true)][string]$Port,
  [int]$Baud = 115200
)

$ErrorActionPreference = "Stop"
$To = $env:SMS_TO
$Body = $env:SMS_BODY
if (-not $To) { throw "SMS_TO is empty." }
if (-not $Body) { throw "SMS_BODY is empty." }

$serial = New-Object System.IO.Ports.SerialPort $Port, $Baud, "None", 8, "One"
$serial.NewLine = "`r"
$serial.ReadTimeout = 8000
$serial.WriteTimeout = 8000
$serial.DtrEnable = $true
$serial.RtsEnable = $true
$serial.Open()
try {
  $serial.DiscardInBuffer()
  $serial.DiscardOutBuffer()
  $serial.WriteLine("AT")
  Start-Sleep -Milliseconds 400
  [void]$serial.ReadExisting()
  $serial.WriteLine("AT+CMGF=1")
  Start-Sleep -Milliseconds 400
  [void]$serial.ReadExisting()
  $serial.Write(("AT+CMGS=`"{0}`"`r" -f $To))
  Start-Sleep -Milliseconds 600
  [void]$serial.ReadExisting()
  $serial.Write($Body)
  $serial.Write([char]26)
  Start-Sleep -Milliseconds 4500
  $resp = $serial.ReadExisting()
  if ($resp -notmatch "OK") {
    throw ("Modem did not accept the text: {0}" -f $resp)
  }
  Write-Output "sent"
}
finally {
  if ($serial.IsOpen) { $serial.Close() }
  $serial.Dispose()
}
