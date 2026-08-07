$frontendDir = "D:\travelhub_v1\frontend"
Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev > frontend-dev.log 2>&1" -WorkingDirectory $frontendDir
Write-Host "Frontend starting..."
