# Infinity Storm Game Launcher
Write-Host "Starting Infinity Storm..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js $nodeVersion detected" -ForegroundColor Cyan
} catch {
    Write-Host "Node.js is not installed!" -ForegroundColor Red
    Write-Host "Opening game directly in browser (assets may not load properly)..." -ForegroundColor Yellow
    Start-Process "index.html"
    exit
}

# Start the server
Write-Host "Starting local server on http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3000"
} | Out-Null

# Run the server
node start-server.js 