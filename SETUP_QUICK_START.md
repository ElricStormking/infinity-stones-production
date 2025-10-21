# Infinity Storm - Quick Start Guide

> **Get up and running in 10 minutes** ⚡

---

## 🎯 Choose Your Setup Path

### Path A: Docker (Fastest - Recommended) ⭐

```bash
# 1️⃣ Clone and install
git clone https://github.com/ElricStormking/infinity-stones.git
cd infinity-stones && npm install
cd infinity-storm-server && npm install && cd ..

# 2️⃣ Configure environment
cd infinity-storm-server
cp .env.example .env  # Or create .env with minimal config below

# 3️⃣ Start all services
npm run dev:full

# 4️⃣ Setup database (in another terminal)
cd infinity-storm-server
npm run migrate
npm run seed

# 5️⃣ Play! 🎮
# Open http://localhost:3000
```

**Time: ~10 minutes** ⏱️

---

### Path B: Supabase Local (Recommended for Development) ⭐⭐

```bash
# 1️⃣ Clone and install
git clone https://github.com/ElricStormking/infinity-stones.git
cd infinity-stones && npm install
cd infinity-storm-server && npm install && cd ..

# 2️⃣ Install Supabase CLI
brew install supabase/tap/supabase  # macOS
# Or: scoop install supabase         # Windows
# Or: npm install -g supabase        # Any OS

# 3️⃣ Start Supabase (first run takes 5-10 min)
cd infinity-storm-server
npm run sb:start

# 4️⃣ Get Supabase credentials
npm run sb:status
# Copy ANON_KEY and SERVICE_ROLE_KEY

# 5️⃣ Configure .env
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<paste_anon_key_here>
SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_here>
JWT_SECRET=dev_jwt_secret_change_in_production
SESSION_SECRET=dev_session_secret_change_in_production
EOF

# 6️⃣ Setup database
npm run migrate
npm run seed

# 7️⃣ Start server
npm run dev

# 8️⃣ Start client (in another terminal)
cd ..
npm run dev

# 9️⃣ Play! 🎮
# Open http://localhost:8080
```

**Time: ~15 minutes** ⏱️

---

### Path C: Manual (Full Control) ⚙️

**Prerequisites:**
- Install PostgreSQL 15+
- Install Redis (or use Docker for Redis only)
- Install Node.js 18+

```bash
# 1️⃣ Setup PostgreSQL
createdb infinity_storm
psql infinity_storm
# Run: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# 2️⃣ Setup Redis
brew install redis && brew services start redis  # macOS
# Or: docker run -d -p 6379:6379 redis:7-alpine  # Docker Redis

# 3️⃣ Clone and configure
git clone https://github.com/ElricStormking/infinity-stones.git
cd infinity-stones && npm install
cd infinity-storm-server && npm install

# 4️⃣ Create .env (see minimal config below)

# 5️⃣ Setup and start
npm run migrate
npm run seed
npm run dev

# 6️⃣ Start client
cd .. && npm run dev

# 7️⃣ Play! 🎮
# Open http://localhost:8080
```

**Time: ~20 minutes** ⏱️

---

## 📋 Minimal .env Configuration

### For Docker Setup:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:infinity_storm_dev@localhost:54321/infinity_storm
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=infinity_redis_dev
JWT_SECRET=dev_jwt_secret_change_in_production
SESSION_SECRET=dev_session_secret_change_in_production
CORS_ORIGIN=http://localhost:3000
```

### For Supabase Setup:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<get_from_supabase_status>
SUPABASE_SERVICE_ROLE_KEY=<get_from_supabase_status>
JWT_SECRET=dev_jwt_secret_change_in_production
SESSION_SECRET=dev_session_secret_change_in_production
CORS_ORIGIN=http://localhost:8080
```

---

## ✅ Verify Setup

### 1. Check Server Health

```bash
curl http://localhost:3000/api/health
```

**Expected:**
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

### 2. Test Demo Spin

```bash
curl -X POST http://localhost:3000/api/demo-spin \
  -H "Content-Type: application/json" \
  -d '{"betAmount": 1.0}'
```

**Expected:** JSON response with `spinId`, `totalWin`, `cascadeSteps`

### 3. Check Database

**Supabase Studio:**
```
http://localhost:54323
```

**Or psql:**
```bash
psql postgresql://postgres:postgres@localhost:54322/postgres
SELECT COUNT(*) FROM players;
# Expected: 3 (demo_player, admin, testplayer)
```

---

## 🎮 Play Testing

### Demo Mode (No Login)

1. Open `http://localhost:8080` or `http://localhost:3000`
2. Click **"PLAY"**
3. Click **"SPIN"** (default bet: $1.00)
4. Watch the cascades! 💎

### Test Features

- ✅ Credits update after spin
- ✅ Cascade animations play
- ✅ Win celebrations on big wins
- ✅ Quick spin toggle
- ✅ Free spins (3+ scatter symbols)
- ✅ Multipliers in free spins mode

---

## 🐛 Common Issues

### Port 3000 Already in Use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Database Connection Failed

```bash
# Check if Supabase/PostgreSQL is running
npm run sb:status
# Or
docker ps

# Restart
npm run sb:stop && npm run sb:start
```

### Redis Connection Failed

```bash
# Start Redis with Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Test connection
redis-cli ping  # Should return: PONG
```

### Migrations Fail

```bash
# Reset and retry
npm run sb:reset  # Supabase
npm run migrate
npm run seed
```

---

## 📊 Service Ports Reference

| Service | Port | URL |
|---------|------|-----|
| Game Server | 3000 | http://localhost:3000 |
| Client Dev | 8080 | http://localhost:8080 |
| PostgreSQL (Docker) | 54321 | localhost:54321 |
| PostgreSQL (Supabase) | 54322 | localhost:54322 |
| Supabase API | 54321 | http://localhost:54321 |
| Supabase Studio | 54323 | http://localhost:54323 |
| Redis | 6379 | localhost:6379 |

---

## 🚀 Next Steps

- Read [GAME_SETUP_GUIDE.md](./GAME_SETUP_GUIDE.md) for detailed documentation
- Check [API_IMPLEMENTATION_SUMMARY.md](./infinity-storm-server/API_IMPLEMENTATION_SUMMARY.md) for API details
- Run tests: `cd infinity-storm-server && npm test`
- Open Supabase Studio: http://localhost:54323
- Monitor logs: `docker compose logs -f`

---

## 🆘 Need Help?

- **Full Documentation**: [GAME_SETUP_GUIDE.md](./GAME_SETUP_GUIDE.md)
- **Troubleshooting**: See full guide Section 7
- **GitHub Issues**: https://github.com/ElricStormking/infinity-stones/issues

---

**Happy Gaming! 🎮💎⚡**


