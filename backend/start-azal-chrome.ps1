$ErrorActionPreference = "Stop"

# AZAL + Aviasales Chrome / CDP configuration
# Both suppliers use the same browser session over CDP:
#   AZAL       — Cloudflare-protected UI, keep the AZAL tab open.
#   Aviasales  — AWS WAF session cookies, keep the Aviasales tab open.
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

Write-Host ""
Write-Host "=== TravelHub AZAL + Aviasales Chrome ===" -ForegroundColor Cyan
Write-Host ""

# 1. Reuse an already running Chrome/CDP session.
if (Test-Cdp) {
    Write-Host "CDP is already available on port $port." -ForegroundColor Green

    # Open both supplier tabs in the ALREADY RUNNING CDP browser. Do not start
    # another Chrome with a different profile: that would create tabs outside
    # the CDP session the backend reads.
    try {
        $cdpBase = "http://127.0.0.1:$port"
        Invoke-RestMethod -Method Put -Uri "$cdpBase/json/new?$([uri]::EscapeDataString($azalUrl))" -TimeoutSec 5 | Out-Null
        Invoke-RestMethod -Method Put -Uri "$cdpBase/json/new?$([uri]::EscapeDataString($aviasalesUrl))" -TimeoutSec 5 | Out-Null
        Write-Host "AZAL opened: $azalUrl" -ForegroundColor Green
        Write-Host "Aviasales opened: $aviasalesUrl" -ForegroundColor Green
    }
    catch {
        Write-Host "CDP is ready, but supplier tabs could not be opened automatically." -ForegroundColor Yellow
        Write-Host "Open these URLs manually in the CDP Chrome window:" -ForegroundColor Yellow
        Write-Host "  $azalUrl" -ForegroundColor Yellow
        Write-Host "  $aviasalesUrl" -ForegroundColor Yellow
    }

    exit 0
}

# 2. Verify Chrome installation.
if (-not (Test-Path $chrome)) {
    throw "Google Chrome was not found: $chrome"
}

# 3. Create the dedicated supplier profile directory.
New-Item -ItemType Directory -Force -Path $profile | Out-Null

Write-Host "Starting Chrome with CDP..." -ForegroundColor Yellow
Write-Host "Port    : $port"
Write-Host "Profile : $profile"
Write-Host "AZAL    : $azalUrl"
Write-Host "Aviasales: $aviasalesUrl"
Write-Host ""

# 4. Start a dedicated Chrome profile with remote debugging and open both suppliers.
Start-Process -FilePath $chrome -ArgumentList @(
    "--remote-debugging-port=$port",
    "--user-data-dir=$profile",
    "--no-first-run",
    "--no-default-browser-check",
    $azalUrl,
    $aviasalesUrl
)

# 5. Wait until CDP is available.
$ready = $false

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1

    if (Test-Cdp) {
        $ready = $true
        break
    }
}

if (-not $ready) {
    throw "Chrome started, but CDP port $port did not become available within 30 seconds."
}

Write-Host ""
Write-Host "CDP is ready: http://127.0.0.1:$port" -ForegroundColor Green
Write-Host "AZAL opened automatically: $azalUrl" -ForegroundColor Green
Write-Host "Aviasales opened automatically: $aviasalesUrl" -ForegroundColor Green
Write-Host ""

# 6. Show the current CDP browser information.
try {
    $info = Invoke-RestMethod -Uri $versionUrl -TimeoutSec 3
    Write-Host "Browser: $($info.Browser)" -ForegroundColor Gray
    Write-Host "Protocol: $($info.'Protocol-Version')" -ForegroundColor Gray
}
catch {
    # CDP is already confirmed above; this is informational only.
}

Write-Host ""
Write-Host "If AZAL shows a Cloudflare verification, complete it in Chrome once." -ForegroundColor Yellow
Write-Host "If Aviasales asks for a WAF check, complete it in Chrome once." -ForegroundColor Yellow
Write-Host "Keep both supplier tabs open while TravelHub is running." -ForegroundColor Yellow
