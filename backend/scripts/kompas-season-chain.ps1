$base = 'http://localhost:4000/api/v1'
$log  = 'C:\Users\Administrator\AppData\Local\Temp\2\opencode\kompas-season.log'

# Месячные окна (каждое <=31 дня => синк делает 1 окно, память ограничена).
# Октябрь 2026 (12.10->11.11) гоняется отдельно ДО этой очереди.
$windows = @(
  @{ from = '2026-11-12'; to = '2026-12-11'; label = 'Nov 2026' },
  @{ from = '2026-12-12'; to = '2027-01-11'; label = 'Dec 2026' },
  @{ from = '2027-01-12'; to = '2027-02-11'; label = 'Jan 2027' },
  @{ from = '2027-02-12'; to = '2027-03-11'; label = 'Feb 2027' },
  @{ from = '2027-03-12'; to = '2027-04-11'; label = 'Mar 2027' },
  @{ from = '2027-04-12'; to = '2027-05-11'; label = 'Apr 2027' },
  @{ from = '2027-05-12'; to = '2027-06-11'; label = 'May 2027' },
  @{ from = '2027-06-12'; to = '2027-07-11'; label = 'Jun 2027' },
  @{ from = '2027-07-12'; to = '2027-08-11'; label = 'Jul 2027' },
  @{ from = '2027-08-12'; to = '2027-08-31'; label = 'Aug 2027' }
)

Add-Content -Path $log -Value "=== KOMPAS season chain started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
$i = 0
foreach ($w in $windows) {
  $i++
  $prefix = "[$i/$($windows.Count)] $($w.label) ($($w.from)->$($w.to))"
  try {
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post `
      -Body (@{ username = 'admin'; password = 'admin123' } | ConvertTo-Json) `
      -ContentType 'application/json'
    $tok = $login.accessToken
    $url = "$base/supplier/kompas/sync?dateFrom=$($w.from)&dateTo=$($w.to)"
    Add-Content -Path $log -Value "[$(Get-Date -Format 'HH:mm:ss')] START $prefix"
    $r = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $tok" } -TimeoutSec 14400
    $errCount = if ($r.errors) { $r.errors.Count } else { 0 }
    Add-Content -Path $log -Value "[$(Get-Date -Format 'HH:mm:ss')] DONE  $prefix : countries=$($r.countriesDiscovered) offers=$($r.offersReceived) new=$($r.newCards) updated=$($r.updatedCards) unchanged=$($r.unchangedCards) errors=$errCount"
  } catch {
    Add-Content -Path $log -Value "[$(Get-Date -Format 'HH:mm:ss')] ERR   $prefix : $($_.Exception.Message)"
  }
}
Add-Content -Path $log -Value "=== KOMPAS season chain finished $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
