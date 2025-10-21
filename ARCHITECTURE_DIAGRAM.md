# Infinity Storm - System Architecture

> **Visual overview of the complete game architecture**

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Phaser 3 Game Engine                                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │    │
│  │  │  Game    │  │  Grid    │  │  Win     │  │  Animation│      │    │
│  │  │  Scene   │  │  Manager │  │  Calc    │  │  Manager  │      │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                │                                        │
│                                │ HTTP/WebSocket                         │
│                                ▼                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────────────┐
│                               │       SERVER LAYER                      │
│  ┌────────────────────────────▼──────────────────────────────────┐     │
│  │  Express.js API Server                                        │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │     │
│  │  │   Auth   │  │   Game   │  │  Wallet  │  │  Admin   │     │     │
│  │  │ Routes   │  │  Routes  │  │  Routes  │  │  Routes  │     │     │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │     │
│  │       │             │             │             │             │     │
│  │  ┌────▼─────────────▼─────────────▼─────────────▼─────┐     │     │
│  │  │          Game Engine (Server-Side)             │     │     │     │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │     │     │     │
│  │  │  │   RNG    │  │ Cascade  │  │   Win    │    │     │     │     │
│  │  │  │  Engine  │  │ Processor│  │Calculator│    │     │     │     │
│  │  │  └──────────┘  └──────────┘  └──────────┘    │     │     │     │
│  │  └────────────────────────────────────────────────┘     │     │     │
│  └──────────────────────┬────────────────────────────────────┘     │
│                         │                                          │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL   │  │  Supabase    │  │    Redis     │
│               │  │              │  │              │
│ ┌───────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │  Players  │ │  │ │   Spin   │ │  │ │ Sessions │ │
│ │  Sessions │ │  │ │  Results │ │  │ │ Rate     │ │
│ │  States   │ │  │ │  Audit   │ │  │ │ Limiting │ │
│ └───────────┘ │  │ └──────────┘ │  │ └──────────┘ │
└───────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔄 Data Flow Diagram

### Spin Request Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. POST /api/spin
       │    { betAmount, quickSpinMode, accumulatedMultiplier }
       │
       ▼
┌──────────────────────────┐
│  Game Server             │
│  ┌────────────────────┐  │
│  │ Authentication     │  │◄───── 2. Verify JWT/Session
│  └──────┬─────────────┘  │
│         │                │
│  ┌──────▼─────────────┐  │
│  │ Rate Limiter       │  │◄───── 3. Check Redis (2 spins/sec max)
│  └──────┬─────────────┘  │
│         │                │
│  ┌──────▼─────────────┐  │
│  │ Input Validator    │  │◄───── 4. Validate bet amount (0.40-2000)
│  └──────┬─────────────┘  │
│         │                │
│  ┌──────▼─────────────┐  │
│  │ Game Engine        │  │
│  │  • RNG             │  │◄───── 5. Generate cryptographically secure seed
│  │  • Grid Generator  │  │◄───── 6. Create initial 5x5 grid
│  │  • Cascade Process │  │◄───── 7. Process cascades (clusters, drops, fills)
│  │  • Win Calculator  │  │◄───── 8. Calculate wins per cascade
│  │  • Multiplier Eng  │  │◄───── 9. Apply multipliers (free spins mode)
│  └──────┬─────────────┘  │
│         │                │
│  ┌──────▼─────────────┐  │
│  │ State Manager      │  │◄───── 10. Update player state
│  └──────┬─────────────┘  │
│         │                │
│  ┌──────▼─────────────┐  │
│  │ Database Writer    │  │◄───── 11a. Save to PostgreSQL (game_states)
│  └──────┬─────────────┘  │       11b. Save to Supabase (spin_results)
│         │                │
│  ┌──────▼─────────────┐  │
│  │ Response Builder   │  │◄───── 12. Build response payload (<50KB)
│  └──────┬─────────────┘  │
│         │                │
└─────────┼────────────────┘
          │
          │ 13. JSON Response
          │    {
          │      spinId, totalWin, cascadeSteps[],
          │      droppingSymbols[], newSymbols[],
          │      finalGrid[][], accumulatedMultiplier
          │    }
          ▼
┌─────────────────┐
│  Client         │
│  ┌───────────┐  │
│  │ Renderer  │  │◄───── 14. Play cascade animations
│  └───────────┘  │       15. Update UI (credits, multipliers)
│  ┌───────────┐  │       16. Celebrate wins
│  │   UI      │  │
│  └───────────┘  │
└─────────────────┘
```

---

## 🗄️ Database Schema Overview

### PostgreSQL Tables

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PLAYERS                                    │
├─────────────────────────────────────────────────────────────────────┤
│ id (UUID, PK)                                                       │
│ username (VARCHAR, UNIQUE)                                          │
│ email (VARCHAR, UNIQUE)                                             │
│ password_hash (VARCHAR)                                             │
│ credits (DECIMAL)                    ◄────────────────┐            │
│ is_demo (BOOLEAN)                                     │            │
│ is_admin (BOOLEAN)                                    │            │
│ created_at, updated_at, last_login_at                 │            │
└───────────────────────┬───────────────────────────────┴────────────┘
                        │
                        │ 1:N
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│   SESSIONS     │ │  GAME_STATES    │ │  SPIN_RESULTS    │
├────────────────┤ ├─────────────────┤ ├──────────────────┤
│ id (UUID, PK)  │ │ id (UUID, PK)   │ │ id (UUID, PK)    │
│ player_id (FK) │ │ player_id (FK)  │ │ player_id (FK)   │
│ token_hash     │ │ session_id (FK) │ │ session_id (FK)  │
│ ip_address     │ │ state_data JSONB│ │ bet_amount       │
│ user_agent     │ │ game_mode       │ │ initial_grid JSONB│
│ is_active      │ │ free_spins_rem  │ │ cascades JSONB   │
│ expires_at     │ │ accum_multiplier│ │ total_win        │
└────────────────┘ └─────────────────┘ │ multipliers JSONB│
                                       │ rng_seed         │
                                       │ game_mode        │
                                       └──────────────────┘
```

### Supabase Tables (Audit Trail)

```
┌──────────────────────────────────────────────┐
│              SPIN_RESULTS (Audit)            │
├──────────────────────────────────────────────┤
│ id (UUID, PK)                                │
│ player_id (UUID, FK)                         │
│ session_id (UUID, FK)                        │
│ bet_amount (DECIMAL)                         │
│ initial_grid (JSONB) ──► [                   │
│                            ["stone1", ...],  │
│                            ["stone2", ...],  │
│                            ...               │
│                          ]                   │
│ cascades (JSONB) ──────► [                   │
│                            {                 │
│                              stepIndex: 0,   │
│                              matchedClusters, │
│                              droppingSymbols,│
│                              newSymbols,     │
│                              winAmount       │
│                            },                │
│                            {...}             │
│                          ]                   │
│ total_win (DECIMAL)                          │
│ multipliers_applied (JSONB)                  │
│ rng_seed (VARCHAR)                           │
│ game_mode (VARCHAR) ─► 'base' | 'free_spins'│
│ created_at (TIMESTAMP)                       │
└──────────────────────────────────────────────┘
```

### Redis Data Structures

```
┌────────────────────────────────────────────┐
│              REDIS CACHE                   │
├────────────────────────────────────────────┤
│                                            │
│  session:{token_hash}                      │
│  ├─ player_id                              │
│  ├─ username                               │
│  ├─ expires_at                             │
│  └─ is_active                              │
│                                            │
│  ratelimit:spin:{player_id}                │
│  ├─ count (increments per spin)            │
│  └─ ttl (60 seconds)                       │
│                                            │
│  gamestate:{player_id}                     │
│  ├─ grid (JSONB)                           │
│  ├─ credits (DECIMAL)                      │
│  ├─ free_spins_remaining (INT)             │
│  └─ accumulated_multiplier (DECIMAL)       │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🎮 Game Engine Architecture

### Cascade Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GAME ENGINE PIPELINE                            │
└─────────────────────────────────────────────────────────────────────┘

1. INITIAL GRID GENERATION
   ┌────────────────────────────────────┐
   │  RNG Seed (SHA-256)                │
   │  ▼                                 │
   │  Symbol Distribution Engine        │
   │  ▼                                 │
   │  5x5 Grid: ["stone1", "stone2"...] │
   └────────────────────────────────────┘
                  │
                  ▼
2. CLUSTER DETECTION
   ┌────────────────────────────────────┐
   │  Scan grid for 3+ adjacent symbols │
   │  ▼                                 │
   │  Flood-fill algorithm              │
   │  ▼                                 │
   │  [ { positions: [[0,1], ...],      │
   │      symbolType: "stone_power",    │
   │      size: 5 } ]                   │
   └────────────────────────────────────┘
                  │
                  ▼
3. WIN CALCULATION
   ┌────────────────────────────────────┐
   │  For each cluster:                 │
   │    base_payout = cluster_size * bet│
   │    multiplied = base * multiplier  │
   │  ▼                                 │
   │  Total win for cascade step        │
   └────────────────────────────────────┘
                  │
                  ▼
4. SYMBOL REMOVAL
   ┌────────────────────────────────────┐
   │  Remove matched symbols → null     │
   │  ▼                                 │
   │  Grid with gaps:                   │
   │  [ [null, "stone1", null], ... ]   │
   └────────────────────────────────────┘
                  │
                  ▼
5. GRAVITY DROP
   ┌────────────────────────────────────┐
   │  For each column:                  │
   │    Shift symbols down              │
   │    Track drop patterns:            │
   │      { from: {col:0,row:1},        │
   │        to: {col:0,row:3},          │
   │        distance: 2 }                │
   └────────────────────────────────────┘
                  │
                  ▼
6. NEW SYMBOL FILL
   ┌────────────────────────────────────┐
   │  Generate symbols for empty cells  │
   │  Using RNG seed + step index       │
   │  ▼                                 │
   │  [ { col: 0, row: 0,               │
   │      symbolType: "stone_time" } ]  │
   └────────────────────────────────────┘
                  │
                  ▼
7. CASCADE STEP COMPLETE
   ┌────────────────────────────────────┐
   │  Store:                            │
   │    • gridStateBefore               │
   │    • gridStateAfter                │
   │    • droppingSymbols[]             │
   │    • newSymbols[]                  │
   │    • winAmount                     │
   │    • totalWinSoFar                 │
   └────────────────────────────────────┘
                  │
                  ▼
8. REPEAT STEPS 2-7 UNTIL NO MATCHES
                  │
                  ▼
9. FINAL RESULT
   ┌────────────────────────────────────┐
   │  {                                 │
   │    spinId,                         │
   │    cascadeSteps: [...],            │
   │    totalWin,                       │
   │    finalGrid,                      │
   │    accumulatedMultiplier           │
   │  }                                 │
   └────────────────────────────────────┘
```

---

## 🔐 Authentication Flow

```
┌──────────────┐                           ┌──────────────┐
│   Client     │                           │   Server     │
└──────┬───────┘                           └──────┬───────┘
       │                                          │
       │  1. POST /api/auth/login                │
       │     { username, password }              │
       ├────────────────────────────────────────►│
       │                                          │
       │                                 2. bcrypt.compare()
       │                                          │
       │                                 3. Generate JWT
       │                                    • player_id
       │                                    • username
       │                                    • expires: 30m
       │                                          │
       │                                 4. Create session in Redis
       │                                    • token_hash
       │                                    • player_id
       │                                    • ttl: 30 minutes
       │                                          │
       │  5. Response                             │
       │     { token, refreshToken, player }     │
       │◄────────────────────────────────────────┤
       │                                          │
       │  6. Store token in localStorage          │
       │                                          │
       │  7. Subsequent requests                  │
       │     Authorization: Bearer <token>       │
       ├────────────────────────────────────────►│
       │                                          │
       │                                 8. Verify JWT
       │                                    • Signature
       │                                    • Expiry
       │                                    • Session active in Redis
       │                                          │
       │  9. API Response                         │
       │◄────────────────────────────────────────┤
       │                                          │
```

---

## 🐳 Docker Container Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐      ┌─────────────────────┐              │
│  │   Nginx (Reverse    │      │   Game Server       │              │
│  │      Proxy)         │      │   (Node.js/Express) │              │
│  │                     │      │                     │              │
│  │  Port: 80, 443      │◄─────┤  Port: 3000         │              │
│  │                     │      │                     │              │
│  │  Routes:            │      │  Routes:            │              │
│  │  /api → game-server │      │  /api/*             │              │
│  │  /auth → web-portal │      │  /health            │              │
│  └─────────────────────┘      └──────────┬──────────┘              │
│           │                              │                          │
│           │                              │                          │
│  ┌────────▼────────────┐      ┌──────────▼──────────┐              │
│  │   Web Portal        │      │  PostgreSQL         │              │
│  │   (Auth Frontend)   │      │                     │              │
│  │                     │      │  Port: 54321 (host) │              │
│  │  Port: 3001         │      │  Port: 5432 (cont.) │              │
│  │                     │      │                     │              │
│  │  Login/Register UI  │      │  Database:          │              │
│  └─────────────────────┘      │  infinity_storm     │              │
│                               │                     │              │
│                               │  Volume:            │              │
│                               │  postgres_data:/var/│              │
│                               │  lib/postgresql/data│              │
│                               └─────────────────────┘              │
│                                                                      │
│  ┌──────────────────────────────────────────────────┐              │
│  │   Redis                                          │              │
│  │                                                  │              │
│  │  Port: 6379                                      │              │
│  │                                                  │              │
│  │  Data Structures:                                │              │
│  │  • Sessions (token_hash → player_data)           │              │
│  │  • Rate limits (player_id → request_count)       │              │
│  │                                                  │              │
│  │  Volume: redis_data:/data                        │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Network: infinity_network (bridge)
```

---

## 📊 Monitoring & Observability

```
┌───────────────────────────────────────────────────────────┐
│                    LOGGING PIPELINE                       │
└───────────────────────────────────────────────────────────┘

Application Events
       │
       ▼
┌─────────────────┐
│  Winston Logger │
│                 │
│  Transports:    │
│  • Console      │───► stdout/stderr
│  • File (JSON)  │───► logs/combined.log
│  • File (Error) │───► logs/error.log
│  • File (Audit) │───► logs/audit.log
└─────────────────┘

Log Levels:
  error   ─► Critical errors (DB failures, crashes)
  warn    ─► Warnings (rate limits, payload size)
  info    ─► Important events (spin results, logins)
  http    ─► HTTP requests
  debug   ─► Detailed debugging

┌───────────────────────────────────────────────────────────┐
│                   METRICS COLLECTION                      │
└───────────────────────────────────────────────────────────┘

GET /api/admin/metrics
       │
       ▼
┌──────────────────────────────┐
│  Metrics Aggregator          │
│                              │
│  • Active sessions           │
│  • Spins per minute          │
│  • Average win rate          │
│  • RTP (Return to Player)    │
│  • Payload sizes             │
│  • Response times            │
│  • Database query times      │
└──────────────────────────────┘

Custom Headers:
  X-Payload-Bytes     ─► Response size monitoring
  X-Request-ID        ─► Request tracing
  X-RNG-Seed          ─► Reproducibility
```

---

## 🚀 Deployment Architecture (Production)

```
                      Internet
                         │
                         ▼
            ┌──────────────────────┐
            │   Load Balancer      │
            │   (AWS ELB / Nginx)  │
            └──────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌────────┐   ┌────────┐   ┌────────┐
    │ Node 1 │   │ Node 2 │   │ Node 3 │
    │ :3000  │   │ :3000  │   │ :3000  │
    └───┬────┘   └───┬────┘   └───┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│ PostgreSQL   │ │  Redis   │ │  Supabase  │
│ (RDS/Heroku) │ │ (Cloud)  │ │  (Cloud)   │
│              │ │          │ │            │
│ Primary/     │ │ Cluster  │ │ API + DB   │
│ Replica      │ │ Mode     │ │ + Auth     │
└──────────────┘ └──────────┘ └────────────┘
```

---

## 📈 Performance Optimization

### Client-Side

- **Sprite Pooling**: Reuse symbol sprites
- **Texture Atlases**: Combine images
- **Animation Batching**: Group tween updates
- **Lazy Loading**: Load assets on demand

### Server-Side

- **Connection Pooling**: PostgreSQL (10-50 connections)
- **Redis Caching**: Session data, rate limits
- **Response Compression**: Gzip/Brotli
- **Payload Optimization**: <50KB target

### Database

- **Indexes**: player_id, session_id, created_at
- **Partitioning**: spin_results by date
- **Archiving**: Old data to cold storage

---

**For detailed setup instructions, see [GAME_SETUP_GUIDE.md](./GAME_SETUP_GUIDE.md)**

---

*Last Updated: 2025-01-20*


