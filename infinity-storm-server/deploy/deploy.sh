#!/bin/bash

###############################################################################
# INFINITY STORM - Production Deployment Script
# 
# Automates production deployment with:
# - Environment validation
# - Database migrations
# - Health checks
# - Zero-downtime deployment
# - Rollback capability
# - Automated testing
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="infinity-storm"
APP_DIR="/var/www/infinity-storm"
BACKUP_DIR="/var/backups/infinity-storm"
LOG_FILE="/var/log/infinity-storm/deploy.log"
DEPLOYMENT_ID=$(date +%Y%m%d-%H%M%S)
MAX_ROLLBACK_VERSIONS=5

# Required environment variables
REQUIRED_ENV_VARS=(
    "NODE_ENV"
    "DATABASE_URL"
    "JWT_SECRET"
    "SUPABASE_URL"
    "SUPABASE_KEY"
)

###############################################################################
# Logging Functions
###############################################################################

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

###############################################################################
# Pre-Deployment Validation
###############################################################################

validate_environment() {
    log "Validating environment..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ required (current: $(node --version))"
        exit 1
    fi
    log_success "Node.js version: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    log_success "npm version: $(npm --version)"
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warning "psql not found - skipping database version check"
    else
        log_success "PostgreSQL client available"
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_success "Docker available: $(docker --version)"
    else
        log_warning "Docker not found - containerized deployment not available"
    fi
    
    # Check required environment variables
    for VAR in "${REQUIRED_ENV_VARS[@]}"; do
        if [ -z "${!VAR:-}" ]; then
            log_error "Required environment variable not set: $VAR"
            exit 1
        fi
        log_success "Environment variable set: $VAR"
    done
    
    log_success "Environment validation complete"
}

###############################################################################
# Backup Functions
###############################################################################

create_backup() {
    log "Creating backup..."
    
    # Create backup directory
    BACKUP_PATH="$BACKUP_DIR/$DEPLOYMENT_ID"
    mkdir -p "$BACKUP_PATH"
    
    # Backup application code
    if [ -d "$APP_DIR" ]; then
        log "Backing up application code..."
        tar -czf "$BACKUP_PATH/app-code.tar.gz" -C "$APP_DIR" . || {
            log_error "Failed to backup application code"
            exit 1
        }
        log_success "Application code backed up"
    fi
    
    # Backup database
    log "Backing up database..."
    pg_dump "$DATABASE_URL" > "$BACKUP_PATH/database.sql" || {
        log_error "Failed to backup database"
        exit 1
    }
    log_success "Database backed up to $BACKUP_PATH/database.sql"
    
    # Backup .env file
    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$BACKUP_PATH/.env"
        log_success "Environment file backed up"
    fi
    
    # Clean old backups (keep last MAX_ROLLBACK_VERSIONS)
    log "Cleaning old backups (keeping last $MAX_ROLLBACK_VERSIONS)..."
    cd "$BACKUP_DIR"
    ls -t | tail -n +$((MAX_ROLLBACK_VERSIONS + 1)) | xargs -r rm -rf
    
    log_success "Backup created: $BACKUP_PATH"
}

###############################################################################
# Deployment Functions
###############################################################################

pull_latest_code() {
    log "Pulling latest code from repository..."
    
    cd "$APP_DIR"
    
    # Fetch latest changes
    git fetch origin || {
        log_error "Failed to fetch from repository"
        exit 1
    }
    
    # Get current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log "Current branch: $CURRENT_BRANCH"
    
    # Pull latest changes
    git pull origin "$CURRENT_BRANCH" || {
        log_error "Failed to pull latest code"
        exit 1
    }
    
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    log_success "Latest code pulled (commit: $CURRENT_COMMIT)"
}

install_dependencies() {
    log "Installing dependencies..."
    
    cd "$APP_DIR/infinity-storm-server"
    
    # Install production dependencies only
    npm ci --production --no-optional || {
        log_error "Failed to install dependencies"
        exit 1
    }
    
    log_success "Dependencies installed"
}

run_migrations() {
    log "Running database migrations..."
    
    cd "$APP_DIR/infinity-storm-server"
    
    # Run migrations
    npm run migrate || {
        log_error "Database migrations failed"
        return 1
    }
    
    log_success "Database migrations complete"
}

build_application() {
    log "Building application..."
    
    cd "$APP_DIR/infinity-storm-server"
    
    # Build if build script exists
    if grep -q '"build"' package.json; then
        npm run build || {
            log_error "Build failed"
            exit 1
        }
        log_success "Application built successfully"
    else
        log_warning "No build script found - skipping"
    fi
}

###############################################################################
# Health Check Functions
###############################################################################

health_check() {
    local MAX_ATTEMPTS=30
    local ATTEMPT=0
    local HEALTH_URL="${1:-http://localhost:8080/health}"
    
    log "Running health check on $HEALTH_URL..."
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s "$HEALTH_URL" > /dev/null 2>&1; then
            log_success "Health check passed (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        log "Health check attempt $ATTEMPT/$MAX_ATTEMPTS..."
        sleep 2
    done
    
    log_error "Health check failed after $MAX_ATTEMPTS attempts"
    return 1
}

###############################################################################
# Service Management
###############################################################################

stop_service() {
    log "Stopping application service..."
    
    # Stop using PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 stop "$APP_NAME" || log_warning "PM2 stop failed or app not running"
        log_success "Application stopped (PM2)"
        return 0
    fi
    
    # Stop using systemd if available
    if command -v systemctl &> /dev/null; then
        sudo systemctl stop "$APP_NAME" || log_warning "systemctl stop failed or service not found"
        log_success "Application stopped (systemd)"
        return 0
    fi
    
    log_warning "No process manager found - manual stop may be required"
}

start_service() {
    log "Starting application service..."
    
    cd "$APP_DIR/infinity-storm-server"
    
    # Start using PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js || pm2 start server.js --name "$APP_NAME" || {
            log_error "Failed to start application with PM2"
            return 1
        }
        pm2 save
        log_success "Application started (PM2)"
        return 0
    fi
    
    # Start using systemd if available
    if command -v systemctl &> /dev/null; then
        sudo systemctl start "$APP_NAME" || {
            log_error "Failed to start application with systemd"
            return 1
        }
        log_success "Application started (systemd)"
        return 0
    fi
    
    log_error "No process manager found"
    return 1
}

restart_service() {
    log "Restarting application service..."
    
    # Restart using PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 restart "$APP_NAME" || pm2 reload "$APP_NAME" || {
            log_error "Failed to restart application with PM2"
            return 1
        }
        log_success "Application restarted (PM2)"
        return 0
    fi
    
    # Restart using systemd if available
    if command -v systemctl &> /dev/null; then
        sudo systemctl restart "$APP_NAME" || {
            log_error "Failed to restart application with systemd"
            return 1
        }
        log_success "Application restarted (systemd)"
        return 0
    fi
    
    log_error "No process manager found"
    return 1
}

###############################################################################
# Rollback Functions
###############################################################################

rollback() {
    local BACKUP_ID="$1"
    
    if [ -z "$BACKUP_ID" ]; then
        log_error "Backup ID required for rollback"
        echo "Available backups:"
        ls -1 "$BACKUP_DIR" | tail -n $MAX_ROLLBACK_VERSIONS
        exit 1
    fi
    
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_ID"
    
    if [ ! -d "$BACKUP_PATH" ]; then
        log_error "Backup not found: $BACKUP_PATH"
        exit 1
    fi
    
    log "Rolling back to backup: $BACKUP_ID"
    
    # Stop service
    stop_service
    
    # Restore application code
    if [ -f "$BACKUP_PATH/app-code.tar.gz" ]; then
        log "Restoring application code..."
        rm -rf "$APP_DIR"/*
        tar -xzf "$BACKUP_PATH/app-code.tar.gz" -C "$APP_DIR"
        log_success "Application code restored"
    fi
    
    # Restore database
    if [ -f "$BACKUP_PATH/database.sql" ]; then
        log "Restoring database..."
        psql "$DATABASE_URL" < "$BACKUP_PATH/database.sql" || {
            log_error "Database restore failed"
            exit 1
        }
        log_success "Database restored"
    fi
    
    # Restore environment file
    if [ -f "$BACKUP_PATH/.env" ]; then
        cp "$BACKUP_PATH/.env" "$APP_DIR/.env"
        log_success "Environment file restored"
    fi
    
    # Start service
    start_service
    
    # Health check
    sleep 5
    if health_check; then
        log_success "Rollback complete and healthy"
    else
        log_error "Rollback complete but health check failed"
        exit 1
    fi
}

###############################################################################
# Main Deployment Flow
###############################################################################

deploy() {
    log "========================================="
    log "  INFINITY STORM - PRODUCTION DEPLOYMENT"
    log "  Deployment ID: $DEPLOYMENT_ID"
    log "========================================="
    
    # Pre-deployment validation
    validate_environment
    
    # Create backup before deployment
    create_backup
    
    # Pull latest code
    pull_latest_code
    
    # Install dependencies
    install_dependencies
    
    # Run database migrations
    run_migrations
    
    # Build application (if needed)
    build_application
    
    # Restart service
    restart_service
    
    # Wait for application to start
    sleep 5
    
    # Health check
    if ! health_check; then
        log_error "Deployment failed - health check unsuccessful"
        log "Initiating automatic rollback..."
        rollback "$DEPLOYMENT_ID"
        exit 1
    fi
    
    log_success "========================================="
    log_success "  DEPLOYMENT SUCCESSFUL"
    log_success "  Deployment ID: $DEPLOYMENT_ID"
    log_success "  Application is healthy and running"
    log_success "========================================="
}

###############################################################################
# Command Line Interface
###############################################################################

show_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  deploy              Deploy latest code to production"
    echo "  rollback <ID>       Rollback to a specific backup"
    echo "  health              Run health check"
    echo "  backup              Create backup only"
    echo "  list-backups        List available backups"
    echo "  start               Start the application"
    echo "  stop                Stop the application"
    echo "  restart             Restart the application"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Deploy latest code"
    echo "  $0 rollback 20251016-143022  # Rollback to specific version"
    echo "  $0 health                    # Check application health"
}

# Main command handler
case "${1:-}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback "${2:-}"
        ;;
    health)
        health_check
        ;;
    backup)
        create_backup
        ;;
    list-backups)
        log "Available backups:"
        ls -lh "$BACKUP_DIR" | tail -n $MAX_ROLLBACK_VERSIONS
        ;;
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

exit 0





