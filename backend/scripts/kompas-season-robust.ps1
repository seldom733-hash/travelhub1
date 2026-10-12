$backendDir = 'C:\Projects\Navitravel\backend'
$log        = 'C:\Users\Administrator\AppData\Local\Temp\2\opencode\kompas-season.log'
$backendOut = 'C:\Users\Administrator\AppData\Local\Temp\2\opencode\kompas-backend.log'
$base       = 'http://localhost:4000/api/v1'

# 4GB heap: enough for one monthly chunk (default 2GB OOM'd historically),
# leaves ~11GB for chromium + frontend + OS within the 16GB system.
$env:NODE_OPTIONS = '--max-old-space-size=4096'

function Log($msg) { Add-Content -Path $log -Value "[$(Get-Date -Format 'HH:mm:ss')] $msg" }

function Stop-Backend {
  $c = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 4 }
}

function Start-Backend {
  Stop-Backend
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "npm run dev > `"$backendOut`" 2>&1" `
    -WorkingDirectory $backendDir -WindowStyle Hidden
  # Wait for API ready (ts-node compile ~100s). Poll port up to 6 min.
  for ($i = 0; $i -lt 72; $i++) {
    Start-Sleep -Seconds 5
    if ((Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue).TcpTestSucceeded) {
      # verify login works
      try {
        Invoke-RestMethod -Uri "$base/auth/login" -Method Post `
          -Body (@{ username = 'admin'; password = 'admin123' } | ConvertTo-Json) `
          -ContentType 'application/json' -TimeoutSec 20 | Out-Null
        return $true
      } catch { Start-Sleep -Seconds 3 }
    }
  }
  return $false
}

# Remaining months (Nov-Feb already DONE before the crash).
$months = @(
  @{ from = '2027-03-12'; to = '2027-04-11'; label = 'Mar 2027' },
  @{ from = '2027-04-12'; to = '2027-05-11'; label = 'Apr 2027' },
  @{ from = '2027-05-12'; to = '2027-06-11'; label = 'May 2027' },
  @{ from = '2027-06-12'; to = '2027-07-11'; label = 'Jun 2027' },
  @{ from = '2027-07-12'; to = '2027-08-11'; label = 'Jul 2027' },
  @{ from = '2027-08-12'; to = '2027-08-31'; label = 'Aug 2027' }
)

Log "=== ROBUST season chain started (Mar-Aug, fresh 4GB backend per chunk) ==="
$i = 0
foreach ($m in $months) {
  $i++
  $prefix = "[$i/$($months.Count)] $($m.label) ($($m.from)->$($m.to))"
  Log "START $prefix"
  if (-not (Start-Backend)) { Log "ERR  $prefix : backend failed to start"; continue }
  try {
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post `
      -Body (@{ username = 'admin'; password = 'admin123' } | ConvertTo-Json) `
      -ContentType 'application/json' -TimeoutSec 60
    $tok = $login.accessToken
    $url = "$base/supplier/kompas/sync?dateFrom=$($m.from)&dateTo=$($m.to)"
    $r = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $tok" } -TimeoutSec 7200
    $errCount = if ($r.errors) { $r.errors.Count } else { 0 }
    Log "DONE $prefix : countries=$($r.countriesDiscovered) offers=$($r.offersReceived) new=$($r.newCards) updated=$($r.updatedCards) unchanged=$($r.unchangedCards) errors=$errCount"
  } catch {
    Log "ERR  $prefix : $($_.Exception.Message)"
  }
  Stop-Backend   # reset memory so the next chunk starts fresh (prevents system OOM)
}
Log "=== ROBUST season chain finished ==="
