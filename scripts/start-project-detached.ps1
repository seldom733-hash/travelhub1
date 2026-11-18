# Start Navitravel services detached from the current terminal/agent process.
# WMI Create makes WmiPrvSE the parent, so killing this shell/agent does not
# terminate backend, frontend, MinIO or the supplier Chrome.

$ErrorActionPreference = "Stop"
$root = "C:\Projects\Navitravel"
$node = "C:\Program Files\nodejs\node.exe"
$minio = Join-Path $root ".tools\minio\RELEASE.2025-04-22T22-12-26Z\minio.exe"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path $env:LOCALAPPDATA "Google\Chrome\AZAL-CDP"

function Test-Port([int]$port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Start-Detached([string]$commandLine) {
    $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine }
    if ($result.ReturnValue -ne 0) { throw "WMI Create failed: $($result.ReturnValue)" }
    return $result.ProcessId
}

if (-not (Test-Port 9000)) {
    $cmd = 'cmd.exe /c "set MINIO_ROOT_USER=minioadmin&& set MINIO_ROOT_PASSWORD=minioadmin&& "' +
        $minio + '" server "' + (Join-Path $root "backend\data\minio") + '" --address :9000 --console-address :9001 >> "' +
        (Join-Path $root "reports\minio.log") + '" 2>&1"'
    "minio=$((Start-Detached $cmd))"
}

if (-not (Test-Port 4000)) {
    $cmd = 'cmd.exe /c "cd /d "' + (Join-Path $root "backend") + '" && "' + $node + '" dist/main.js >> "' +
        (Join-Path $root "reports\backend.log") + '" 2>&1"'
    "backend=$((Start-Detached $cmd))"
}

if (-not (Test-Port 3000)) {
    $cmd = 'cmd.exe /c "cd /d "' + (Join-Path $root "frontend") + '" && "' + $node +
        '" node_modules\next\dist\bin\next start -p 3000 >> "' + (Join-Path $root "reports\frontend.log") + '" 2>&1"'
    "frontend=$((Start-Detached $cmd))"
}

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version" -TimeoutSec 3 | Out-Null
} catch {
    $args = '--remote-debugging-port=9222 --user-data-dir="' + $profile +
        '" --no-first-run --no-default-browser-check --window-position=-32000,-32000 --window-size=1280,900 ' +
        '--disable-backgrounding-occluded-windows --disable-renderer-backgrounding ' +
        '--disable-features=CalculateNativeWinOcclusion --new-window https://www.azal.az/ https://www.aviasales.az/'
    "chrome=$((Start-Detached ('"' + $chrome + '" ' + $args)))"
}

Start-Sleep -Seconds 20
Get-NetTCPConnection -State Listen -LocalPort 3000,4000,9000,9222 -ErrorAction SilentlyContinue |
    Select-Object LocalPort, OwningProcess
