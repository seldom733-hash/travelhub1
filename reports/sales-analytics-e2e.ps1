param(
  [string]$Api = "http://127.0.0.1:4000/api/v1",
  [string]$Web = "http://127.0.0.1:3000",
  [string]$Username = "admin",
  [string]$Password = "admin123"
)
$ErrorActionPreference = "Stop"
$login = Invoke-RestMethod -Uri "$Api/auth/login" -Method Post -ContentType "application/json" -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.accessToken)" }
$q = "preset=LAST_30_DAYS&timezone=Asia%2FBaku"

$d = Invoke-RestMethod -Uri "$Api/sales-analytics/dashboard?$q" -Headers $h
foreach ($k in @("requestsTotal", "ordersCreated", "bookingsConfirmed", "completedDeals", "closedDeals", "salesAmount", "capturedRevenue", "grossProfit")) {
  if ($null -eq $d.kpis.$k) { throw "KPI missing: $k" }
}
if ($null -eq $d.reconciliation) { throw "reconciliation missing" }
if ($null -eq $d.distribution) { throw "distribution missing" }
if ($null -eq $d.funnel) { throw "funnel missing" }
if ($null -eq $d.activity) { throw "activity missing" }
if ($null -eq $d.orders) { throw "orders missing" }

$start = ([datetime]$d.period.start).ToString("yyyy-MM-dd")
$end = ([datetime]$d.period.end).AddDays(-1).ToString("yyyy-MM-dd")
$deals = Invoke-RestMethod -Uri "$Api/finance/deals?dateFrom=$start&dateTo=$end&pageSize=100" -Headers $h
if ($null -ne $deals.kpi) {
  $salesDiff = [math]::Abs([double]$d.kpis.salesAmount.value - [double]$deals.kpi.salesAmount)
  $costDiff = [math]::Abs([double]$d.kpis.costAmount.value - [double]$deals.kpi.costAmount)
  $profitDiff = [math]::Abs([double]$d.kpis.grossProfit.value - [double]$deals.kpi.grossMargin)
  if ($salesDiff -gt 0.02 -or $costDiff -gt 0.02 -or $profitDiff -gt 0.02) {
    throw "Sales Analytics vs Sales Register mismatch: sales=$salesDiff cost=$costDiff profit=$profitDiff"
  }
}

$managerId = ($d.managers | Select-Object -First 1).managerId
if ($managerId) {
  $card = Invoke-RestMethod -Uri "$Api/sales-analytics/managers/$managerId?$q" -Headers $h
  if (-not $card.managerId) { throw "manager card missing managerId" }
  if ($null -eq $card.assignments) { throw "manager card missing assignments" }
}

foreach ($metric in @("requestsTotal", "ordersCreated", "completedDeals", "closedDeals", "capturedRevenue")) {
  $drill = Invoke-RestMethod -Uri "$Api/sales-analytics/drilldown?metric=$metric&$q" -Headers $h
  if ($null -eq $drill.total) { throw "drilldown missing total: $metric" }
}

foreach ($route in @("/app/analytics/sales", "/app/analytics/sales/managers", "/app/analytics/sales/activity", "/app/analytics/sales/funnel", "/app/analytics/sales/deals", "/app/analytics/sales/distribution")) {
  $page = Invoke-WebRequest -Uri "$Web$route" -UseBasicParsing
  if ($page.StatusCode -ne 200) { throw "route failed: $route" }
}

Write-Output ("OK E2E requests={0} managers={1} sales={2} profit={3} issueCount={4}" -f $d.kpis.requestsTotal.value, $d.managers.Count, $d.kpis.salesAmount.value, $d.kpis.grossProfit.value, $d.reconciliation.issues.Count)
