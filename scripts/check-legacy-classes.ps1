$ErrorActionPreference = "Continue"
$root = "C:\Projects\Navitravel\frontend"
$dirs = @(
  (Join-Path $root "app"),
  (Join-Path $root "components"),
  (Join-Path $root "lib"),
  (Join-Path $root "hooks")
)
$legacy = @()
foreach ($d in $dirs) {
  if (-not (Test-Path $d)) { continue }
  $files = Get-ChildItem -Path $d -Recurse -Include *.tsx,*.ts -File -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $p = $f.FullName
    if ($p -match '\\node_modules\\|\.next\|\\.next') { continue }
    $t = Get-Content -Raw $p -ErrorAction SilentlyContinue
    if ($null -eq $t) { continue }
    if ($t -match '(slate|blue|indigo|sky|cyan|emerald|green|red|rose|amber|yellow|orange|teal|lime|purple|violet|pink|indigo)') {
      $legacy += $p
    }
  }
}
Write-Output ("FILES_WITH_LEGACY=" + $legacy.Count)
$legacy | Select-Object -First 60 | ForEach-Object { Write-Output $_ }
