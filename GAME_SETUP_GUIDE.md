# Infinity Storm - Complete Game Setup Guide

> **Comprehensive setup instructions for the Infinity Storm casino slot game with Phaser 3, Node.js, PostgreSQL, Supabase, Docker, and Redis.**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Recommended)](#quick-start-recommended)
3. [Manual Setup](#manual-setup)
   - [Step 1: Clone Repository](#step-1-clone-repository)
   - [Step 2: Install Node.js Dependencies](#step-2-install-nodejs-dependencies)
   - [Step 3: PostgreSQL Database Setup](#step-3-postgresql-database-setup)
   - [Step 4: Supabase Local Setup](#step-4-supabase-local-setup)
   - [Step 5: Redis Setup](#step-5-redis-setup)
   - [Step 6: Environment Configuration](#step-6-environment-configuration)
   - [Step 7: Database Migrations & Seeding](#step-7-database-migrations--seeding)
   - [Step 8: Start the Server](#step-8-start-the-server)
   - [Step 9: Start the Client](#step-9-start-the-client)
4. [Docker Setup (Containerized)](#docker-setup-containerized)
5. [Testing & Verification](#testing--verification)
6. [Play Testing Guide](#play-testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Architecture Overview](#architecture-overview)
9. [Common Commands Reference](#common-commands-reference)

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **Node.js** | >= 18.0.0 | JavaScript runtime for server and build tools | [Download](https://nodejs.org/) |
| **npm** | >= 9.0.0 | Node package manager (comes with Node.js) | Included with Node.js |
| **PostgreSQL** | >= 15.x | Primary database for game data | [Download](https://www.postgresql.org/download/) |
| **Docker Desktop** | Latest | Container runtime for services | [Download](https://www.docker.com/products/docker-desktop/) |
| **Supabase CLI** | Latest | Local Supabase instance management | [Install Guide](https://supabase.com/docs/guides/cli) |
| **Git** | Latest | Version control | [Download](https://git-scm.com/) |

### Optional but Recommended

- **Redis Desktop Manager** or **RedisInsight** - GUI for Redis debugging
- **pgAdmin** or **DBeaver** - PostgreSQL database GUI
- **Postman** or **Insomnia** - API testing
- **VS Code** - Recommended code editor with extensions:
  - ESLint
  - Prettier
  - PostgreSQL
  - Docker

### System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 5GB free space
- **OS**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **Ports**: Ensure the following ports are available:
  - `3000` - Game Server
  - `3001` - Web Portal (optional)
  - `5432` or `54321` - PostgreSQL
  - `6379` - Redis
  - `54321` - Supabase API
  - `54322` - Supabase DB
  - `54323` - Supabase Studio
  - `54324` - Inbucket (Email testing)

---

## Quick Start (Recommended)

**For rapid development environment setup using Docker:**

```bash
# 1. Clone the repository
git clone https://github.com/ElricStormking/infinity-stones.git
cd infinity-stones

# 2. Install dependencies (root and server)
npm install
cd infinity-storm-server && npm install && cd ..

# 3. Create environment file (see Step 6 for details)
cp infinity-storm-server/.env.example infinity-storm-server/.env
# Edit .env with your configuration (or use defaults)

# 4. Start all services with Docker
cd infinity-storm-server
npm run dev:full

# 5. Wait for services to be healthy (check logs)
docker compose logs -f

# 6. Run database migrations
npm run migrate

# 7. Seed database with test data
npm run seed

# 8. Open browser and navigate to:
# - Game: http://localhost:3000
# - Supabase Studio: http://localhost:54323
```

**You're ready to play!** Skip to [Play Testing Guide](#play-testing-guide).

---

## Manual Setup

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/ElricStormking/infinity-stones.git
cd infinity-stones

# Check the structure
ls -la
# Expected: src/, infinity-storm-server/, package.json, README.md
```

---

### Step 2: Install Node.js Dependencies

#### Install Root Dependencies (Client)

```bash
# From project root
npm install
```

**Expected output**: Installs Phaser 3, axios, socket.io-client, and other client dependencies.

#### Install Server Dependencies

```bash
cd infinity-storm-server
npm install
cd ..
```

**Expected output**: Installs Express, Sequelize, PostgreSQL client, Redis client, Supabase client, and more.

#### Verify Installation

```bash
# Check Node.js version
node --version
# Should be >= v18.0.0

# Check npm version
npm --version
# Should be >= 9.0.0
```

---

### Step 3: PostgreSQL Database Setup

You have **two options** for PostgreSQL:

#### Option A: Local PostgreSQL Installation (Manual)

**Windows:**

1. Download PostgreSQL 15+ from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer, set password for `postgres` user
3. Add PostgreSQL to PATH (usually done automatically)
4. Verify installation:

```bash
psql --version
# Expected: psql (PostgreSQL) 15.x
```

5. Create database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE infinity_storm;
CREATE USER infinity_app WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE infinity_storm TO infinity_app;

# Exit psql
\q
```

**macOS (Homebrew):**

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb infinity_storm

# Create user
psql postgres
CREATE USER infinity_app WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE infinity_storm TO infinity_app;
\q
```

**Linux (Ubuntu/Debian):**

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE infinity_storm;
CREATE USER infinity_app WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE infinity_storm TO infinity_app;
\q
```

#### Option B: Docker PostgreSQL (Recommended)

```bash
cd infinity-storm-server

# Start PostgreSQL only (not all services)
docker compose up -d postgres

# Verify PostgreSQL is running
docker ps | grep infinity_postgres

# Check logs
docker compose logs postgres
```

**Connection details** (for Option B):
- Host: `localhost`
- Port: `54321` (mapped from container's 5432)
- Database: `infinity_storm`
- User: `postgres`
- Password: `infinity_storm_dev` (default from docker-compose.yml)

---

### Step 4: Supabase Local Setup

Supabase provides a local development environment with PostgreSQL, Auth, Storage, and more.

#### Install Supabase CLI

**macOS/Linux:**

```bash
# Using Homebrew
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

**Windows:**

```bash
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or download from GitHub releases
# https://github.com/supabase/cli/releases
```

**Alternative (npm):**

```bash
npm install -g supabase
```

#### Initialize Supabase

```bash
cd infinity-storm-server

# Start Supabase (this downloads Docker images on first run)
npm run sb:start

# This will start:
# - PostgreSQL (port 54322)
# - Studio (port 54323)
# - API (port 54321)
# - Auth, Storage, Realtime, etc.
```

**First run may take 5-10 minutes** to download Docker images (~2GB).

#### Get Supabase Credentials

```bash
# Check status and get connection details
npm run sb:status

# Output will show:
# - API URL: http://localhost:54321
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
# - Anon Key: eyJh... (long JWT token)
# - Service Role Key: eyJh... (long JWT token)
```

**Save these credentials** - you'll need them for environment configuration.

#### Verify Supabase Studio

Open your browser and navigate to:

```
http://localhost:54323
```

You should see the Supabase Studio dashboard.

#### Supabase Commands Reference

```bash
# Start Supabase
npm run sb:start

# Stop Supabase
npm run sb:stop

# Check status
npm run sb:status

# Reset database (careful - deletes all data!)
npm run sb:reset

# Verify connection (custom script)
npm run sb:verify
```

---

### Step 5: Redis Setup

Redis is used for session management, rate limiting, and caching.

#### Option A: Local Redis Installation

**macOS (Homebrew):**

```bash
brew install redis
brew services start redis

# Test connection
redis-cli ping
# Expected: PONG
```

**Windows (WSL or Manual):**

1. Install WSL2 and Ubuntu
2. Follow Linux instructions, or
3. Use Docker (recommended)

**Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
# Expected: PONG
```

#### Option B: Docker Redis (Recommended)

```bash
cd infinity-storm-server

# Start Redis only
docker compose up -d redis

# Verify Redis is running
docker ps | grep infinity_redis

# Test connection (password required in production)
docker exec -it infinity_redis redis-cli
127.0.0.1:6379> AUTH infinity_redis_dev
OK
127.0.0.1:6379> PING
PONG
127.0.0.1:6379> exit
```

---

### Step 6: Environment Configuration

Create environment configuration files for the server.

#### Server Environment File

```bash
cd infinity-storm-server

# Create .env file (copy from example or create new)
touch .env
```

**Edit `infinity-storm-server/.env` with the following:**

```env
# ===================================
# NODE ENVIRONMENT
# ===================================
NODE_ENV=development
PORT=3000
HOST=localhost

# ===================================
# DATABASE (PostgreSQL)
# ===================================
# Option A: Supabase Local
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Option B: Docker PostgreSQL
# DATABASE_URL=postgresql://postgres:infinity_storm_dev@localhost:54321/infinity_storm

# Option C: Manual PostgreSQL
# DATABASE_URL=postgresql://infinity_app:your_secure_password@localhost:5432/infinity_storm

# Individual connection params (fallback if DATABASE_URL not set)
DB_HOST=localhost
DB_PORT=54322
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres

# ===================================
# REDIS
# ===================================
# Docker Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=infinity_redis_dev
REDIS_DB=0

# Or use Redis URL
# REDIS_URL=redis://:infinity_redis_dev@localhost:6379

# ===================================
# SUPABASE (Local Development)
# ===================================
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_anon_key_from_sb_status
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_sb_status

# ===================================
# AUTHENTICATION & SECURITY
# ===================================
JWT_SECRET=dev_jwt_secret_change_in_production_abc123xyz789
SESSION_SECRET=dev_session_secret_change_in_production_xyz789abc123
BCRYPT_ROUNDS=12

# ===================================
# GAME CONFIGURATION
# ===================================
MIN_BET=0.40
MAX_BET=2000.00
DEFAULT_CREDITS=1000.00
RNG_SEED_SALT=dev_rng_salt_change_in_production

# ===================================
# RATE LIMITING
# ===================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
SPIN_RATE_LIMIT_MAX=2

# ===================================
# LOGGING
# ===================================
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
LOG_ERROR_FILE_PATH=./logs/error.log

# ===================================
# FEATURES
# ===================================
ENABLE_ADMIN_PANEL=true
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true

# ===================================
# CORS (Client URL)
# ===================================
CORS_ORIGIN=http://localhost:3000

# ===================================
# POSTGRES (Docker Compose Specific)
# ===================================
POSTGRES_DB=infinity_storm
POSTGRES_USER=postgres
POSTGRES_PASSWORD=infinity_storm_dev
POSTGRES_PORT=54321
```

#### Get Supabase Keys

If you're using Supabase, run this to get your keys:

```bash
npm run sb:status

# Copy the Anon Key and Service Role Key into your .env file
```

#### Verify Environment

```bash
# Test environment loading
node -e "require('dotenv').config(); console.log('PORT:', process.env.PORT);"
# Expected: PORT: 3000
```

---

### Step 7: Database Migrations & Seeding

#### Run Migrations

Migrations create all necessary database tables and schema.

```bash
cd infinity-storm-server

# Run migrations
npm run migrate
```

**Expected output:**

```
pgcrypto extension ensured
Applying migration 20250827053206_init_casino_schema.sql
Migrations complete
```

#### Verify Tables

```bash
# Using psql (if Supabase)
psql postgresql://postgres:postgres@localhost:54322/postgres

# List tables
\dt

# Expected tables:
# - players
# - sessions
# - game_states
# - spins
# - spin_results
# - transactions
# - jackpots
# - jackpot_contributions
# - admin_logs
# - rtp_metrics

\q
```

**Or use Supabase Studio:**

1. Open http://localhost:54323
2. Go to "Table Editor"
3. Verify all tables are created

#### Seed Database

Seeding populates the database with test data (demo players, admin user, etc.).

```bash
# Seed database
npm run seed
```

**Expected output:**

```
✅ Demo player created
✅ Admin user created
✅ Test player created
Seeding complete
```

#### Verify Seeded Data

**Check players table:**

```bash
# Using Supabase Studio
# Go to: http://localhost:54323 → Table Editor → players

# Or using psql
psql postgresql://postgres:postgres@localhost:54322/postgres
SELECT username, email, credits, is_demo, is_admin FROM players;
```

**Expected users:**
- `demo_player` - Demo account (5000 credits)
- `admin` - Admin account (10000 credits)
- `testplayer` - Regular test player (5000 credits)

---

### Step 8: Start the Server

#### Development Mode (with auto-reload)

```bash
cd infinity-storm-server

# Start development server
npm run dev
```

**Expected output:**

```
[INFO] Infinity Storm Server starting...
[INFO] Environment: development
[INFO] Database connected: postgresql://localhost:54322
[INFO] Redis connected: localhost:6379
[INFO] Server listening on http://localhost:3000
[INFO] Health check available at: http://localhost:3000/api/health
```

#### Production Mode

```bash
npm start
```

#### Verify Server Health

**Open browser or use curl:**

```bash
curl http://localhost:3000/api/health
```

**Expected response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T12:34:56.789Z",
  "database": "connected",
  "redis": "connected",
  "uptime": 12.345
}
```

#### Test Demo Spin Endpoint

```bash
curl -X POST http://localhost:3000/api/demo-spin \
  -H "Content-Type: application/json" \
  -d '{"betAmount": 1.0, "quickSpinMode": false}'
```

**Expected:** JSON response with spin results, cascades, and win amounts.

---

### Step 9: Start the Client

The client is a Phaser 3 game served via a simple HTTP server.

#### Start Client Development Server

```bash
# From project root
npm run dev

# Or manually with http-server
npx http-server -p 8080 -c-1
```

#### Open Game in Browser

Navigate to:

```
http://localhost:8080
```

**Or if using the game server directly:**

```
http://localhost:3000
```

#### Verify Client Connection

1. Open browser console (F12)
2. Check for connection messages:

```
✅ NetworkService initialized
✅ Connected to game server
✅ Demo mode active
```

3. Click "SPIN" to test gameplay

---

## Docker Setup (Containerized)

**Complete environment with all services running in Docker.**

### Start All Services

```bash
cd infinity-storm-server

# Start all services (PostgreSQL, Redis, Game Server, Web Portal, Nginx)
docker compose up -d

# View logs
docker compose logs -f

# Check service health
docker compose ps
```

### Service Overview

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| PostgreSQL | `infinity_postgres` | 54321 | Database |
| Redis | `infinity_redis` | 6379 | Cache/Sessions |
| Game Server | `infinity_game_server` | 3000 | API & Game Logic |
| Web Portal | `infinity_web_portal` | 3001 | Auth Frontend |
| Nginx | `infinity_nginx` | 80, 443 | Reverse Proxy |

### Run Migrations in Docker

```bash
# Execute migration script inside container
docker exec -it infinity_game_server npm run migrate

# Or run from host
cd infinity-storm-server
npm run migrate
```

### Seed Database in Docker

```bash
docker exec -it infinity_game_server npm run seed
```

### Stop All Services

```bash
docker compose down

# Stop and remove volumes (careful - deletes data!)
docker compose down -v
```

### Docker Troubleshooting

```bash
# Restart specific service
docker compose restart game-server

# View logs for specific service
docker compose logs -f postgres

# Enter container shell
docker exec -it infinity_game_server sh

# Check container resource usage
docker stats
```

---

## Testing & Verification

### Unit Tests

```bash
cd infinity-storm-server

# Run all tests
npm test

# Run specific test suite
npm run test:cascade
npm run test:smoke

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Server-client sync tests
npm test tests/integration/ServerClientSyncFlow.test.js

# Performance tests
npm test tests/performance/AnimationTiming.test.js
```

### Manual API Testing

#### Test Demo Spin

```bash
curl -X POST http://localhost:3000/api/demo-spin \
  -H "Content-Type: application/json" \
  -d '{
    "betAmount": 1.0,
    "quickSpinMode": false,
    "accumulatedMultiplier": 1.0
  }'
```

#### Test Game State Retrieval

```bash
curl -X GET http://localhost:3000/api/game-state \
  -H "x-demo-bypass: true"
```

#### Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

### Database Verification

#### Check Spin Results

```bash
# Using Supabase Studio
# Navigate to: http://localhost:54323 → Table Editor → spin_results

# Or using psql
psql postgresql://postgres:postgres@localhost:54322/postgres
SELECT id, player_id, bet_amount, total_win, game_mode, created_at 
FROM spin_results 
ORDER BY created_at DESC 
LIMIT 10;
```

#### Check Player Credits

```bash
SELECT username, credits, last_login_at 
FROM players 
ORDER BY credits DESC;
```

### Redis Verification

```bash
# Connect to Redis
docker exec -it infinity_redis redis-cli -a infinity_redis_dev

# Check session keys
KEYS session:*

# Check rate limit keys
KEYS ratelimit:*

# Monitor real-time commands
MONITOR
```

---

## Play Testing Guide

### Demo Mode (No Login Required)

1. **Open browser**: `http://localhost:8080` or `http://localhost:3000`
2. **Click "PLAY"** from the menu
3. **Demo mode** automatically activates (5000 credits)
4. **Place bet**: Use + / - buttons (default: $1.00)
5. **Click "SPIN"**
6. **Watch animations**: Symbols drop, cascades process, wins celebrate
7. **Check balance**: Credits update in real-time
8. **Test features**:
   - Quick spin mode toggle
   - Free spins (trigger with 3+ scatters)
   - Multipliers (accumulate in free spins mode)
   - Win celebrations

### Authenticated Mode (Full Features)

#### Create Test Account

```bash
# Using curl
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

#### Login

1. Open `http://localhost:3000/login` (or use API)
2. Login with:
   - **Username**: `testuser`
   - **Password**: `SecurePassword123!`
3. JWT token stored automatically
4. Game loads with persistent state

#### Test Persistent State

1. Play several spins
2. Close browser tab
3. Reopen game
4. **Verify**: Credits, game state, and spin history persist

### Testing Checklist

- [ ] Demo spin works without login
- [ ] Credits update correctly after wins/losses
- [ ] Cascade animations play smoothly
- [ ] Win celebrations trigger on big wins
- [ ] Quick spin mode reduces animation time
- [ ] Free spins trigger with 3+ scatters
- [ ] Multipliers accumulate during free spins
- [ ] Balance persists across page refreshes
- [ ] Spin history visible in database
- [ ] Rate limiting prevents spam (>2 spins/sec)
- [ ] Error messages display for invalid bets
- [ ] Mobile/responsive layout works

### Performance Testing

#### Monitor Payload Size

```bash
# Check response headers
curl -X POST http://localhost:3000/api/demo-spin \
  -H "Content-Type: application/json" \
  -d '{"betAmount": 1.0}' \
  -i | grep X-Payload-Bytes
```

**Expected**: `X-Payload-Bytes` < 51200 (50KB target)

#### Monitor Server Performance

```bash
# Open server metrics
curl http://localhost:3000/api/admin/metrics

# Check logs
tail -f infinity-storm-server/logs/combined.log
```

---

## Troubleshooting

### Common Issues & Solutions

#### 1. Port Already in Use

**Symptom:**

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```bash
# Find process using port (Windows)
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F

# Find process using port (macOS/Linux)
lsof -i :3000

# Kill process (macOS/Linux)
kill -9 <PID>

# Or change port in .env
PORT=3001
```

#### 2. Database Connection Failed

**Symptom:**

```
Error: connect ECONNREFUSED 127.0.0.1:54322
```

**Solution:**

```bash
# Check if Supabase/PostgreSQL is running
npm run sb:status
# Or
docker ps | grep postgres

# Restart Supabase
npm run sb:stop
npm run sb:start

# Verify DATABASE_URL in .env matches running instance
```

#### 3. Redis Connection Failed

**Symptom:**

```
Error: Redis connection refused
```

**Solution:**

```bash
# Check if Redis is running
docker ps | grep redis

# Start Redis
docker compose up -d redis

# Test connection
docker exec -it infinity_redis redis-cli -a infinity_redis_dev PING
```

#### 4. Migrations Fail

**Symptom:**

```
Error: relation "players" already exists
```

**Solution:**

```bash
# Reset database (careful - deletes all data!)
npm run sb:reset

# Or drop and recreate manually
psql postgresql://postgres:postgres@localhost:54322/postgres
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

# Run migrations again
npm run migrate
```

#### 5. Supabase Won't Start

**Symptom:**

```
Error: Docker daemon not running
```

**Solution:**

1. **Start Docker Desktop**
2. Wait for Docker to fully initialize
3. Try again:

```bash
npm run sb:start
```

#### 6. Client Can't Connect to Server

**Symptom:** Browser console shows `Network Error` or `401 Unauthorized`

**Solution:**

1. **Check server is running**: `curl http://localhost:3000/api/health`
2. **Check CORS configuration** in `infinity-storm-server/.env`:

```env
CORS_ORIGIN=http://localhost:8080
```

3. **Force demo bypass** for demo mode:
   - Client automatically sends `x-demo-bypass: true` header
   - Verify in browser DevTools → Network tab

#### 7. Spin Results Not Saving to Supabase

**Symptom:** Database `spin_results` table is empty

**Solution:**

1. **Check Supabase connection**:

```bash
npm run sb:verify
```

2. **Verify environment variables**:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

3. **Check server logs** for errors:

```bash
tail -f infinity-storm-server/logs/combined.log | grep Supabase
```

#### 8. Tests Hanging or Failing

**Symptom:** Jest tests timeout or hang

**Solution:**

```bash
# Run tests with increased timeout
npm test -- --testTimeout=10000

# Force exit after tests
npm test -- --forceExit

# Clear Jest cache
npm test -- --clearCache
```

---

## Architecture Overview

### Technology Stack

**Client (Frontend):**
- **Phaser 3** - Game engine and rendering
- **JavaScript (ES6+)** - Game logic
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP requests

**Server (Backend):**
- **Node.js** (>= 18.x) - Runtime environment
- **Express** - Web framework
- **PostgreSQL** - Primary database
- **Supabase** - Auth, storage, and database management
- **Redis** - Session storage and caching
- **Socket.IO** - WebSocket server
- **JWT** - Authentication tokens
- **Winston** - Logging

**DevOps:**
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy (optional)

### Directory Structure

```
infinity-stones/
├── src/                          # Client-side Phaser 3 game
│   ├── scenes/                   # Game scenes (Loading, Menu, Game)
│   ├── systems/                  # Game systems (Grid, Win calculation)
│   ├── renderer/                 # Visual rendering
│   ├── services/                 # API clients (Network, Auth, Game)
│   ├── config/                   # Game configuration
│   └── main.js                   # Entry point
│
├── infinity-storm-server/        # Server-side Node.js application
│   ├── src/
│   │   ├── auth/                 # JWT and session management
│   │   ├── config/               # Server configuration
│   │   ├── controllers/          # Route handlers
│   │   ├── db/                   # Database connection and migrations
│   │   ├── game/                 # Game engine (RNG, cascades, wins)
│   │   ├── middleware/           # Express middleware
│   │   ├── models/               # Data models
│   │   ├── routes/               # API routes
│   │   ├── services/             # Business logic
│   │   └── websocket/            # WebSocket handlers
│   │
│   ├── supabase/                 # Supabase configuration
│   │   ├── config.toml           # Supabase settings
│   │   ├── seed.sql              # Seed data
│   │   └── migrations/           # Database schema
│   │
│   ├── docker/                   # Docker configurations
│   │   ├── postgres/init.sql     # PostgreSQL init script
│   │   ├── game-server/Dockerfile
│   │   └── nginx/nginx.conf
│   │
│   ├── tests/                    # Test suites
│   │   ├── integration/          # API integration tests
│   │   ├── performance/          # Performance tests
│   │   └── cascade/              # Game logic tests
│   │
│   ├── docker-compose.yml        # Docker services definition
│   ├── server.js                 # Server entry point
│   └── package.json              # Server dependencies
│
├── package.json                  # Root dependencies
└── README.md                     # Project overview
```

### Data Flow

1. **Client** → HTTP/WebSocket → **Game Server**
2. **Game Server** → **PostgreSQL** (game state, spin results)
3. **Game Server** → **Supabase** (spin results, player data)
4. **Game Server** → **Redis** (sessions, rate limiting)
5. **Game Server** → HTTP/WebSocket → **Client** (game results, animations)

---

## Common Commands Reference

### Server Commands

```bash
cd infinity-storm-server

# Development
npm run dev                  # Start dev server with nodemon
npm start                    # Start production server

# Database
npm run migrate              # Run migrations
npm run seed                 # Seed database
npm run db:reset             # Reset database (destructive!)
npm run db:tables            # List tables via CLI

# Supabase
npm run sb:start             # Start local Supabase
npm run sb:stop              # Stop Supabase
npm run sb:status            # Check status
npm run sb:reset             # Reset Supabase DB
npm run sb:verify            # Verify Supabase connection

# Docker
npm run dev:db               # Start only PostgreSQL + Redis
npm run dev:full             # Start all services + server

# Testing
npm test                     # Run all tests
npm run test:cascade         # Cascade logic tests
npm run test:smoke           # Smoke tests
npm run test:coverage        # Coverage report
npm run test:watch           # Watch mode

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint issues
npm run format               # Format with Prettier
```

### Client Commands

```bash
# From project root
npm install                  # Install dependencies
npm run dev                  # Start client dev server
```

### Docker Commands

```bash
cd infinity-storm-server

# Start/Stop
docker compose up -d                    # Start all services
docker compose down                     # Stop all services
docker compose down -v                  # Stop and remove volumes

# Logs
docker compose logs -f                  # View all logs
docker compose logs -f game-server      # View specific service logs

# Service Management
docker compose restart game-server      # Restart service
docker compose ps                       # List services
docker compose exec game-server sh      # Enter container shell

# Database
docker exec -it infinity_postgres psql -U postgres -d infinity_storm
docker compose exec postgres pg_dump -U postgres infinity_storm > backup.sql
```

### Database Commands

```bash
# Connect to PostgreSQL (Supabase)
psql postgresql://postgres:postgres@localhost:54322/postgres

# Common queries
\dt                                           # List tables
\d players                                    # Describe table
SELECT * FROM players;                        # Query players
SELECT * FROM spin_results ORDER BY created_at DESC LIMIT 10;

# Backup
pg_dump -U postgres -h localhost -p 54322 postgres > backup.sql

# Restore
psql -U postgres -h localhost -p 54322 postgres < backup.sql
```

---

## Additional Resources

### Documentation

- [Phaser 3 Docs](https://photonstorm.github.io/phaser3-docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Manual](https://www.postgresql.org/docs/)
- [Redis Commands](https://redis.io/commands)

### Project Specific Docs

- `infinity-storm-server/README.md` - Server architecture
- `infinity-storm-server/API_IMPLEMENTATION_SUMMARY.md` - API details
- `infinity-storm-server/AUTH_IMPLEMENTATION.md` - Authentication flow
- `CLIENT_SERVER_SYNC_COMPLETE.md` - Client-server sync guide

### Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/ElricStormking/infinity-stones/issues)
- **Pull Requests**: Contributions welcome!

---

## Quick Reference Card

| Task | Command |
|------|---------|
| **Install dependencies** | `npm install && cd infinity-storm-server && npm install` |
| **Start Supabase** | `cd infinity-storm-server && npm run sb:start` |
| **Run migrations** | `cd infinity-storm-server && npm run migrate` |
| **Seed database** | `cd infinity-storm-server && npm run seed` |
| **Start server** | `cd infinity-storm-server && npm run dev` |
| **Start client** | `npm run dev` (from root) |
| **Start all (Docker)** | `cd infinity-storm-server && docker compose up -d` |
| **Run tests** | `cd infinity-storm-server && npm test` |
| **View logs** | `docker compose logs -f` |
| **Open Supabase Studio** | Browser: `http://localhost:54323` |
| **Open game** | Browser: `http://localhost:8080` or `:3000` |
| **Health check** | `curl http://localhost:3000/api/health` |
| **Stop all services** | `docker compose down` |

---

**Congratulations! Your Infinity Storm game environment is now fully set up.** 🎮💎

For questions or issues, please refer to the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.

---

*Last Updated: 2025-01-20*
*Version: 1.0.0*


