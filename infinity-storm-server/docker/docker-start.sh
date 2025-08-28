#!/bin/bash
# Docker startup script for Infinity Storm development environment

set -e

echo "🚀 Starting Infinity Storm Docker Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ Please review and update .env file with your settings"
fi

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p docker/nginx/ssl
mkdir -p logs
mkdir -p web-portal

# Start services in the correct order
echo "🐳 Starting Docker services..."

# Start core infrastructure first (postgres, redis)
echo "  Starting database and cache services..."
docker-compose up -d postgres redis

# Wait for health checks
echo "  Waiting for services to be healthy..."
timeout=60
count=0
while [ $count -lt $timeout ]; do
    if docker-compose ps postgres | grep -q "healthy" && docker-compose ps redis | grep -q "healthy"; then
        echo "✅ Core services are healthy!"
        break
    fi
    echo "  Waiting for services... ($count/$timeout)"
    sleep 2
    count=$((count + 2))
done

if [ $count -ge $timeout ]; then
    echo "❌ Services failed to start within timeout"
    docker-compose logs postgres redis
    exit 1
fi

# Start application services
echo "  Starting application services..."
# Note: web-portal and game-server will be started once they exist
# docker-compose up -d web-portal game-server

# Start reverse proxy
echo "  Starting reverse proxy..."
docker-compose up -d nginx

echo ""
echo "🎉 Infinity Storm Docker Environment Started!"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Available Endpoints:"
echo "  - PostgreSQL: localhost:54321"
echo "  - Redis: localhost:6379"
echo "  - Web Portal: http://localhost:3001 (when implemented)"
echo "  - Game Server: http://localhost:3000 (when implemented)"
echo "  - Nginx Proxy: http://localhost:80"
echo ""
echo "🔧 Useful Commands:"
echo "  View logs: docker-compose logs -f [service]"
echo "  Stop all: docker-compose down"
echo "  Restart: docker-compose restart [service]"
echo "  Shell access: docker-compose exec [service] sh"
echo ""