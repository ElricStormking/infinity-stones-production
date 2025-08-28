# Docker startup script for Infinity Storm development environment (PowerShell)
# Usage: .\docker\docker-start.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Infinity Storm Docker Environment..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Please review and update .env file with your settings" -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating required directories..." -ForegroundColor Blue
$directories = @("docker\nginx\ssl", "logs", "web-portal")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
}

try {
    # Start services in the correct order
    Write-Host "🐳 Starting Docker services..." -ForegroundColor Blue

    # Start core infrastructure first (postgres, redis)
    Write-Host "  Starting database and cache services..." -ForegroundColor Cyan
    docker-compose up -d postgres redis

    # Wait for health checks
    Write-Host "  Waiting for services to be healthy..." -ForegroundColor Cyan
    $timeout = 60
    $count = 0
    
    while ($count -lt $timeout) {
        $postgresHealth = docker-compose ps postgres
        $redisHealth = docker-compose ps redis
        
        if (($postgresHealth -match "healthy") -and ($redisHealth -match "healthy")) {
            Write-Host "✅ Core services are healthy!" -ForegroundColor Green
            break
        }
        
        Write-Host "  Waiting for services... ($count/$timeout)" -ForegroundColor Yellow
        Start-Sleep 2
        $count += 2
    }

    if ($count -ge $timeout) {
        Write-Host "❌ Services failed to start within timeout" -ForegroundColor Red
        docker-compose logs postgres redis
        exit 1
    }

    # Start application services (when they exist)
    Write-Host "  Starting application services..." -ForegroundColor Cyan
    # Note: web-portal and game-server will be started once they exist
    # docker-compose up -d web-portal game-server

    # Start reverse proxy
    Write-Host "  Starting reverse proxy..." -ForegroundColor Cyan
    docker-compose up -d nginx

    Write-Host ""
    Write-Host "🎉 Infinity Storm Docker Environment Started!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Service Status:" -ForegroundColor Blue
    docker-compose ps

    Write-Host ""
    Write-Host "🌐 Available Endpoints:" -ForegroundColor Blue
    Write-Host "  - PostgreSQL: localhost:54321" -ForegroundColor White
    Write-Host "  - Redis: localhost:6379" -ForegroundColor White
    Write-Host "  - Web Portal: http://localhost:3001 (when implemented)" -ForegroundColor White
    Write-Host "  - Game Server: http://localhost:3000 (when implemented)" -ForegroundColor White
    Write-Host "  - Nginx Proxy: http://localhost:80" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Useful Commands:" -ForegroundColor Blue
    Write-Host "  View logs: docker-compose logs -f [service]" -ForegroundColor White
    Write-Host "  Stop all: docker-compose down" -ForegroundColor White
    Write-Host "  Restart: docker-compose restart [service]" -ForegroundColor White
    Write-Host "  Shell access: docker-compose exec [service] sh" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host "❌ Error starting Docker environment: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}