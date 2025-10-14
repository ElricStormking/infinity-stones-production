# Fix Database Configuration for Supabase Local
Write-Host "Fixing database configuration..." -ForegroundColor Yellow
Write-Host ""

$envFile = ".env"

# Read current .env
$content = Get-Content $envFile -Raw

# Replace database settings
$content = $content -replace 'DATABASE_URL=postgresql://postgres:test_password_123@localhost:5439/infinity_storm_test', 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres'
$content = $content -replace 'DB_HOST=postgres', 'DB_HOST=127.0.0.1'
$content = $content -replace 'DB_PORT=5432', 'DB_PORT=54322'
$content = $content -replace 'DB_NAME=infinity_storm_test', 'DB_NAME=postgres'
$content = $content -replace 'DB_PASSWORD=test_password_123', 'DB_PASSWORD=postgres'

# Write back
Set-Content -Path $envFile -Value $content

Write-Host "✅ Database configuration updated!" -ForegroundColor Green
Write-Host ""
Write-Host "New settings:" -ForegroundColor Cyan
Write-Host "  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres"
Write-Host "  DB_HOST=127.0.0.1"
Write-Host "  DB_PORT=54322"
Write-Host "  DB_NAME=postgres"
Write-Host "  DB_PASSWORD=postgres"
Write-Host ""
Write-Host "⚠️  Please restart the server for changes to take effect!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Run: npm run dev" -ForegroundColor Green

