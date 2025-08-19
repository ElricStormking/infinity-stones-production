# Client-Server Conversion Technical Design

## Executive Summary
This document provides the complete technical blueprint for converting Infinity Storm from a client-only architecture to a secure client-server model with all game logic executed server-side. The design emphasizes security, scalability, and maintainability while preserving the exact game experience.

## Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WC[Web Client<br/>Phaser 3]
        AC[Admin Client<br/>React]
    end
    
    subgraph "API Gateway"
        NG[Nginx<br/>Load Balancer]
    end
    
    subgraph "Application Layer"
        GS[Game Server<br/>Node.js/Express]
        AS[Admin Server<br/>Node.js/Express]
        WS[WebSocket Server<br/>Socket.io]
    end
    
    subgraph "Service Layer"
        GE[Game Engine<br/>Service]
        RNG[RNG Service<br/>Crypto]
        AUTH[Auth Service<br/>JWT]
        WALLET[Wallet Service]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary DB)]
        REDIS[(Redis<br/>Session Cache)]
        S3[Object Storage<br/>Replay Data]
    end
    
    subgraph "Infrastructure"
        DOCKER[Docker Compose<br/>Orchestration]
        SUPABASE[Supabase<br/>Local Dev]
    end
    
    WC --> NG
    AC --> NG
    NG --> GS
    NG --> AS
    NG --> WS
    
    GS --> GE
    GS --> RNG
    GS --> AUTH
    GS --> WALLET
    
    AS --> AUTH
    AS --> PG
    
    GE --> PG
    AUTH --> REDIS
    WALLET --> PG
    GE --> S3
    
    DOCKER --> SUPABASE
    SUPABASE --> PG
```

## Database Schema

### Core Tables

```sql
-- Players table (supports future demo mode)
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits DECIMAL(12,2) DEFAULT 1000.00,
    is_demo BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    CONSTRAINT positive_credits CHECK (credits >= 0)
);

-- Sessions table (enforces single active session)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_player_active (player_id, is_active),
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
);

-- Game states table (preserves state across disconnects)
CREATE TABLE game_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id),
    state_data JSONB NOT NULL,
    game_mode VARCHAR(20) DEFAULT 'base',
    free_spins_remaining INT DEFAULT 0,
    accumulated_multiplier DECIMAL(6,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_player_state (player_id)
);

-- Spin results table (complete history with replay data)
CREATE TABLE spin_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id),
    spin_number BIGSERIAL,
    bet_amount DECIMAL(10,2) NOT NULL,
    initial_grid JSONB NOT NULL,
    cascades JSONB NOT NULL,
    total_win DECIMAL(12,2) DEFAULT 0,
    multipliers_applied JSONB,
    rng_seed VARCHAR(64) NOT NULL,
    game_mode VARCHAR(20) DEFAULT 'base',
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_player_spins (player_id, created_at DESC),
    INDEX idx_session_spins (session_id),
    INDEX idx_spin_time (created_at)
);

-- Transactions table (audit trail for all credit movements)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'bet', 'win', 'adjustment', 'purchase'
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    reference_id UUID, -- links to spin_results or other tables
    reference_type VARCHAR(50),
    description TEXT,
    created_by UUID REFERENCES players(id),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_player_trans (player_id, created_at DESC),
    INDEX idx_trans_type (type),
    INDEX idx_reference (reference_id)
);

-- Progressive jackpots table (future feature support)
CREATE TABLE jackpots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    current_value DECIMAL(12,2) DEFAULT 0,
    seed_value DECIMAL(10,2) NOT NULL,
    contribution_rate DECIMAL(5,4) NOT NULL, -- percentage of each bet
    last_won_at TIMESTAMP,
    last_winner_id UUID REFERENCES players(id),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Jackpot contributions (tracks progressive growth)
CREATE TABLE jackpot_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jackpot_id UUID REFERENCES jackpots(id),
    spin_id UUID REFERENCES spin_results(id),
    contribution_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_jackpot_contrib (jackpot_id)
);

-- Admin actions log (audit trail for admin operations)
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES players(id),
    action_type VARCHAR(50) NOT NULL,
    target_player_id UUID REFERENCES players(id),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_admin_logs (admin_id, created_at DESC),
    INDEX idx_target_logs (target_player_id)
);

-- RTP tracking table (monitors game fairness)
CREATE TABLE rtp_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_wins DECIMAL(15,2) DEFAULT 0,
    spin_count BIGINT DEFAULT 0,
    calculated_rtp DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_rtp_period (period_start, period_end)
);
```

### Database Indexes & Constraints

```sql
-- Ensure single active session per player
CREATE UNIQUE INDEX idx_one_active_session 
ON sessions(player_id) 
WHERE is_active = TRUE;

-- Optimize spin history pagination
CREATE INDEX idx_spin_pagination 
ON spin_results(player_id, created_at DESC, id);

-- Transaction integrity
ALTER TABLE transactions 
ADD CONSTRAINT valid_transaction 
CHECK (
    (type = 'bet' AND amount < 0) OR 
    (type = 'win' AND amount > 0) OR 
    (type IN ('adjustment', 'purchase'))
);

-- Session cleanup
CREATE INDEX idx_expired_sessions 
ON sessions(expires_at) 
WHERE is_active = TRUE;
```

## API Specifications

### Authentication Endpoints

```typescript
// POST /api/auth/login
interface LoginRequest {
    username: string;
    password: string;
}

interface LoginResponse {
    success: boolean;
    token: string;
    player: {
        id: string;
        username: string;
        credits: number;
        is_admin: boolean;
    };
    session_id: string;
}

// POST /api/auth/logout
interface LogoutRequest {
    session_id: string;
}

// POST /api/auth/refresh
interface RefreshRequest {
    token: string;
}

interface RefreshResponse {
    token: string;
    expires_in: number;
}
```

### Game Endpoints

```typescript
// POST /api/game/spin
interface SpinRequest {
    session_id: string;
    bet_amount: number; // 0.40 - 2000
}

interface SpinResponse {
    spin_id: string;
    initial_grid: Symbol[][];
    cascades: Cascade[];
    total_win: number;
    credits_balance: number;
    game_state: {
        mode: 'base' | 'free_spins';
        free_spins_remaining?: number;
        accumulated_multiplier?: number;
    };
}

interface Cascade {
    grid: Symbol[][];
    winning_clusters: Cluster[];
    symbols_removed: Position[];
    new_symbols: NewSymbol[];
    win_amount: number;
    multipliers?: Multiplier[];
}

// GET /api/game/history
interface HistoryRequest {
    player_id?: string; // admin can view any player
    offset: number; // default 0
    limit: number; // default 100, max 100
}

interface HistoryResponse {
    spins: SpinSummary[];
    total_count: number;
    has_more: boolean;
}

// GET /api/game/replay/:spin_id
interface ReplayResponse {
    spin_id: string;
    player_id: string;
    timestamp: string;
    bet_amount: number;
    total_win: number;
    replay_data: SpinResponse;
}

// POST /api/game/purchase-free-spins
interface PurchaseRequest {
    session_id: string;
    multiplier: number; // 40x or 100x bet
}
```

### Admin Endpoints

```typescript
// GET /api/admin/players
interface PlayersListResponse {
    players: PlayerInfo[];
    total_count: number;
}

// POST /api/admin/adjust-credits
interface AdjustCreditsRequest {
    player_id: string;
    amount: number;
    reason: string;
}

// GET /api/admin/metrics
interface MetricsResponse {
    current_rtp: number;
    active_sessions: number;
    daily_stats: {
        total_bets: number;
        total_wins: number;
        unique_players: number;
    };
    system_health: {
        database_status: 'healthy' | 'degraded';
        redis_status: 'healthy' | 'degraded';
        api_latency_ms: number;
    };
}

// GET /api/admin/transactions
interface TransactionQuery {
    player_id?: string;
    type?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
}
```

### WebSocket Events

```typescript
// Server -> Client Events
interface ServerEvents {
    'spin:progress': {
        cascade_index: number;
        total_cascades: number;
    };
    
    'session:expired': {
        reason: string;
    };
    
    'balance:updated': {
        credits: number;
        transaction_type: string;
    };
    
    'jackpot:update': {
        jackpot_name: string;
        current_value: number;
    };
}

// Client -> Server Events  
interface ClientEvents {
    'spin:request': {
        bet_amount: number;
    };
    
    'heartbeat': {
        timestamp: number;
    };
}
```

## Service Architecture

### Game Engine Service

```typescript
class GameEngineService {
    // Core game logic
    async processSpin(playerId: string, betAmount: number): Promise<SpinResult> {
        // 1. Generate initial grid
        const grid = this.generateGrid();
        
        // 2. Process cascades
        const cascades = [];
        let currentGrid = grid;
        let totalWin = 0;
        
        while (true) {
            const clusters = this.findWinningClusters(currentGrid);
            if (clusters.length === 0) break;
            
            const cascadeWin = this.calculateWin(clusters, betAmount);
            totalWin += cascadeWin;
            
            const newGrid = this.processCascade(currentGrid, clusters);
            cascades.push({
                grid: currentGrid,
                winning_clusters: clusters,
                win_amount: cascadeWin
            });
            
            currentGrid = newGrid;
        }
        
        // 3. Apply special features
        if (this.shouldTriggerRandomMultiplier()) {
            totalWin = this.applyRandomMultipliers(totalWin);
        }
        
        // 4. Check free spins trigger
        const scatterCount = this.countScatters(currentGrid);
        const triggeredFreeSpins = scatterCount >= 4;
        
        return {
            initial_grid: grid,
            cascades,
            total_win: totalWin,
            triggered_free_spins: triggeredFreeSpins
        };
    }
    
    private generateGrid(): Symbol[][] {
        // Use weighted probabilities from GameConfig
        // Ensure cryptographically secure randomness
    }
    
    private findWinningClusters(grid: Symbol[][]): Cluster[] {
        // Implement flood-fill algorithm
        // Minimum 8 symbols for a win
    }
}
```

### RNG Service

```typescript
class RNGService {
    private crypto = require('crypto');
    
    generateSeed(playerId: string, spinId: string): string {
        const timestamp = Date.now();
        const data = `${playerId}-${spinId}-${timestamp}`;
        return this.crypto.createHash('sha256').update(data).digest('hex');
    }
    
    random(seed: string): number {
        // Deterministic PRNG seeded with crypto-secure seed
        // Returns value between 0 and 1
    }
    
    weightedChoice<T>(items: T[], weights: number[], seed: string): T {
        // Select item based on weighted probabilities
        // Used for symbol generation
    }
}
```

### Wallet Service

```typescript
class WalletService {
    async deductBet(playerId: string, amount: number): Promise<Transaction> {
        return await this.db.transaction(async (trx) => {
            // Lock player row to prevent race conditions
            const player = await trx('players')
                .where('id', playerId)
                .forUpdate()
                .first();
            
            if (player.credits < amount) {
                throw new InsufficientCreditsError();
            }
            
            const newBalance = player.credits - amount;
            
            await trx('players')
                .where('id', playerId)
                .update({ credits: newBalance });
            
            return await trx('transactions').insert({
                player_id: playerId,
                type: 'bet',
                amount: -amount,
                balance_before: player.credits,
                balance_after: newBalance
            }).returning('*');
        });
    }
    
    async creditWin(playerId: string, amount: number, spinId: string): Promise<Transaction> {
        // Similar transaction logic for crediting wins
    }
}
```

## Docker Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: infinity_storm
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Supabase (Development)
  supabase:
    image: supabase/postgres:15.1.0.117
    environment:
      POSTGRES_PASSWORD: ${SUPABASE_PASSWORD}
    volumes:
      - supabase_data:/var/lib/postgresql/data
    ports:
      - "54321:5432"
    profiles:
      - development

  # Game Server
  game-server:
    build:
      context: ./infinity-storm-server
      dockerfile: Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV}
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/infinity_storm
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    volumes:
      - ./infinity-storm-server:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  # Admin Server
  admin-server:
    build:
      context: ./admin-panel
      dockerfile: Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV}
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/infinity_storm
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3001
    volumes:
      - ./admin-panel:/app
      - /app/node_modules
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    command: npm run dev

  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - game-server
      - admin-server

volumes:
  postgres_data:
  redis_data:
  supabase_data:

networks:
  default:
    name: infinity-storm-network
```

### Environment Configuration

```bash
# .env.development
NODE_ENV=development
DB_PASSWORD=dev_password_change_me
SUPABASE_PASSWORD=supabase_password_change_me
JWT_SECRET=dev_jwt_secret_change_me
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://admin:dev_password_change_me@localhost:5432/infinity_storm

# .env.staging
NODE_ENV=staging
DB_PASSWORD=${STAGING_DB_PASSWORD}
JWT_SECRET=${STAGING_JWT_SECRET}
REDIS_URL=redis://redis:6379
DATABASE_URL=${STAGING_DATABASE_URL}

# .env.production
NODE_ENV=production
DB_PASSWORD=${PROD_DB_PASSWORD}
JWT_SECRET=${PROD_JWT_SECRET}
REDIS_URL=${PROD_REDIS_URL}
DATABASE_URL=${PROD_DATABASE_URL}
```

## Security Implementation

### JWT Token Management

```typescript
class AuthService {
    private readonly TOKEN_EXPIRY = 30 * 60; // 30 minutes
    private readonly REFRESH_THRESHOLD = 5 * 60; // Refresh if < 5 min remaining
    
    generateToken(playerId: string, sessionId: string): string {
        const payload = {
            player_id: playerId,
            session_id: sessionId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.TOKEN_EXPIRY
        };
        
        return jwt.sign(payload, process.env.JWT_SECRET);
    }
    
    verifyToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            throw new UnauthorizedError('Invalid token');
        }
    }
    
    async refreshIfNeeded(token: string): Promise<string | null> {
        const decoded = this.verifyToken(token);
        const timeRemaining = decoded.exp - Math.floor(Date.now() / 1000);
        
        if (timeRemaining < this.REFRESH_THRESHOLD) {
            // Update session last_activity
            await this.updateSessionActivity(decoded.session_id);
            return this.generateToken(decoded.player_id, decoded.session_id);
        }
        
        return null;
    }
}
```

### Rate Limiting

```typescript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Spin endpoint rate limiting
const spinLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rl:spin:'
    }),
    windowMs: 1000, // 1 second
    max: 2, // max 2 spins per second
    message: 'Too many spin requests',
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiting
const apiLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rl:api:'
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests'
});
```

### Input Validation

```typescript
const { body, validationResult } = require('express-validator');

// Spin validation
const validateSpin = [
    body('bet_amount')
        .isFloat({ min: 0.40, max: 2000 })
        .withMessage('Bet must be between $0.40 and $2000'),
    body('session_id')
        .isUUID()
        .withMessage('Invalid session ID'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
```

## Client-Server Communication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Game Server
    participant W as Wallet Service
    participant E as Game Engine
    participant D as Database
    
    C->>G: POST /api/game/spin
    G->>G: Validate JWT & Session
    G->>W: Deduct Bet
    W->>D: BEGIN TRANSACTION
    W->>D: Lock Player Row
    W->>D: Update Credits
    W->>D: Insert Transaction
    W->>D: COMMIT
    W-->>G: Bet Deducted
    
    G->>E: Process Spin
    E->>E: Generate Grid
    E->>E: Find Clusters
    E->>E: Calculate Cascades
    E-->>G: Spin Result
    
    G->>W: Credit Winnings
    W->>D: Update Credits
    W->>D: Insert Transaction
    W-->>G: Credits Updated
    
    G->>D: Save Spin Result
    G-->>C: Spin Response
    
    C->>C: Animate Results
    C->>C: Update UI
```

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1)
1. Set up Docker development environment
2. Initialize PostgreSQL database with schema
3. Configure Redis for session management
4. Set up Nginx reverse proxy

### Phase 2: Server Implementation (Weeks 2-3)
1. Implement authentication system
2. Build game engine service
3. Create wallet service with transactions
4. Implement spin processing pipeline
5. Add WebSocket support for real-time updates

### Phase 3: Client Refactoring (Week 4)
1. Replace local RNG with server API calls
2. Update GridManager to display server results
3. Modify WinCalculator to show server calculations
4. Update NetworkService for new endpoints
5. Add connection recovery logic

### Phase 4: Admin Panel (Week 5)
1. Create React-based admin interface
2. Implement player management features
3. Add transaction audit views
4. Create RTP monitoring dashboard
5. Build credit adjustment tools

### Phase 5: Testing & Optimization (Week 6)
1. Load testing with 100+ concurrent players
2. RTP verification (1M+ spin simulation)
3. Security penetration testing
4. Performance optimization
5. Database query optimization

### Phase 6: Deployment (Week 7)
1. Set up staging environment
2. Run full integration tests
3. Performance benchmarking
4. Deploy to production
5. Monitor and iterate

## Performance Optimizations

### Database Optimizations
- Connection pooling with pg-pool
- Prepared statements for common queries
- Materialized views for RTP calculations
- Partitioned tables for spin_results by month
- Read replicas for analytics queries

### Caching Strategy
- Redis for active sessions
- Cache player balance for 1 second
- Cache game config for 5 minutes
- WebSocket connection pooling
- HTTP/2 for API requests

### Query Optimization Examples

```sql
-- Efficient spin history pagination
PREPARE get_spin_history AS
SELECT 
    id, 
    spin_number,
    bet_amount,
    total_win,
    created_at
FROM spin_results
WHERE player_id = $1
    AND created_at < $2
ORDER BY created_at DESC
LIMIT $3;

-- RTP calculation with materialized view
CREATE MATERIALIZED VIEW hourly_rtp AS
SELECT 
    date_trunc('hour', created_at) as hour,
    SUM(bet_amount) as total_bets,
    SUM(total_win) as total_wins,
    COUNT(*) as spin_count,
    (SUM(total_win) / NULLIF(SUM(bet_amount), 0)) * 100 as rtp
FROM spin_results
GROUP BY date_trunc('hour', created_at);

CREATE INDEX idx_hourly_rtp ON hourly_rtp(hour DESC);
```

## Monitoring & Observability

### Health Check Endpoints

```typescript
// GET /health
app.get('/health', async (req, res) => {
    const checks = {
        database: await checkDatabase(),
        redis: await checkRedis(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
    };
    
    const healthy = checks.database && checks.redis;
    res.status(healthy ? 200 : 503).json(checks);
});

// GET /metrics
app.get('/metrics', async (req, res) => {
    const metrics = {
        active_sessions: await getActiveSessions(),
        spins_per_minute: await getSpinRate(),
        average_response_time: await getAvgResponseTime(),
        current_rtp: await getCurrentRTP()
    };
    
    res.json(metrics);
});
```

### Logging Strategy

```typescript
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ 
            filename: 'error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'audit.log',
            level: 'info'
        })
    ]
});

// Audit logging middleware
const auditLog = (req, res, next) => {
    logger.info({
        type: 'api_request',
        method: req.method,
        path: req.path,
        player_id: req.player?.id,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    next();
};
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: any;
    };
    request_id: string;
    timestamp: string;
}

// Error codes
enum ErrorCode {
    INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
    INVALID_BET_AMOUNT = 'INVALID_BET_AMOUNT',
    SESSION_EXPIRED = 'SESSION_EXPIRED',
    CONCURRENT_SESSION = 'CONCURRENT_SESSION',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SERVER_ERROR = 'SERVER_ERROR'
}
```

### Global Error Handler

```typescript
app.use((error, req, res, next) => {
    const requestId = req.id || uuid();
    
    logger.error({
        request_id: requestId,
        error: error.message,
        stack: error.stack,
        player_id: req.player?.id
    });
    
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || ErrorCode.SERVER_ERROR;
    
    res.status(statusCode).json({
        error: {
            code: errorCode,
            message: error.message || 'Internal server error'
        },
        request_id: requestId,
        timestamp: new Date().toISOString()
    });
});
```

## Testing Strategy

### Unit Tests

```typescript
describe('GameEngine', () => {
    describe('generateGrid', () => {
        it('should generate 6x5 grid', () => {
            const grid = engine.generateGrid();
            expect(grid).toHaveLength(6);
            expect(grid[0]).toHaveLength(5);
        });
        
        it('should use weighted probabilities', () => {
            const symbols = [];
            for (let i = 0; i < 1000; i++) {
                const grid = engine.generateGrid();
                symbols.push(...grid.flat());
            }
            // Verify distribution matches config
        });
    });
    
    describe('findWinningClusters', () => {
        it('should find clusters of 8+ symbols', () => {
            const grid = createTestGrid(/* ... */);
            const clusters = engine.findWinningClusters(grid);
            expect(clusters[0].positions).toHaveLength(8);
        });
    });
});
```

### Integration Tests

```typescript
describe('Spin API', () => {
    it('should process complete spin cycle', async () => {
        const response = await request(app)
            .post('/api/game/spin')
            .set('Authorization', `Bearer ${token}`)
            .send({ bet_amount: 1.00 });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('spin_id');
        expect(response.body).toHaveProperty('cascades');
        expect(response.body).toHaveProperty('total_win');
    });
    
    it('should handle insufficient credits', async () => {
        const response = await request(app)
            .post('/api/game/spin')
            .set('Authorization', `Bearer ${token}`)
            .send({ bet_amount: 10000 });
        
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INSUFFICIENT_CREDITS');
    });
});
```

## Future Considerations

### Progressive Jackpot Implementation
The database schema already supports progressive jackpots. When ready to implement:
1. Enable contribution tracking on each spin
2. Implement jackpot trigger logic (specific symbol combinations)
3. Add real-time jackpot display updates via WebSocket
4. Create jackpot winner notification system

### Demo Mode Support
The player table includes is_demo flag. To implement:
1. Create separate credit pool for demo players
2. Skip transaction recording for demo spins
3. Limit demo session duration
4. Prevent demo players from accessing real money features

### Scalability Path
For handling increased load beyond current design:
1. Implement database sharding by player_id
2. Add Redis Cluster for distributed caching
3. Use message queue (RabbitMQ/Kafka) for async processing
4. Deploy multiple game server instances with sticky sessions
5. Consider microservices architecture for game engine

## Success Criteria

1. **Security**: Zero client-side game logic execution
2. **Performance**: <500ms p95 response time for spins
3. **Reliability**: 99.9% uptime with graceful degradation
4. **Accuracy**: 96.5% RTP maintained over 1M spins
5. **Auditability**: Complete transaction and action logging
6. **Scalability**: Support 100+ concurrent players
7. **Maintainability**: Clean separation of concerns with Docker
8. **User Experience**: Identical gameplay feel to current version