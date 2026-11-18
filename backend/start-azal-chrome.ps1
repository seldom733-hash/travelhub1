$ErrorActionPreference = "Stop"

# AZAL + Aviasales Chrome / CDP configuration.
# The browser is intentionally opened OFF-SCREEN: the backend needs the CDP
# session and the supplier cookies, but the operator must not see the window.
$port = 9222
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path $env:LOCALAPPDATA "Google\Chrome\AZAL-CDP"
$azalUrl = "https://www.azal.az/"
$aviasalesUrl = "https://www.aviasales.az/"
$versionUrl = "http://127.0.0.1:$port/json/version"

function Test-Cdp {
    try {
        $response = Invoke-RestMethod -Uri $versionUrl -TimeoutSec 2
        return ($null -ne $response.webSocketDebuggerUrl)
    }
    catch {
        return $false
    }
}

function Get-CdpProcesses {
    Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -match [regex]::Escape("--remote-debugging-port=$port") -or
                $_.CommandLine -match [regex]::Escape($profile)
            )
        }
}

Write-Host ""
Write-Host "=== TravelHub AZAL + Aviasales Chrome (invisible) ===" -ForegroundColor Cyan
Write-Host ""

# 1. Close previous dedicated CDP windows completely. A new run must never
#    reuse a window from the previous run.
$old = @(Get-CdpProcesses)
if ($old.Count -gt 0) {
    Write-Host "Closing previous CDP Chrome processes: $($old.Count)" -ForegroundColor Yellow
    $pids = @($old | Select-Object -ExpandProperty ProcessId -Unique)
    foreach ($procId in $pids) {
        # cmd wrapper suppresses taskkill's expected "process not found" error
        # when a child Chrome process already exited.
        & cmd.exe /c "taskkill /PID $procId /T /F >nul 2>&1" | Out-Null
    }
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 300
        if (-not (Test-Cdp) -and @(Get-CdpProcesses).Count -eq 0) { break }
    }
}

# 2. Verify Chrome installation and prepare the dedicated profile.
if (-not (Test-Path $chrome)) {
    throw "Google Chrome was not found: $chrome"
}
New-Item -ItemType Directory -Force -Path $profile | Out-Null

# 3. Start a NEW off-screen Chrome. Keep a real headed browser (not headless):
#    AZAL Cloudflare and Aviasales WAF need a normal browser profile.
Write-Host "Starting invisible Chrome with CDP..." -ForegroundColor Yellow
Write-Host "Port    : $port"
Write-Host "Profile : $profile"
Write-Host "AZAL    : $azalUrl"
Write-Host "Aviasales: $aviasalesUrl"
Write-Host ""

Start-Process -FilePath $chrome -ArgumentList @(
    "--remote-debugging-port=$port",
    "--user-data-dir=$profile",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-position=-32000,-32000",
    "--window-size=1280,900",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
    "--new-window",
    $azalUrl,
    $aviasalesUrl
) -WindowStyle Hidden

# 4. Wait for CDP. The window itself remains off-screen.
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Cdp) {
        $ready = $true
        break
    }
}

if (-not $ready) {
    throw "Chrome started, but CDP port $port did not become available within 40 seconds."
}

Write-Host ""
Write-Host "CDP is ready: http://127.0.0.1:$port" -ForegroundColor Green
Write-Host "Chrome window is off-screen (not visible)." -ForegroundColor Green
Write-Host "AZAL tab:      $azalUrl"
Write-Host "Aviasales tab: $aviasalesUrl"
Write-Host ""

# 5. Browser info for diagnostics.
try {
    $info = Invoke-RestMethod -Uri $versionUrl -TimeoutSec 3
    Write-Host "Browser: $($info.Browser)" -ForegroundColor Gray
    Write-Host "Protocol: $($info.'Protocol-Version')" -ForegroundColor Gray
}
catch {
    # CDP already confirmed; this is informational only.
}

Write-Host ""
Write-Host "Do not close these tabs: the backend uses this CDP session." -ForegroundColor Yellow
