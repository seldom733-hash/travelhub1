$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travelhub1"
$backendDir = "D:\travelhub_v1\backend"
Start-Process -WindowStyle Hidden -FilePath "node.exe" -ArgumentList "dist/main.js" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\backend-dev.log" -RedirectStandardError "$backendDir\backend-dev.err.log"
Write-Host "Backend started (compiled dist/main.js)"
