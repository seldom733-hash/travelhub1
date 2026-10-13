# Переимпорт KOMPAS-отелей для починки имён («Unknown Hotel» → реальное имя).
# Причина: у части отелей нет <a> в td.link-hotel — имя теперь берётся из текста ячейки.
# Воспроизводит ОРИГИНАЛЬНЫЕ окна дат, чтобы вернуться те же строки:
#   топ-6 (TR,AE,EG,TH,MV,GE): dateFrom=2026-10-24 (dateTo=+1), как первый прогон;
#   остальные 23: dateFrom=сегодня+30, dateTo=+31 (как import-hotel-rest.ps1).
$ErrorActionPreference = "Stop"
$base = "http://localhost:4000/api/v1"
$outDir = "C:\Users\Administrator\AppData\Local\Temp\2\opencode"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$top6   = "TR,AE,EG,TH,MV,GE"
$rest23 = "AZ,BH,CN,CZ,GR,HU,ID,IN,KE,KZ,LK,MU,MY,OM,QA,SA,SC,SG,SI,TZ,UA,UZ,VN"

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin123"}' -TimeoutSec 60
$h = @{ Authorization = "Bearer $($login.accessToken)" }
"auth ok"

$jobs = @(
  @{ name = "top6";   isos = $top6;   dateFrom = "2026-10-24"; dateTo = "2026-10-25" },
  @{ name = "rest23"; isos = $rest23; dateFrom = (Get-Date).AddDays(30).ToString("yyyy-MM-dd"); dateTo = (Get-Date).AddDays(31).ToString("yyyy-MM-dd") }
)

$grand = [ordered]@{ started=$ts; countries=0; rows=0; newCards=0; updated=0; unchanged=0; tariffs=0; errors=@() }

foreach ($j in $jobs) {
  Write-Host "=== $($j.name): $($j.isos) window $($j.dateFrom)..$($j.dateTo) ==="
  try {
    $uri = "$base/supplier/kompas/hotel-sync?countryIsos=$($j.isos)&dateFrom=$($j.dateFrom)&dateTo=$($j.dateTo)&nights=7&maxPages=8"
    $r = Invoke-RestMethod -Uri $uri -Method Post -Headers $h -TimeoutSec 3600
    $r | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir "hotel-rename-$($j.name)-$ts.json") -Encoding UTF8
    Write-Host ("  countries={0} rows={1} new={2} updated={3} unchanged={4} tariffs={5} errors={6}" -f `
      $r.countriesProcessed, $r.rowsReceived, $r.newCards, $r.updatedCards, $r.unchangedCards, `
      ($r.tariffsCreated + $r.tariffsUpdated), $r.errors.Count)
    if ($r.errors.Count) { Write-Host "  ERRORS: $($r.errors -join ' | ')"; $grand.errors += $r.errors }
    $grand.countries += $r.countriesProcessed
    $grand.rows      += $r.rowsReceived
    $grand.newCards  += $r.newCards
    $grand.updated   += $r.updatedCards
    $grand.unchanged += $r.unchangedCards
    $grand.tariffs   += ($r.tariffsCreated + $r.tariffsUpdated)
  } catch {
    Write-Host "  FAILED: $($_.Exception.Message)"
    $grand.errors += "[$($j.name)] $($_.Exception.Message)"
  }
  if ($j.name -eq "top6") { Write-Host "  (пауза 20с)"; Start-Sleep -Seconds 20 }
}

$grand.finished = Get-Date -Format "yyyyMMdd-HHmmss"
$grand | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir "hotel-rename-summary-$ts.json") -Encoding UTF8
Write-Host "=== DONE: countries=$($grand.countries) rows=$($grand.rows) new=$($grand.newCards) updated=$($grand.updated) unchanged=$($grand.unchanged) errors=$($grand.errors.Count) ==="
