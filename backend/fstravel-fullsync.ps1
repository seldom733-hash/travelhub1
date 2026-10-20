$ErrorActionPreference = "Continue"
$token = (Get-Content "C:\Users\Administrator\AppData\Local\Temp\2\opencode\token.txt" -Raw).Trim()
$headers = @{ Authorization = "Bearer $token" }
$log = "C:\Projects\Navitravel\backend\fstravel-fullsync.log"
$jsonPath = "C:\Projects\Navitravel\backend\fstravel-countries.json"
$countries = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
# Pause between countries: the SAMO antibot trips on sustained bursts and
# then blocks for a long window (verified 2026-10-18) — 15 min of quiet per
# country keeps the session unlockable by the auto-solver.
$pauseSec = 900
Add-Content -Path $log -Encoding UTF8 -Value "=== FULL SYNC START $(Get-Date -Format o) countries=$($countries.Count) pause=${pauseSec}s ==="
for ($i = 0; $i -lt $countries.Count; $i++) {
    $country = $countries[$i]
    $url = "http://localhost:4000/api/v1/supplier/fstravel/sync?country=" + [uri]::EscapeDataString($country)
    $start = Get-Date
    try {
        $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -TimeoutSec 5400
        $line = "$(Get-Date -Format o) [$country] OK offers=$($resp.offersReceived) new=$($resp.newCards) updated=$($resp.updatedCards) unchanged=$($resp.unchangedCards) errors=$(@($resp.errors).Count) $([math]::Round(((Get-Date)-$start).TotalMinutes,1))min"
        if (@($resp.errors).Count -gt 0) { $line += " errdetail=" + (@($resp.errors) -join " | ") }
    } catch {
        $line = "$(Get-Date -Format o) [$country] FAIL $($_.Exception.Message) $([math]::Round(((Get-Date)-$start).TotalMinutes,1))min"
    }
    Add-Content -Path $log -Encoding UTF8 -Value $line
    Write-Output $line
    if ($i -lt ($countries.Count - 1)) {
        Write-Output "$(Get-Date -Format o) [pause] ${pauseSec}s before next country"
        Start-Sleep -Seconds $pauseSec
    }
}
Add-Content -Path $log -Encoding UTF8 -Value "=== FULL SYNC END $(Get-Date -Format o) ==="
Write-Output "ALL DONE"
