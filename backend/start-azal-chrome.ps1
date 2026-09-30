$ErrorActionPreference = "Stop"

# AZAL Chrome / CDP configuration
$port = 9222
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path $env:LOCALAPPDATA "Google\Chrome\AZAL-CDP"
$azalUrl = "https://www.azal.az/"
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
Write-Host "=== TravelHub AZAL Chrome ===" -ForegroundColor Cyan
Write-Host ""

# 1. Reuse an already running Chrome/CDP session.
if (Test-Cdp) {
    Write-Host "CDP is already available on port $port." -ForegroundColor Green

    # Open AZAL in the existing CDP Chrome.
    # We use Chrome's command line only if the profile is already running;
    # this does not create/replace the user's existing Chrome session.
    try {
        Start-Process -FilePath $chrome -ArgumentList @($azalUrl)
        Write-Host "AZAL opened: $azalUrl" -ForegroundColor Green
    }
    catch {
        Write-Host "CDP is ready, but AZAL could not be opened automatically." -ForegroundColor Yellow
    }

    exit 0
}

# 2. Verify Chrome installation.
if (-not (Test-Path $chrome)) {
    throw "Google Chrome was not found: $chrome"
}

# 3. Create the dedicated AZAL profile directory.
New-Item -ItemType Directory -Force -Path $profile | Out-Null

Write-Host "Starting Chrome with CDP..." -ForegroundColor Yellow
Write-Host "Port   : $port"
Write-Host "Profile: $profile"
Write-Host "URL    : $azalUrl"
Write-Host ""

# 4. Start a dedicated Chrome profile with remote debugging and open AZAL.
Start-Process -FilePath $chrome -ArgumentList @(
    "--remote-debugging-port=$port",
    "--user-data-dir=$profile",
    "--no-first-run",
    "--no-default-browser-check",
    $azalUrl
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