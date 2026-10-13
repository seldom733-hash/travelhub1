# Импорт остальных стран KOMPAS-отелей (47 стран, кроме уже импортированных TR/TH/AE/GE/EG/MV).
# Разбивает на батчи, между батчами пауза (снижает риск капчи). Итог каждого батча — в JSON-файл.
$ErrorActionPreference = "Stop"
$base = "http://localhost:4000/api/v1"
$outDir = "C:\Users\Administrator\AppData\Local\Temp\2\opencode"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

# 47 оставшихся ISO (все, кроме TR,TH,AE,GE,EG,MV).
$batches = @(
  ,@("AT","AZ","AD","AR","AM","BH","BG","BR","GB","HU","VN","DE","GR","DO")
  ,@("TZ","IN","ID","ES","IT","KZ","KH","QA","KE","CY","CN","MU","MY","MA")
  ,@("MX","NL","OM","PT","SA","SC","SG","SI","US","TN","UZ","UA","PH","ME")
  ,@("CZ","CH","LK","KR","JP")
)

# Авторизация.
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin123"}' -TimeoutSec 60
$h = @{ Authorization = "Bearer $($login.accessToken)" }
"auth ok (token len=$($login.accessToken.Length))"

# Параметры поиска (узнаём из сезона импорта туров): окно дат + ночи.
# Отель-импорт использует те же дефолты, что и валидация: 2 взрослых, 0 детей.
$dateFrom = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
$dateTo   = (Get-Date).AddDays(31).ToString("yyyy-MM-dd")
$nights   = 7
$maxPages = 8

$grand = [ordered]@{ started=$ts; countriesProcessed=0; hotelsNew=0; hotelsTotal=0; tariffs=0; errors=@(); batches=@() }

$bi = 0
foreach ($batch in $batches) {
  $bi++
  $isos = $batch -join ","
  Write-Host "=== BATCH $bi/$($batches.Count): $isos ==="
  $resFile = Join-Path $outDir "hotel-rest-batch$bi-$ts.json"
  try {
    $uri = "$base/supplier/kompas/hotel-sync?countryIsos=$isos&dateFrom=$dateFrom&dateTo=$dateTo&nights=$nights&maxPages=$maxPages"
    $r = Invoke-RestMethod -Uri $uri -Method Post -Headers $h -TimeoutSec 1800
    $r | ConvertTo-Json -Depth 6 | Set-Content -Path $resFile -Encoding UTF8
    Write-Host ("  countries={0} rows={1} new={2} updated={3} unchanged={4} tariffsCreated={5} tariffsUpdated={6} errors={7}" -f `
      $r.countriesProcessed, $r.rowsReceived, $r.newCards, $r.updatedCards, $r.unchangedCards, $r.tariffsCreated, $r.tariffsUpdated, $r.errors.Count)
    if ($r.errors.Count) { Write-Host "  ERRORS: $($r.errors -join ' | ')" }
    $grand.countriesProcessed += $r.countriesProcessed
    $grand.hotelsNew          += $r.newCards
    $grand.tariffs            += ($r.tariffsCreated + $r.tariffsUpdated)
    foreach ($e in $r.errors) { $grand.errors += "[batch$bi] $e" }
    $grand.batches += [ordered]@{ batch=$bi; isos=$isos; new=$r.newCards; updated=$r.updatedCards; unchanged=$r.unchangedCards; errors=$r.errors.Count; file=$resFile }
  } catch {
    Write-Host "  BATCH $bi FAILED: $($_.Exception.Message)"
    $grand.errors += "[batch$bi] FAILED: $($_.Exception.Message)"
    $grand.batches += [ordered]@{ batch=$bi; isos=$isos; failed=$true; message=$($_.Exception.Message) }
  }
  if ($bi -lt $batches.Count) { Write-Host "  (пауза 20с между батчами)"; Start-Sleep -Seconds 20 }
}

# Итог в БД (фактические числа, не сумма ответов).
$env:PGPASSWORD = "Nadir@da7374#"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$q = @'
SELECT p.attributes->>'countryCode' AS cc, COUNT(*) AS hotels
FROM catalog."Product" p WHERE p."supplierRef" LIKE 'KOMPASHTL-%'
GROUP BY 1 ORDER BY 1;
'@
$byCountry = $q | & $psql -h 127.0.0.1 -U postgres -d travelhub -t -A
$q2 = @'
SELECT COUNT(*) FROM catalog."Product" WHERE "supplierRef" LIKE 'KOMPASHTL-%';
'@
$grand.hotelsTotal = (Invoke-Expression ($q2 | & $psql -h 127.0.0.1 -U postgres -d travelhub -t -A)) 2>$null
if (-not $grand.hotelsTotal) { $grand.hotelsTotal = ($q2 | & $psql -h 127.0.0.1 -U postgres -d travelhub -t -A).Trim() }
$grand | Add-Member -NotePropertyName byCountry -NotePropertyValue $byCountry
$grand.finished = Get-Date -Format "yyyyMMdd-HHmmss"

$summaryFile = Join-Path $outDir "hotel-rest-summary-$ts.json"
$grand | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryFile -Encoding UTF8
Write-Host "=== DONE ==="
Write-Host "new hotels this run: $($grand.hotelsNew)  countries processed: $($grand.countriesProcessed)  errors: $($grand.errors.Count)"
Write-Host "total KOMPAS hotels in DB: $($grand.hotelsTotal)"
Write-Host "summary: $summaryFile"
Write-Host "--- by country ---"
Write-Host $byCountry
