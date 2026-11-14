param(
  [string]$Base = "http://127.0.0.1:4000/api/v1",
  [string]$Username = "admin",
  [string]$Password = "admin123"
)
$ErrorActionPreference = "Stop"
$login = Invoke-RestMethod -Uri "$Base/auth/login" -Method Post -ContentType "application/json" -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$dashboard = Invoke-RestMethod -Uri "$Base/sales-analytics/dashboard?preset=CURRENT_MONTH&timezone=Asia%2FBaku" -Headers $headers
if ($null -eq $dashboard.kpis.requestsTotal) { throw "dashboard: requestsTotal missing" }
if ($null -eq $dashboard.period.start) { throw "dashboard: period missing" }
if ($null -eq $dashboard.distribution) { throw "dashboard: distribution missing" }
$managers = @($dashboard.managers)
if ($managers.Count -eq 0) { throw "dashboard: managers empty" }
$managerId = $managers[0].managerId
if ($managerId) {
  $card = Invoke-RestMethod -Uri "$Base/sales-analytics/managers/$managerId?preset=CURRENT_MONTH&timezone=Asia%2FBaku" -Headers $headers
  if (-not $card.managerId) { throw "manager card: managerId missing" }
}
$drill = Invoke-RestMethod -Uri "$Base/sales-analytics/drilldown?metric=requestsTotal&preset=CURRENT_MONTH&timezone=Asia%2FBaku" -Headers $headers
if ($null -eq $drill.total) { throw "drilldown: total missing" }
Write-Output "OK dashboard requests=$($dashboard.kpis.requestsTotal.value) managers=$($managers.Count) drilldown=$($drill.total)"
