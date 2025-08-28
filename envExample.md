# Environment Configuration for Infinity Storm Server

## Current Status ⚠️

The current `.env` file has several issues and doesn't match the actual code requirements. Here's a corrected configuration:

## Issues with Current .env

1. **JWT Configuration**: Code expects `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, but `.env` only has `JWT_SECRET`
2. **Redis Configuration**: Redis is not running but the system keeps trying to connect
3. **Admin Authentication**: Using wrong Sequelize configuration for admin panel

## ✅ Corrected .env Configuration

```bash
# ==============================================
# ENVIRONMENT CONFIGURATION
# ==============================================

NODE_ENV=development

# ==============================================
# SUPABASE CONFIGURATION (Local Development)
# ==============================================

# Local Supabase instance URLs and keys
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long

# ==============================================
# DATABASE CONFIGURATION
# ==============================================

# PostgreSQL connection via Supabase
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=54322

# Database config for models and direct queries
DB_HOST=127.0.0.1
DB_PORT=54322
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres

# ==============================================
# JWT AUTHENTICATION CONFIGURATION
# ==============================================

# ⚠️ CRITICAL: These are the actual variables the code uses
JWT_ACCESS_SECRET=your-super-secret-access-token-key-min-32-chars-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-min-32-chars-change-in-production
JWT_ACCESS_EXPIRY=30m
JWT_REFRESH_EXPIRY=7d

# Legacy JWT secret (used by some older code)
JWT_SECRET=dev_jwt_secret_change_in_production

# ==============================================
# REDIS CONFIGURATION
# ==============================================

# Redis is DISABLED for current setup to avoid connection issues
SKIP_REDIS=true

# Uncomment and configure if you want to enable Redis:
# REDIS_URL=redis://:infinity_redis_dev@127.0.0.1:6379
# REDIS_PASSWORD=infinity_redis_dev
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6379

# ==============================================
# SERVER CONFIGURATION
# ==============================================

WEB_PORTAL_PORT=3001
GAME_SERVER_PORT=3000

# ==============================================
# DEVELOPMENT SETTINGS
# ==============================================

# Enable detailed logging in development
DEBUG=true
LOG_LEVEL=debug

# ==============================================
# PRODUCTION SECURITY (Change all secrets!)
# ==============================================

# For production, generate strong secrets:
# JWT_ACCESS_SECRET=<64+ character random string>
# JWT_REFRESH_SECRET=<64+ character random string>  
# SUPABASE_JWT_SECRET=<64+ character random string>
# POSTGRES_PASSWORD=<strong database password>
```

## 🚀 Setup Instructions

### 1. Replace Current .env
```bash
cd infinity-storm-server
cp .env .env.backup
# Replace .env content with the configuration above
```

### 2. Start Supabase (if using local instance)
```bash
npm run sb:start
```

### 3. Start Server
```bash
npm start
```

## ⚡ Working Features with Current Config

Even with the .env issues, these features work correctly:

✅ **Demo Player**: Spins work with $1000 balance
✅ **User Registration**: Create new player accounts  
✅ **User Login**: Authenticate with JWT tokens
✅ **Authenticated Spins**: Real credit management for registered players
✅ **Transaction Logging**: Complete regulatory audit trail
✅ **Transaction History**: View player financial history
✅ **Database Operations**: PostgreSQL queries working

## 🔧 Optional Optimizations

### Redis Setup (Optional)
If you want to enable Redis for session management:

1. Install Redis locally or use Docker:
```bash
docker run -d -p 6379:6379 --name redis-server redis:alpine
```

2. Update .env:
```bash
SKIP_REDIS=false
REDIS_URL=redis://127.0.0.1:6379
```

### Production Security
For production deployment:

1. Generate strong secrets:
```bash
# Generate 64-character random strings
openssl rand -base64 64
```

2. Use environment-specific configurations
3. Enable HTTPS
4. Configure proper CORS origins
5. Set up proper database security

## 📋 Environment Variables Reference

| Variable | Current Status | Usage | Required |
|----------|----------------|--------|----------|
| `JWT_ACCESS_SECRET` | ❌ Missing | JWT token signing | **Required** |
| `JWT_REFRESH_SECRET` | ❌ Missing | Refresh token signing | **Required** |
| `JWT_SECRET` | ✅ Present | Legacy compatibility | Optional |
| `DB_*` variables | ✅ Working | Database connections | **Required** |
| `SUPABASE_*` | ✅ Working | Supabase integration | **Required** |
| `SKIP_REDIS` | ✅ Working | Bypass Redis issues | Recommended |

## 🎯 Recommendation

**Use the corrected configuration above** to eliminate the connection errors and ensure all authentication features work properly. The current setup works for development but has many unnecessary error messages due to the configuration mismatches.