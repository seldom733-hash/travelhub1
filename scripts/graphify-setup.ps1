param(
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$venv = Join-Path $root ".venv-graphify"
$python = Join-Path $venv "Scripts\python.exe"
$graphify = Join-Path $venv "Scripts\graphify.exe"

if (-not (Test-Path $python)) {
  Write-Host "Creating Python virtual environment..."
  python -m venv $venv
}

if (-not (Test-Path $graphify)) {
  Write-Host "Installing Graphify with the SQL extra..."
  & (Join-Path $venv "Scripts\pip.exe") install --disable-pip-version-check "graphifyy[sql]"
}

if ($Rebuild -or -not (Test-Path (Join-Path $root "graphify-out\graph.json"))) {
  Write-Host "Building the Navitravel code graph..."
  & $graphify update . --force
} else {
  Write-Host "Graph already exists. Use -Rebuild to refresh it."
}

Write-Host ""
Write-Host "Ready. Examples:"
Write-Host "  .\.venv-graphify\Scripts\graphify.exe query `"How does supplier catalog work?`""
Write-Host "  .\.venv-graphify\Scripts\graphify.exe explain `"SupplierCatalogService`""
Write-Host "  .\.venv-graphify\Scripts\graphify.exe update . --force"
