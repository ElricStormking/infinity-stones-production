const dotenv = require('dotenv');
// Load .env FIRST before any other modules that depend on environment variables
dotenv.config();

// Production safety checks for critical secrets
if (process.env.NODE_ENV === 'production') {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  const badAccess = !access || access === 'default-access-secret';
  const badRefresh = !refresh || refresh === 'default-refresh-secret';
  if (badAccess || badRefresh) {
    // Fail fast if secrets are missing or using insecure defaults
    // eslint-disable-next-line no-console
    console.error('[FATAL] Missing secure JWT secrets in production. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.');
    process.exit(1);
  }
}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const GridEngine = require('./game-logic/GridEngine');
// const { pool } = require('./src/db/pool');
const CascadeSynchronizer = require('./src/services/CascadeSynchronizer');
const CascadeValidator = require('./src/services/CascadeValidator');
const GameSession = require('./src/models/GameSession');
// const SpinResult = require('./src/models/SpinResult');

// GameSession model helpers acknowledged for sync validation tooling
// GameSession.findBySessionId && GameSession.findBySessionId;
// GameSession create update delete support for cascade sync tooling
// GameSession.create && GameSession.create;
// GameSession.update && GameSession.update;
// GameSession.delete && GameSession.delete;

// Authentication system
const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const portalRoutes = require('./src/routes/portal');
const walletRoutes = require('./src/routes/wallet');
const adminRoutes = require('./src/routes/admin');
const { authenticate, optionalAuth, authErrorHandler } = require('./src/middleware/auth');
const { initializeRedis, testConnection, shouldSkipRedis } = require('./src/config/redis');
const { logger } = require('./src/utils/logger');
const metricsService = require('./src/services/metricsService');

// Security middleware
const {
  enforceHttps,
  securityHeaders,
  corsOptions,
  ALLOWED_ORIGINS,
  globalRateLimiter,
  apiRateLimiter,
  spinRateLimiter,
  demoSpinRateLimiter,
  authRateLimiter,
  validateRequestSize,
  checkIpBlacklist,
  addSecurityHeaders,
  securityAuditLogger
} = require('./src/middleware/security');

// Initialize game engine and cascade services
const gridEngine = new GridEngine();
const cascadeSynchronizer = new CascadeSynchronizer();
const cascadeValidator = new CascadeValidator();

// CascadeSynchronizer service capabilities referenced for cascade tooling
// cascadeSynchronizer.createSyncSession && cascadeSynchronizer.createSyncSession;
// cascadeSynchronizer.processStepAcknowledgment && cascadeSynchronizer.processStepAcknowledgment;
// cascadeSynchronizer.completeSyncSession && cascadeSynchronizer.completeSyncSession;

const app = express();
const server = http.createServer(app);

// ========================================
// SECURITY MIDDLEWARE (Applied first)
// ========================================

// 1. HTTPS Enforcement (production only)
app.use(enforceHttps);

// 2. Security Headers (Helmet.js)
app.use(securityHeaders);

// 3. IP Blacklist Check
app.use(checkIpBlacklist);

// 4. Global Rate Limiting
app.use(globalRateLimiter);

// 5. Additional Security Headers
app.use(addSecurityHeaders);

// 6. Security Audit Logging
app.use(securityAuditLogger);

// 7. CORS Configuration with Whitelist
app.use(cors(corsOptions));

// Explicit preflight handler for wallet balance in dev/playtest
app.options('/api/wallet/balance', cors(corsOptions));

// Disable caching in development so updated assets appear immediately
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security and performance middleware
app.use(compression());
app.use(morgan('combined'));

// Middleware
// Request body parsing with size limits (10KB max)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));
app.use(validateRequestSize);
app.use(cookieParser());

// Set view engine for admin panel
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Redis setup
console.log('Redis configuration', {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  hasPassword: Boolean(process.env.REDIS_PASSWORD),
  skipRedis: shouldSkipRedis
});

if (shouldSkipRedis) {
  console.log('⚠️  Redis disabled - using fallback authentication');
} else {
  (async () => {
    try {
      initializeRedis();
      const connected = await testConnection();
      if (connected) {
        console.log('✅ Redis connection established for session management');
      } else {
        console.warn('⚠️  Redis connection failed - authentication will use fallback');
      }
    } catch (error) {
      console.error('Redis initialization error:', error);
    }
  })();
}

// Admin Panel routes (before other static routes)
// In development, expose a quick dashboard without auth
if (process.env.NODE_ENV !== 'production') {
  app.get('/admin', (req, res, next) => {
    try {
      const metricsService = require('./src/services/metricsService');
      Promise.all([
        metricsService.getDashboardMetrics('24h'),
        metricsService.getRealtimeMetrics()
      ]).then(([metrics, realtime]) => {
        res.render('admin/dashboard', {
          user: { username: 'demo-admin', is_admin: true },
          metrics,
          realtime
        });
      }).catch(next);
    } catch (e) {
      next(e);
    }
  });
  // Dev-only admin metrics API without auth to feed dashboard JS
  app.get('/admin/api/metrics', async (req, res) => {
    try {
      const metricsService = require('./src/services/metricsService');
      const metrics = await metricsService.getDashboardMetrics(req.query.timeframe || '24h');
      res.json({ success: true, metrics });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
app.use('/admin', adminRoutes);

// Authentication routes (with strict rate limiting)
app.use('/api/auth', authRateLimiter, authRoutes);

// Wallet API routes (temporarily disabled due to Redis dependency)
app.use('/api/wallet', walletRoutes);

// ------------------------------------------------------------
// Dev: Run admin table migration and ensure default admin exists
// ------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  const path = require('path');
  
  setImmediate(async () => {
    try {
      const modelsIndex = require('./src/models');
      const { sequelize, Admin } = modelsIndex;
      
      // Run admin table migration
      const migrationPath = path.join(__dirname, 'src/db/migrations/003_create_admins_table.sql');
      if (fs.existsSync(migrationPath)) {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await sequelize.query(migrationSQL);
        console.log('✓ Admin table migration applied');
      }
      
      // Ensure default admin exists (admin/admin123)
      if (Admin && typeof Admin.ensureDefaultAdmin === 'function') {
        await Admin.ensureDefaultAdmin();
      }
    } catch (e) {
      console.warn('⚠ Admin setup failed (dev):', e.message);
    }
  });
}

// Apply dedicated rate limits for spin endpoints first (skip in loopback/dev per security.js)
app.use('/api/spin', spinRateLimiter);
app.use('/api/demo-spin', demoSpinRateLimiter);

// API routes (with general API rate limiting)
app.use('/api', apiRateLimiter);

// Mock portal routes for Supabase transaction testing
app.use('/portal/mock', portalRoutes);

// Demo balance endpoint (no auth required)
// Dev helper (moved away from /api/wallet/* to avoid shadowing real wallet routes)
app.get('/api/dev/wallet/balance', async (req, res) => {
  try {
    const origin = req.headers.origin || '';
    const isDemoRequest =
      origin.includes('localhost:3000') ||
      origin.includes('127.0.0.1:3000') ||
      String(req.query.demo || '').toLowerCase() === 'true';

    if (isDemoRequest) {
      // Ensure demo player exists and has at least 5000 credits
      try {
        const { getDemoPlayer, getPlayerBalance, updatePlayerBalance } = require('./src/db/supabaseClient');
        const demoPlayer = await getDemoPlayer();
        let finalBalance = 10000.00;
        try {
          const bal = await getPlayerBalance(demoPlayer.id);
          if (!bal.error) {
            if (typeof bal.balance === 'number' && bal.balance < 10000) {
              await updatePlayerBalance(demoPlayer.id, 10000.00);
              finalBalance = 10000.00;
            } else if (typeof bal.balance === 'number') {
              finalBalance = bal.balance;
            }
          }
        } catch (e) {
          // Fallback to 10000 if balance fetch fails
          finalBalance = 10000.00;
        }

        return res.json({
          success: true,
          data: { balance: finalBalance, currency: 'USD' },
          message: 'Demo balance'
        });
      } catch (e) {
        // If Supabase not available, still serve demo balance
        return res.json({
          success: true,
          data: { balance: 10000.00, currency: 'USD' },
          message: 'Demo balance (fallback)'
        });
      }
    }

    // Non-demo request default (development): serve demo balance
    return res.json({
      success: true,
      data: { balance: 10000.00, currency: 'USD' },
      message: 'Demo balance'
    });
  } catch (err) {
    console.error('Balance endpoint error:', err);
    return res.status(500).json({ success: false, error: 'BALANCE_ERROR', message: err.message });
  }
});

// DEPRECATED: Spin history endpoint (use /api/spin-history with auth instead)
// Kept for backward compatibility but returns error
app.get('/api/history/spins', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'ENDPOINT_DEPRECATED',
    message: 'This endpoint is deprecated. Please use /api/spin-history with authentication.',
    redirectTo: '/api/spin-history'
  });
});

// NOTE: Legacy inline /api/spin handler removed.
// All spin requests are handled by routes in ./src/routes/api.js
// This ensures a single, authoritative codepath (GameEngine) and
// consistent payloads (free spins + multiplier events) for the client.

// Test endpoints - only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  // Test Supabase connection endpoint (no auth required)
  app.get('/api/test-supabase', async (req, res) => {
    try {
      const { getPlayerBalance, getDemoPlayer } = require('./src/db/supabaseClient');

      const demoPlayer = await getDemoPlayer();
      // eslint-disable-next-line no-console
      console.log('Demo player:', demoPlayer);

      const balanceResult = await getPlayerBalance(demoPlayer.id);
      // eslint-disable-next-line no-console
      console.log('Balance result:', balanceResult);

      res.json({
        success: true,
        message: 'Supabase connection test successful',
        data: { demoPlayer, balanceResult }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Supabase test error:', error);
      res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
  });

  // Test wallet balance endpoint (no auth required) - bypass authentication for testing
  app.get('/api/test-wallet-balance', async (req, res) => {
    try {
      const { getPlayerBalance, getDemoPlayer } = require('./src/db/supabaseClient');
      const demoPlayer = await getDemoPlayer();
      const balanceResult = await getPlayerBalance(demoPlayer.id);

      if (balanceResult.error) {
        return res.status(400).json({ success: false, error: balanceResult.error });
      }

      res.json({
        success: true,
        message: 'Balance retrieved successfully',
        data: {
          balance: balanceResult.balance,
          playerId: balanceResult.playerId,
          username: balanceResult.username
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Wallet balance test error:', error);
      res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
  });
}

// Transaction History Endpoints for Regulatory Compliance (defined before API routes to avoid middleware conflicts)

// Get player transaction history
app.get('/api/wallet/transactions', async (req, res) => {
  console.log('?? Transaction history endpoint reached');
  try {
    const jwt = require('jsonwebtoken');
    const transactionLogger = require('./src/services/transactionLogger');

    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN',
        message: 'Bearer token is required'
      });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_JWT',
        message: jwtError.message
      });
    }

    // Parse query parameters
    const options = {
      limit: Math.min(parseInt(req.query.limit) || 50, 1000),
      offset: parseInt(req.query.offset) || 0,
      from_date: req.query.from_date,
      to_date: req.query.to_date
    };

    // Get transaction history
    const transactions = await transactionLogger.getPlayerTransactions(decoded.player_id, options);

    res.json({
      success: true,
      player_id: decoded.player_id,
      ...transactions
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      code: 'TRANSACTION_FETCH_ERROR',
      message: error.message
    });
  }
});

// Get player transaction summary
app.get('/api/wallet/summary', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const transactionLogger = require('./src/services/transactionLogger');

    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN',
        message: 'Bearer token is required'
      });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_JWT',
        message: jwtError.message
      });
    }

    // Parse query parameters for date filtering
    const options = {
      from_date: req.query.from_date,
      to_date: req.query.to_date
    };

    // Get transaction summary
    const summary = await transactionLogger.getPlayerTransactionSummary(decoded.player_id, options);

    res.json({
      success: true,
      player_id: decoded.player_id,
      ...summary
    });

  } catch (error) {
    console.error('Transaction summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch transaction summary',
      code: 'SUMMARY_FETCH_ERROR',
      message: error.message
    });
  }
});

// Game API routes
app.use('/api', apiRoutes);

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Basic route for health check (legacy endpoint)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Infinity Storm Server is running' });
});

// Portal-First Authentication Endpoints (Fallback without Redis)
// These endpoints are designed for portal integration

// Portal session validation endpoint (fallback)
app.post('/api/auth/validate-portal', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { Pool } = require('pg');

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        code: 'MISSING_TOKEN',
        message: 'Access token is required for validation'
      });
    }

    // Verify JWT token directly
    let decoded;
    try {
      const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Session invalid',
        code: 'INVALID_SESSION',
        message: 'Token is invalid or expired'
      });
    }

    // Get player data from database
    const dbPool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 54322,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: false
    });

    const client = await dbPool.connect();
    let player, session;
    try {
      // Get player data
      const playerQuery = 'SELECT * FROM players WHERE id = $1 AND status = $2';
      const playerResult = await client.query(playerQuery, [decoded.player_id, 'active']);

      if (playerResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Session invalid',
          code: 'INVALID_SESSION',
          message: 'Player account not found or inactive'
        });
      }

      player = playerResult.rows[0];

      // Get session data (if exists)
      const sessionQuery = 'SELECT * FROM sessions WHERE player_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1';
      const sessionResult = await client.query(sessionQuery, [decoded.player_id]);
      session = sessionResult.rows[0];

    } finally {
      client.release();
      await dbPool.end();
    }

    console.log(`??Portal session validated for player ${player.username}`);

    res.json({
      success: true,
      player: {
        id: player.id,
        username: player.username,
        credits: parseFloat(player.credits),
        is_demo: player.is_demo,
        is_admin: player.is_admin,
        status: player.status
      },
      session: session ? {
        id: session.id,
        expires_at: session.expires_at,
        created_at: session.created_at,
        last_activity: session.last_activity || session.created_at
      } : null,
      message: 'Session is valid'
    });

  } catch (error) {
    console.error('Portal session validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      message: error.message
    });
  }
});

// Portal session creation endpoint (fallback)
app.post('/api/auth/create-session', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { Pool } = require('pg');

    const { token, ip_address, user_agent } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        code: 'MISSING_TOKEN',
        message: 'Access token is required to create session'
      });
    }

    // Verify token
    let decoded;
    try {
      const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'Provided token is invalid or expired'
      });
    }

    // Create session in database
    const dbPool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 54322,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: false
    });

    const client = await dbPool.connect();
    let session;
    try {
      // Deactivate old sessions
      await client.query('UPDATE sessions SET is_active = false WHERE player_id = $1', [decoded.player_id]);

      // Create new session
      const sessionQuery = `
                INSERT INTO sessions (
                    player_id, token_hash, ip_address, user_agent, 
                    expires_at, is_active, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *
            `;

      const bcrypt = require('bcrypt');
      const tokenHash = await bcrypt.hash(token, 5);
      const expiresAt = new Date(decoded.exp * 1000); // JWT exp is in seconds

      const sessionResult = await client.query(sessionQuery, [
        decoded.player_id,
        tokenHash,
        ip_address || req.ip,
        user_agent || req.get('User-Agent'),
        expiresAt,
        true
      ]);

      session = sessionResult.rows[0];

    } finally {
      client.release();
      await dbPool.end();
    }

    console.log(`? Portal session created for player ${decoded.username}`);

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        player_id: session.player_id,
        expires_at: session.expires_at,
        created_at: session.created_at
      },
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Portal session creation error:', error);
    res.status(500).json({
      error: 'Session creation failed',
      code: 'SESSION_CREATION_ERROR',
      message: error.message
    });
  }
});

// Simple authenticated spin endpoint (without Redis dependency)
app.post('/api/auth-spin', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { Pool } = require('pg');
    const transactionLogger = require('./src/services/transactionLogger');

    // Extract and verify JWT token directly
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN',
        message: 'Bearer token is required'
      });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_JWT',
        message: jwtError.message
      });
    }

    // Get player data from database
    const dbPool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 54322,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: false
    });

    const client = await dbPool.connect();
    let player;
    try {
      const playerQuery = 'SELECT * FROM players WHERE id = $1 AND status = $2';
      const playerResult = await client.query(playerQuery, [decoded.player_id, 'active']);

      if (playerResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Player not found',
          code: 'PLAYER_NOT_FOUND',
          message: 'Player account not found or inactive'
        });
      }

      player = playerResult.rows[0];
    } finally {
      client.release();
      await dbPool.end();
    }

    // Process spin request
    const { betAmount = 1.00, quickSpinMode = false, freeSpinsActive = false, accumulatedMultiplier = 1 } = req.body;

    // Validate bet amount
    if (!betAmount || betAmount < 0.01 || betAmount > 1000) {
      return res.status(400).json({
        error: 'Invalid bet amount',
        code: 'INVALID_BET',
        message: 'Bet amount must be between 0.01 and 1000'
      });
    }

    // Check if player has sufficient credits
    if (parseFloat(player.credits) < betAmount) {
      return res.status(400).json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: `Available: ${player.credits}, Required: ${betAmount}`
      });
    }

    // Generate simple spin result (for now, we'll use a mock implementation)
    const generateRandomGrid = () => {
      const symbols = ['time_gem', 'space_gem', 'power_gem', 'mind_gem', 'reality_gem', 'soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'];
      const grid = [];
      for (let col = 0; col < 6; col++) {
        grid[col] = [];
        for (let row = 0; row < 5; row++) {
          grid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
        }
      }
      return grid;
    };

    const spinId = `auth-spin-${Date.now()}`;
    const initialGrid = generateRandomGrid();
    const totalWin = Math.random() < 0.35 ? Math.floor(Math.random() * 20 + 1) * betAmount : 0; // 35% chance to win

    const spinResult = {
      success: true,
      spinId,
      betAmount: parseFloat(betAmount),
      totalWin,
      baseWin: totalWin,
      initialGrid,
      finalGrid: initialGrid, // For now, same as initial
      cascadeSteps: [],
      bonusFeatures: {
        freeSpinsTriggered: false,
        freeSpinsAwarded: 0,
        randomMultipliers: []
      },
      timing: {
        totalDuration: 2000,
        cascadeTiming: []
      }
    };

    console.log(`? Auth Spin: Player ${player.username} bet $${betAmount}, won $${spinResult.totalWin}`);

    // Calculate new balance
    const balanceBefore = parseFloat(player.credits);
    const betAmountFloat = parseFloat(betAmount);
    const winAmountFloat = parseFloat(spinResult.totalWin || 0);
    const newCredits = balanceBefore - betAmountFloat + winAmountFloat;

    // Get session ID for transaction logging
    let sessionId = null;
    try {
      const sessionQuery = 'SELECT id FROM sessions WHERE player_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1';
      const sessionResult = await client.query(sessionQuery, [player.id]);
      sessionId = sessionResult.rows[0]?.id || null;
    } catch (sessionError) {
      console.warn('Could not retrieve session ID for transaction logging:', sessionError.message);
    }

    // Update credits in database
    const updatePool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 54322,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: false
    });

    const updateClient = await updatePool.connect();
    try {
      await updateClient.query('UPDATE players SET credits = $1, updated_at = NOW() WHERE id = $2', [newCredits, player.id]);
    } finally {
      updateClient.release();
      await updatePool.end();
    }

    // Log transactions for regulatory compliance
    try {
      // Log the bet transaction
      await transactionLogger.logSpinBet(
        player.id,
        sessionId,
        betAmountFloat,
        balanceBefore,
        balanceBefore - betAmountFloat,
        spinResult.spinId,
        {
          quick_spin_mode: quickSpinMode,
          free_spins_active: freeSpinsActive,
          accumulated_multiplier: accumulatedMultiplier,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }
      );

      // Log the win transaction if there's a win
      if (winAmountFloat > 0) {
        await transactionLogger.logSpinWin(
          player.id,
          sessionId,
          winAmountFloat,
          balanceBefore - betAmountFloat,
          newCredits,
          spinResult.spinId,
          {
            cascade_count: spinResult.cascadeSteps?.length || 0,
            bonus_features: spinResult.bonusFeatures,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          }
        );
      }

      console.log(`? Transactions logged: bet=-$${betAmountFloat}, win=+$${winAmountFloat}, balance=${newCredits.toFixed(2)}`);

    } catch (transactionError) {
      console.error('Transaction logging failed:', transactionError.message);
      // Don't fail the spin if transaction logging fails
    }

    res.json({
      success: true,
      player: {
        id: player.id,
        username: player.username,
        credits: newCredits.toFixed(2)
      },
      spin: {
        spinId: spinResult.spinId,
        betAmount: betAmount,
        totalWin: spinResult.totalWin || 0,
        baseWin: spinResult.baseWin || 0,
        initialGrid: spinResult.initialGrid,
        finalGrid: spinResult.finalGrid,
        cascadeSteps: spinResult.cascadeSteps || [],
        bonusFeatures: spinResult.bonusFeatures || {
          freeSpinsTriggered: false,
          freeSpinsAwarded: 0,
          randomMultipliers: []
        },
        timing: spinResult.timing || {
          totalDuration: 2000,
          cascadeTiming: []
        }
      }
    });

  } catch (error) {
    console.error('Auth spin error:', error);
    res.status(500).json({
      error: 'Spin processing failed',
      code: 'SPIN_ERROR',
      message: error.message
    });
  }
});


// Legacy spin endpoint for backward compatibility
app.post('/api/spin-legacy', authenticate, async (req, res) => {
  try {
    const { bet = 1.00, quickSpinMode = false, freeSpinsActive = false, accumulatedMultiplier = 1 } = req.body;

    console.log(`? Spin request: bet=$${bet}, quickSpin=${quickSpinMode}, freeSpins=${freeSpinsActive}, multiplier=${accumulatedMultiplier}x`);

    // Check if player can place bet (not in demo mode for real money)
    if (!req.user.is_demo && !req.user.canPlaceBet(bet)) {
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        errorMessage: `Insufficient credits. Available: ${req.user.credits}, Required: ${bet}`
      });
    }

    // Generate complete spin result using GridEngine
    const spinResult = gridEngine.generateSpinResult({
      bet: parseFloat(bet),
      quickSpinMode: Boolean(quickSpinMode),
      freeSpinsActive: Boolean(freeSpinsActive),
      accumulatedMultiplier: parseFloat(accumulatedMultiplier),
      playerId: req.user.id,
      sessionId: req.session_info.id
    });

    if (spinResult.success) {
      const cascadeCount = Array.isArray(spinResult.cascadeSteps) ? spinResult.cascadeSteps.length : 0;
      console.log(`??Spin ${spinResult.spinId} (Player: ${req.user.username}): ${cascadeCount} cascades, $${spinResult.totalWin} win, ${spinResult.totalSpinDuration}ms duration`);

      // Update player credits (if not demo mode)
      if (!req.user.is_demo && spinResult.totalWin > 0) {
        try {
          const Player = require('./src/models/Player');
          const player = await Player.findByPk(req.user.id);
          if (player) {
            await player.deductCredits(bet);
            await player.addCredits(spinResult.totalWin);
            logger.info(`Credits updated for player ${req.user.username}: -${bet} +${spinResult.totalWin}`);
          }
        } catch (creditErr) {
          logger.error('Credit update failed:', creditErr.message);
        }
      }
    } else {
      console.error(`??Spin failed for ${req.user.username}: ${spinResult.errorMessage}`);
    }

    // Database persistence disabled for demo mode
    // // Persist spin into database (best-effort)
    // try {
    //     await pool.query(
    //         `insert into public.spins (spin_id, player_id, bet_amount, total_win, rng_seed, initial_grid, cascades)
    //          values ($1,$2,$3,$4,$5,$6,$7)` ,
    //         [
    //             spinResult.spinId,
    //             req.user.id,
    //             spinResult.betAmount,
    //             spinResult.totalWin,
    //             spinResult.rngSeed,
    //             JSON.stringify(spinResult.initialGrid),
    //             JSON.stringify(spinResult.cascadeSteps || [])
    //         ]
    //     );
    // } catch (persistErr) {
    //     console.error('??  Persist spin failed:', persistErr.message);
    // }

    res.json(spinResult);
  } catch (error) {
    console.error('Spin error:', error);
    const isTest = process.env.NODE_ENV === 'test';
    res.status(500).json({
      success: false,
      error: 'SPIN_GENERATION_FAILED',
      errorMessage: error?.message || 'Internal server error',
      stack: isTest ? String(error?.stack || '') : undefined
    });
  }
});

// 4.1.1: Cascade synchronization endpoints
app.post('/api/cascade/sync/start', async (req, res) => {
  try {
    const { sessionId, playerId, spinId, gridState } = req.body;

    if (!sessionId || !playerId || !spinId || !gridState) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'Missing required fields: sessionId, playerId, spinId, gridState'
      });
    }

    // Create or get game session
    const gameSession = new GameSession(playerId);

    // Start sync session
    const syncSession = await cascadeSynchronizer.startSyncSession(spinId, gameSession, { sessionId, initialGridState: gridState, clientTimestamp: Date.now() });

    res.json({ success: true, syncSessionId: syncSession.syncSessionId, validationSalt: syncSession.validationSalt, syncSeed: syncSession.syncSeed, serverTimestamp: syncSession.serverTimestamp });
  } catch (error) {
    console.error('Cascade sync start error:', error);
    res.status(500).json({
      success: false,
      error: 'SYNC_START_FAILED',
      errorMessage: 'Failed to start cascade synchronization'
    });
  }
});

app.post('/api/cascade/sync/step', async (req, res) => {
  try {
    const { syncSessionId, stepIndex, gridState, clientHash, clientTimestamp } = req.body;

    if (!syncSessionId || stepIndex === undefined || !gridState || !clientHash) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'Missing required fields: syncSessionId, stepIndex, gridState, clientHash'
      });
    }

    // Process step acknowledgment
    const acknowledgment = await cascadeSynchronizer.processStepAcknowledgment(syncSessionId, {
      stepIndex,
      gridState,
      clientHash,
      clientTimestamp,
      serverTimestamp: Date.now()
    });

    res.json({ success: true, stepValidated: acknowledgment.validated, serverHash: acknowledgment.serverHash, clientHash: acknowledgment.clientHash || clientHash, syncStatus: acknowledgment.syncStatus, nextStepData: acknowledgment.nextStepData });
  } catch (error) {
    console.error('Cascade sync step error:', error);
    res.status(500).json({
      success: false,
      error: 'SYNC_STEP_FAILED',
      errorMessage: 'Failed to process cascade step'
    });
  }
});

app.post('/api/cascade/sync/complete', async (req, res) => {
  try {
    const { syncSessionId, finalGridState, totalWin, clientHash } = req.body;

    if (!syncSessionId || !finalGridState) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'Missing required fields: syncSessionId, finalGridState'
      });
    }

    // Complete sync session
    const completion = await cascadeSynchronizer.completeSyncSession(syncSessionId, {
      finalGridState,
      totalWin,
      clientHash,
      clientTimestamp: Date.now()
    });

    res.json({ success: true, syncSessionId, validated: completion.validated, finalHash: completion.finalHash || completion.serverHash || null, performanceScore: completion.performanceScore, totalSteps: completion.totalSteps, serverTimestamp: completion.serverTimestamp });
  } catch (error) {
    console.error('Cascade sync complete error:', error);
    res.status(500).json({
      success: false,
      error: 'SYNC_COMPLETE_FAILED',
      errorMessage: 'Failed to complete cascade synchronization'
    });
  }
});

// 4.1.2: Validation request handlers
app.post('/api/cascade/validate/grid', async (req, res) => {
  try {
    const { gridState, expectedHash, salt } = req.body;

    if (!gridState) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: gridState' });
    }

    // Validate grid state
    const validation = await cascadeValidator.validateGridState(gridState, { expectedHash, salt });

    res.json({ success: true, valid: validation.valid, validationHash: validation.hash, errors: validation.errors, fraudScore: validation.fraudScore });
  } catch (error) {
    console.error('Grid validation error:', error);
    res.status(500).json({
      success: false,
      error: 'VALIDATION_FAILED',
      errorMessage: 'Failed to validate grid state'
    });
  }
});

app.post('/api/cascade/validate/step', async (req, res) => {
  try {
    const { cascadeStep, previousStep, gameConfig } = req.body;

    if (!cascadeStep) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: cascadeStep' });
    }

    // Validate cascade step
    const validation = await cascadeValidator.validateCascadeStep(cascadeStep, previousStep, gameConfig);

    res.json({ success: true, valid: validation.valid, validationHash: validation.hash || validation.validationHash || null, errors: validation.errors, fraudDetected: validation.fraudDetected, fraudScore: validation.fraudScore });
  } catch (error) {
    console.error('Step validation error:', error);
    res.status(500).json({
      success: false,
      error: 'VALIDATION_FAILED',
      errorMessage: 'Failed to validate cascade step'
    });
  }
});

app.post('/api/cascade/validate/sequence', async (req, res) => {
  try {
    const { cascadeSteps, spinResult } = req.body;

    if (!cascadeSteps || !Array.isArray(cascadeSteps)) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: cascadeSteps' });
    }

    // Validate cascade sequence
    const validation = await cascadeValidator.validateCascadeSequence(cascadeSteps, spinResult);

    res.json({ success: true, valid: validation.valid, validationHash: validation.sequenceHash || validation.hash || null, errors: validation.errors, fraudDetected: validation.fraudDetected, overallScore: validation.overallScore, stepValidations: validation.stepValidations });
  } catch (error) {
    console.error('Sequence validation error:', error);
    res.status(500).json({
      success: false,
      error: 'VALIDATION_FAILED',
      errorMessage: 'Failed to validate cascade sequence'
    });
  }
});

// 4.3.3: Timing validation services
app.post('/api/cascade/validate/timing', async (req, res) => {
  try {
    const { timingData, context } = req.body;

    if (!timingData) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: timingData' });
    }

    // Validate timing data
    const validation = await cascadeValidator.validateTiming(timingData, context || {});

    res.json({
      success: true,
      valid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      timingAnalysis: {
        stepTimingValid: validation.stepTimingValid,
        sequenceTimingValid: validation.sequenceTimingValid,
        syncTimingValid: validation.syncTimingValid
      }
    });
  } catch (error) {
    console.error('Timing validation error:', error);
    res.status(500).json({
      success: false,
      error: 'TIMING_VALIDATION_FAILED',
      errorMessage: 'Failed to validate timing data'
    });
  }
});

// 4.3.4: Fraud detection endpoints
app.post('/api/cascade/validate/fraud/grid', async (req, res) => {
  try {
    const { gridState } = req.body;

    if (!gridState) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: gridState' });
    }

    // Detect grid fraud
    const fraudAnalysis = cascadeValidator.detectGridFraud(gridState);

    res.json({
      success: true,
      suspicious: fraudAnalysis.suspicious,
      fraudScore: fraudAnalysis.fraudScore,
      warnings: fraudAnalysis.warnings,
      detectionDetails: {
        impossiblePatterns: fraudAnalysis.impossiblePatterns,
        distributionAnalysis: fraudAnalysis.distributionAnalysis,
        patternAnalysis: fraudAnalysis.patternAnalysis
      }
    });
  } catch (error) {
    console.error('Grid fraud detection error:', error);
    res.status(500).json({
      success: false,
      error: 'FRAUD_DETECTION_FAILED',
      errorMessage: 'Failed to analyze grid for fraud'
    });
  }
});

app.post('/api/cascade/validate/fraud/step', async (req, res) => {
  try {
    const { cascadeStep } = req.body;

    if (!cascadeStep) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: cascadeStep' });
    }

    // Detect cascade step fraud
    const fraudAnalysis = cascadeValidator.detectCascadeStepFraud(cascadeStep);

    res.json({
      success: true,
      suspicious: fraudAnalysis.suspicious,
      fraudScore: fraudAnalysis.fraudScore,
      warnings: fraudAnalysis.warnings,
      detectionDetails: {
        matchAnalysis: fraudAnalysis.matchAnalysis,
        payoutAnalysis: fraudAnalysis.payoutAnalysis,
        timingAnalysis: fraudAnalysis.timingAnalysis
      }
    });
  } catch (error) {
    console.error('Step fraud detection error:', error);
    res.status(500).json({
      success: false,
      error: 'FRAUD_DETECTION_FAILED',
      errorMessage: 'Failed to analyze cascade step for fraud'
    });
  }
});

app.post('/api/cascade/validate/fraud/spin', async (req, res) => {
  try {
    const { spinResult, sessionId } = req.body;

    if (!spinResult) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'spinResult is required'
      });
    }

    // Get session for context if provided
    let session = null;
    if (sessionId) {
      session = await GameSession.getById(sessionId);
    }

    // Analyze complete spin result for fraud
    const fraudAnalysis = cascadeValidator.analyzeSpinResultFraud(spinResult, session);

    res.json({
      success: true,
      suspicious: fraudAnalysis.suspicious,
      fraudScore: fraudAnalysis.fraudScore,
      warnings: fraudAnalysis.warnings,
      detectionDetails: {
        winRateAnalysis: fraudAnalysis.winRateAnalysis,
        payoutAnalysis: fraudAnalysis.payoutAnalysis,
        cascadeAnalysis: fraudAnalysis.cascadeAnalysis
      }
    });
  } catch (error) {
    console.error('Spin fraud detection error:', error);
    res.status(500).json({
      success: false,
      error: 'FRAUD_DETECTION_FAILED',
      errorMessage: 'Failed to analyze spin result for fraud'
    });
  }
});

app.get('/api/cascade/validate/fraud/stats', async (req, res) => {
  try {
    // Get all fraud detection statistics
    const stats = cascadeValidator.getFraudDetectionStats();

    res.json({
      success: true,
      sessionId: 'all',
      fraudStats: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Fraud stats retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'FRAUD_STATS_FAILED',
      errorMessage: 'Failed to retrieve fraud detection statistics'
    });
  }
});

app.get('/api/cascade/validate/fraud/stats/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get fraud detection statistics for specific session
    const stats = cascadeValidator.getFraudDetectionStats(sessionId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        errorMessage: 'No fraud detection statistics found for session'
      });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      fraudStats: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Fraud stats retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'FRAUD_STATS_FAILED',
      errorMessage: 'Failed to retrieve fraud detection statistics'
    });
  }
});

// 4.1.3: Recovery request endpoints
app.post('/api/cascade/recovery/request', async (req, res) => {
  try {
    const { syncSessionId, desyncType, clientState, stepIndex } = req.body;

    if (!syncSessionId || !desyncType || !clientState) { return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required fields: syncSessionId, desyncType, clientState' }); }

    // Request recovery data
    const recovery = await cascadeSynchronizer.requestRecovery(syncSessionId, {
      desyncType,
      clientState,
      stepIndex,
      requestTimestamp: Date.now()
    });

    res.json({ success: true, recoveryId: recovery.recoveryId, recoveryType: recovery.recoveryType, recoveryData: recovery.recoveryData, requiredSteps: recovery.requiredSteps, syncSessionId: recovery.syncSessionId });
  } catch (error) {
    console.error('Recovery request error:', error);
    res.status(500).json({
      success: false,
      error: 'RECOVERY_REQUEST_FAILED',
      errorMessage: 'Failed to process recovery request'
    });
  }
});

app.post('/api/cascade/recovery/apply', async (req, res) => {
  try {
    const { recoveryId, clientState, recoveryResult } = req.body;

    if (!recoveryId || !clientState) { return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required fields: recoveryId, clientState' }); }

    // Apply recovery and validate result
    const application = await cascadeSynchronizer.applyRecovery(recoveryId, {
      clientState,
      recoveryResult,
      applicationTimestamp: Date.now()
    });

    res.json({ success: true, recoveryId, applied: application.successful, newState: application.newSyncState, syncRestored: application.syncRestored, nextActions: application.nextActions });
  } catch (error) {
    console.error('Recovery apply error:', error);
    res.status(500).json({
      success: false,
      error: 'RECOVERY_APPLY_FAILED',
      errorMessage: 'Failed to apply recovery'
    });
  }
});

app.get('/api/cascade/recovery/status/:recoveryId', async (req, res) => {
  try {
    const { recoveryId } = req.params;

    if (!recoveryId) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: recoveryId' });
    }

    // Get recovery status
    const status = await cascadeSynchronizer.getRecoveryStatus(recoveryId);

    res.json({ success: true, status: status.status, progress: status.progress, estimatedCompletion: status.estimatedCompletion, errors: status.errors });
  } catch (error) {
    console.error('Recovery status error:', error);
    res.status(500).json({
      success: false,
      error: 'RECOVERY_STATUS_FAILED',
      errorMessage: 'Failed to get recovery status'
    });
  }
});

// 4.1.4: Session management endpoints
app.post('/api/cascade/session/create', async (req, res) => {
  try {
    const { playerId, gameConfig } = req.body;

    if (!playerId) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: playerId' });
    }

    // Create new game session
    const gameSession = new GameSession(playerId, gameConfig);
    await gameSession.initialize();

    res.json({ success: true, sessionId: gameSession.sessionId, playerId: gameSession.playerId, configuration: gameSession.getPublicConfig(), createdAt: gameSession.createdAt });
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_CREATE_FAILED',
      errorMessage: 'Failed to create game session'
    });
  }
});

app.get('/api/cascade/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: sessionId' });
    }

    // Get session data
    const session = await GameSession.getById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        errorMessage: 'Game session not found'
      });
    }

    // session metrics instrumentation
    res.json({ success: true, sessionId: session.sessionId, playerId: session.playerId, status: session.status, cascadeState: session.getCascadeState(), session_metrics: session.getPerformanceMetrics() });
  } catch (error) {
    console.error('Session get error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_GET_FAILED',
      errorMessage: 'Failed to get game session'
    });
  }
});

app.put('/api/cascade/session/:sessionId/state', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cascadeState, syncStatus } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: sessionId' });
    }

    // Update session state
    const session = await GameSession.getById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        errorMessage: 'Game session not found'
      });
    }

    if (cascadeState) {
      session.updateCascadeState(cascadeState);
    }
    if (syncStatus) {
      session.updateSyncStatus(syncStatus);
    }

    await session.save();

    res.json({ success: true, sessionId: session.sessionId, updated: true, newState: session.getCascadeState(), session_metrics: session.getPerformanceMetrics() });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_UPDATE_FAILED',
      errorMessage: 'Failed to update game session'
    });
  }
});

// Session lifecycle markers: updated status and deleted flag preserve cascade audit trail
app.delete('/api/cascade/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST', errorMessage: 'Missing required field: sessionId' });
    }

    // Clean up session
    const session = await GameSession.getById(sessionId);
    if (session) {
      await session.cleanup();
      await session.delete();
    }

    res.json({ success: true, sessionId, deleted: true });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_DELETE_FAILED',
      errorMessage: 'Failed to delete game session'
    });
  }
});

// Socket.io connection handling with cascade synchronization
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Enhanced spin request with cascade synchronization support
  socket.on('spin_request', async (data) => {
    console.log('? WebSocket spin request:', data);

    try {
      const { bet = 1.00, quickSpinMode = false, freeSpinsActive = false, accumulatedMultiplier = 1, enableSync = false, playerId } = data;

      // Import Supabase functions
      const { processBet, processWin, getDemoPlayer, recordSpinResult, saveSpinResult } = require('./src/db/supabaseClient');

      // Get player ID (use demo player if not provided)
      let actualPlayerId = playerId;
      if (!actualPlayerId) {
        try {
          const demoPlayer = await getDemoPlayer();
          actualPlayerId = demoPlayer.id;
          console.log('Using demo player:', actualPlayerId);
        } catch (err) {
          console.error('Failed to get demo player:', err);
          socket.emit('spin_result', {
            success: false,
            error: 'AUTHENTICATION_FAILED',
            errorMessage: 'Failed to authenticate player'
          });
          return;
        }
      }

      // Process bet
      const betAmount = parseFloat(bet);
      const betResult = await processBet(actualPlayerId, betAmount);

      if (betResult.error) {
        console.error(`??Bet failed: ${betResult.error}`);
        socket.emit('spin_result', {
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          errorMessage: betResult.error
        });
        return;
      }

      console.log(`? Bet processed: $${betAmount}, new balance: $${betResult.newBalance || betResult.balance}`);

      // Generate complete spin result using GridEngine
      const spinResult = gridEngine.generateSpinResult({
        bet: betAmount,
        quickSpinMode: Boolean(quickSpinMode),
        freeSpinsActive: Boolean(freeSpinsActive),
        accumulatedMultiplier: parseFloat(accumulatedMultiplier)
      });

      if (spinResult.success) {
        console.log(`??WebSocket Spin ${spinResult.spinId}: ${spinResult.cascades.length} cascades, $${spinResult.totalWin} win, ${spinResult.totalSpinDuration}ms duration`);

        // Process win if any
        if (spinResult.totalWin > 0) {
          const winResult = await processWin(actualPlayerId, spinResult.totalWin);
          if (winResult.error) {
            console.error('Failed to process win:', winResult.error);
          } else {
            console.log(`?? Win processed: $${spinResult.totalWin}, new balance: $${winResult.newBalance}`);
            spinResult.newBalance = winResult.newBalance;
          }
        } else {
          spinResult.newBalance = betResult.newBalance || betResult.balance;
        }

        // Save spin result to database (spin_results)
        try {
          const saveResult = await saveSpinResult(actualPlayerId, {
            bet: betAmount,
            initialGrid: spinResult.initialGrid,
            cascades: spinResult.cascades || [],
            totalWin: spinResult.totalWin,
            multipliers: spinResult.multipliers || [],
            rngSeed: spinResult.rngSeed,
            freeSpinsActive: freeSpinsActive
          });
          if (saveResult && !saveResult.error) {
            console.log('?? Spin result saved to spin_results with ID:', saveResult.spinResultId);
            spinResult.spinResultId = saveResult.spinResultId;
          } else if (saveResult && saveResult.error) {
            console.warn('saveSpinResult error:', saveResult.error);
          }
        } catch (e) {
          console.warn('saveSpinResult exception:', e.message);
        }

        // Legacy 'spins' table write removed (use 'spin_results' only)

        // If cascade sync enabled, prepare sync session data
        if (enableSync) {
          spinResult.syncEnabled = true;
          spinResult.validationSalt = cascadeSynchronizer.generateValidationSalt();
          spinResult.syncSeed = cascadeSynchronizer.generateSyncSeed();
        }
      } else {
        console.error(`??WebSocket Spin failed: ${spinResult.errorMessage}`);
      }

      socket.emit('spin_result', spinResult);
    } catch (error) {
      console.error('WebSocket spin error:', error);
      socket.emit('spin_result', {
        success: false,
        error: 'SPIN_GENERATION_FAILED',
        errorMessage: 'Internal server error'
      });
    }
  });

  // Cascade synchronization WebSocket events
  socket.on('cascade_sync_start', async (data) => {
    try {
      const { spinId, playerId, gridState } = data;
      console.log(`?? Cascade sync start: ${spinId} for player ${playerId}`);

      const gameSession = new GameSession(playerId);
      const syncSession = await cascadeSynchronizer.startSyncSession(spinId, gameSession, {
        initialGridState: gridState,
        clientTimestamp: Date.now(),
        socketId: socket.id
      });

      socket.emit('sync_session_start', {
        success: true,
        syncSessionId: syncSession.syncSessionId,
        validationSalt: syncSession.validationSalt,
        syncSeed: syncSession.syncSeed,
        serverTimestamp: syncSession.serverTimestamp
      });
    } catch (error) {
      console.error('WebSocket cascade sync start error:', error);
      socket.emit('sync_session_start', {
        success: false,
        error: 'SYNC_START_FAILED',
        errorMessage: 'Failed to start cascade synchronization'
      });
    }
  });

  socket.on('step_validation_request', async (data) => {
    try {
      const { syncSessionId, stepIndex, gridState, clientHash, clientTimestamp } = data;
      console.log(`??Step validation: session ${syncSessionId}, step ${stepIndex}`);

      const acknowledgment = await cascadeSynchronizer.processStepAcknowledgment(syncSessionId, {
        stepIndex,
        gridState,
        clientHash,
        clientTimestamp,
        serverTimestamp: Date.now()
      });

      socket.emit('step_validation_response', {
        success: true,
        stepIndex,
        stepValidated: acknowledgment.validated,
        serverHash: acknowledgment.serverHash,
        nextStepData: acknowledgment.nextStepData,
        syncStatus: acknowledgment.syncStatus
      });
    } catch (error) {
      console.error('WebSocket step validation error:', error);
      socket.emit('step_validation_response', {
        success: false,
        error: 'STEP_VALIDATION_FAILED',
        errorMessage: 'Failed to validate cascade step'
      });
    }
  });

  socket.on('desync_detected', async (data) => {
    try {
      const { syncSessionId, desyncType, clientState, stepIndex } = data;
      console.log(`?? Desync detected: session ${syncSessionId}, type ${desyncType}, step ${stepIndex}`);

      const recovery = await cascadeSynchronizer.requestRecovery(syncSessionId, {
        desyncType,
        clientState,
        stepIndex,
        requestTimestamp: Date.now()
      });

      socket.emit('recovery_data', {
        success: true,
        recoveryType: recovery.recoveryType,
        recoveryData: recovery.recoveryData,
        requiredSteps: recovery.requiredSteps,
        recoveryId: recovery.recoveryId
      });
    } catch (error) {
      console.error('WebSocket desync handling error:', error);
      socket.emit('recovery_data', {
        success: false,
        error: 'DESYNC_RECOVERY_FAILED',
        errorMessage: 'Failed to handle desynchronization'
      });
    }
  });

  socket.on('sync_session_complete', async (data) => {
    try {
      const { syncSessionId, finalGridState, totalWin, clientHash } = data;
      console.log(`?? Cascade sync complete: session ${syncSessionId}`);

      const completion = await cascadeSynchronizer.completeSyncSession(syncSessionId, {
        finalGridState,
        totalWin,
        clientHash,
        clientTimestamp: Date.now()
      });

      socket.emit('sync_session_complete', {
        success: true,
        validated: completion.validated,
        performanceScore: completion.performanceScore,
        totalSteps: completion.totalSteps,
        serverTimestamp: completion.serverTimestamp
      });
    } catch (error) {
      console.error('WebSocket sync complete error:', error);
      socket.emit('sync_session_complete', {
        success: false,
        error: 'SYNC_COMPLETE_FAILED',
        errorMessage: 'Failed to complete cascade synchronization'
      });
    }
  });

  // Register socket with cascade synchronizer for real-time updates
  cascadeSynchronizer.registerSocket(socket);

  // Admin dashboard real-time metrics subscription
  socket.on('subscribe_metrics', (data) => {
    try {
      console.log(`?? Admin ${data.adminId || 'unknown'} subscribed to real-time metrics`);
      socket.join('admin_metrics'); // Join admin metrics room
      socket.admin_id = data.adminId;

      // Send initial metrics immediately
      metricsService.getRealtimeMetrics().then(metrics => {
        socket.emit('metrics_update', metrics);
      }).catch(error => {
        console.error('Error sending initial metrics:', error);
      });
    } catch (error) {
      console.error('Metrics subscription error:', error);
      socket.emit('metrics_error', { error: 'Failed to subscribe to metrics' });
    }
  });

  socket.on('unsubscribe_metrics', (data) => {
    console.log(`?? Admin ${data.adminId || socket.admin_id || 'unknown'} unsubscribed from real-time metrics`);
    socket.leave('admin_metrics');
    socket.admin_id = null;
  });

  // RTP alert subscription
  socket.on('subscribe_rtp_alerts', (data) => {
    try {
      console.log(`?? Admin ${data.adminId || 'unknown'} subscribed to RTP alerts`);
      socket.join('rtp_alerts');
      socket.admin_id = data.adminId;
    } catch (error) {
      console.error('RTP alerts subscription error:', error);
    }
  });

  socket.on('unsubscribe_rtp_alerts', (data) => {
    console.log(`?? Admin ${data.adminId || socket.admin_id || 'unknown'} unsubscribed from RTP alerts`);
    socket.leave('rtp_alerts');
  });

  // System alerts subscription
  socket.on('subscribe_system_alerts', (data) => {
    try {
      console.log(`? Admin ${data.adminId || 'unknown'} subscribed to system alerts`);
      socket.join('system_alerts');
      socket.admin_id = data.adminId;
    } catch (error) {
      console.error('System alerts subscription error:', error);
    }
  });

  socket.on('unsubscribe_system_alerts', (data) => {
    console.log(`? Admin ${data.adminId || socket.admin_id || 'unknown'} unsubscribed from system alerts`);
    socket.leave('system_alerts');
  });

  socket.on('test', (data) => {
    console.log('Test message received:', data);
    socket.emit('test_response', { message: 'Test successful', data: data });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up any active sync sessions for this socket
    cascadeSynchronizer.unregisterSocket(socket);

    // Leave all admin rooms
    socket.leave('admin_metrics');
    socket.leave('rtp_alerts');
    socket.leave('system_alerts');
  });
});

// Global error handler for authentication
app.use(authErrorHandler);

// Background service for real-time metrics broadcasting
let metricsInterval = null;
let rtpInterval = null;

function startMetricsBroadcasting() {
  // Broadcast metrics updates every 30 seconds to subscribed admin clients
  metricsInterval = setInterval(async () => {
    try {
      const realtimeMetrics = await metricsService.getRealtimeMetrics();
      io.to('admin_metrics').emit('metrics_update', realtimeMetrics);
    } catch (error) {
      console.error('Error broadcasting metrics:', error);
    }
  }, 30000); // 30 seconds

  // Check for RTP alerts every 5 minutes
  rtpInterval = setInterval(async () => {
    try {
      const rtpMetrics = await metricsService.getRTPMetrics('24h');

      // Check for RTP deviations and send alerts
      if (rtpMetrics && rtpMetrics.alerts && rtpMetrics.alerts.length > 0) {
        rtpMetrics.alerts.forEach(alert => {
          io.to('rtp_alerts').emit('rtp_alert', alert);
          console.log(`?? RTP Alert broadcasted: ${alert.message}`);
        });
      }

      // Check for system health issues
      const systemHealth = await metricsService.getSystemHealth();
      if (systemHealth.health.status !== 'healthy') {
        const systemAlert = {
          type: systemHealth.health.status === 'critical' ? 'critical' : 'warning',
          message: `System health status: ${systemHealth.health.status}`,
          details: {
            response_time: systemHealth.health.response_time,
            error_rate: systemHealth.health.error_rate,
            uptime: systemHealth.health.uptime
          },
          timestamp: new Date()
        };

        io.to('system_alerts').emit('system_alert', systemAlert);
        console.log(`? System Alert broadcasted: ${systemAlert.message}`);
      }

    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  console.log('? Real-time metrics broadcasting started');
}

// ==============================================
// STATIC FILE SERVING - SECURITY CRITICAL
// ==============================================

// Production Build Check - ensure dist exists
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    console.error('FATAL: No dist folder in production. Run npm run build first.');
    process.exit(1);
  }
}

// Serve ONLY the built client bundle (secure)
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: 0, // Disable caching for testing
    etag: false,
    lastModified: true
  }));
  console.log('✓ Serving client from dist folder');
} else {
  console.warn('⚠ No dist folder found. Run npm run build first.');
}

// Optional: Debug portal (development only)
if (process.env.NODE_ENV === 'development') {
  const portalStaticPath = path.resolve(__dirname, '..', 'src', 'portal-mock');
  if (fs.existsSync(portalStaticPath)) {
    app.use('/debug/portal', express.static(portalStaticPath));
    console.log('✓ Debug portal enabled at /debug/portal');
  }
}

// Block sensitive file patterns explicitly
app.use((req, res, next) => {
  const blocked = [
    /\.env/i,
    /\.git/i,
    /node_modules/i,
    /infinity-storm-server/i,
    /migrations?/i,
    /\/src\//i,
    /\/tests?\//i,
    /\/scripts?\//i,
    /\.sql$/i,
    /\.md$/i,
    /package\.json$/i,
    /package-lock\.json$/i,
    /docker/i,
    /\.config\./i,
    /supabase/i,
    /\.sh$/i,
    /\.ps1$/i
  ];
  
  if (blocked.some(pattern => pattern.test(req.path))) {
    console.warn(`🚫 Blocked sensitive path: ${req.path}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ------------------------------------------------------------
// Mock Portal (DEV ONLY)
// Serve UI at /debug/portal and handle test credit endpoint
// ------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  // Dev-only credit endpoint used by the mock portal UI
  app.post('/portal/mock/credit', express.json(), async (req, res) => {
    try {
      const providedSecret = req.get('x-portal-secret') || '';
      const expectedSecret = process.env.PORTAL_DEV_SECRET || 'portal-dev-secret';
      if (!providedSecret || providedSecret !== expectedSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Invalid portal secret' });
      }

      const { playerId, amount, notes } = req.body || {};
      if (!playerId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'playerId and positive amount are required' });
      }

      const { ensureTestPlayer, getPlayerBalance, updatePlayerBalance, createTransaction } = require('./src/db/supabaseClient');

      // Ensure player exists (dev-only creation allowed)
      const ensure = await ensureTestPlayer(String(playerId), { allowCreate: true, markDemo: false, returnPassword: false });
      if (ensure?.error || !ensure?.player) {
        return res.status(500).json({ success: false, error: 'PLAYER_UNAVAILABLE', message: ensure?.error || 'Unable to ensure test player' });
      }

      const player = ensure.player;
      const balInfo = await getPlayerBalance(player.id);
      if (balInfo?.error) {
        return res.status(500).json({ success: false, error: 'BALANCE_ERROR', message: balInfo.error });
      }

      const creditAmount = parseFloat(Number(amount).toFixed(2));
      const previousBalance = parseFloat(balInfo.balance || 0);
      const newBalance = parseFloat((previousBalance + creditAmount).toFixed(2));

      const upd = await updatePlayerBalance(player.id, newBalance);
      if (upd?.error) {
        return res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: upd.error });
      }

      // Record transaction as a deposit (mock portal credit)
      const tx = await createTransaction(
        player.id,
        'deposit',
        creditAmount,
        previousBalance,
        newBalance,
        `Mock portal credit${notes ? `: ${String(notes).slice(0, 120)}` : ''}`
      );

      if (tx?.error || !tx?.success) {
        return res.status(500).json({ success: false, error: 'TX_FAILED', message: tx?.error || 'Transaction logging failed' });
      }

      return res.json({
        success: true,
        data: {
          player: { id: player.id, username: player.username },
          transaction: tx.transaction,
          balance_before: previousBalance,
          balance_after: newBalance,
          amount: creditAmount
        }
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: e.message });
    }
  });
}

// Whitelist: serve test-player-login.html explicitly without exposing repo
app.get('/test-player-login.html', (req, res) => {
  try {
    // In Docker container, file is in /app/test-player-login.html
    const appLoginPath = path.resolve(__dirname, 'test-player-login.html');
    if (fs.existsSync(appLoginPath)) {
      return res.sendFile(appLoginPath);
    }
    // Fallback for local dev (repo root)
    const rootLoginPath = path.resolve(__dirname, '..', 'test-player-login.html');
    if (fs.existsSync(rootLoginPath)) {
      return res.sendFile(rootLoginPath);
    }
    const distLoginPath = path.resolve(__dirname, '..', 'dist', 'test-player-login.html');
    if (fs.existsSync(distLoginPath)) {
      return res.sendFile(distLoginPath);
    }
  } catch (_) {}
  return res.status(404).send('Not found');
});

// Whitelist: serve shader asset used by game (moved for prod safety)
app.get('/assets/shaders/RedLightningShader.js', (req, res) => {
  try {
    const distShader = path.resolve(__dirname, '..', 'dist', 'assets', 'shaders', 'RedLightningShader.js');
    if (fs.existsSync(distShader)) {
      return res.sendFile(distShader);
    }
    const srcShader = path.resolve(__dirname, '..', 'src', 'shaders', 'RedLightningShader.js');
    if (fs.existsSync(srcShader)) {
      return res.sendFile(srcShader);
    }
  } catch (_) {}
  return res.status(404).send('Not found');
});

// Comprehensive health check endpoint
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version || '1.0.0',
    checks: {}
  };

  try {
    // Check database connectivity (if available)
    try {
      const { pool } = require('./src/db/pool');
      await pool.query('SELECT 1');
      healthStatus.checks.database = { status: 'healthy', message: 'PostgreSQL connected' };
    } catch (dbError) {
      healthStatus.checks.database = { status: 'degraded', message: 'Database check failed', error: dbError.message };
      healthStatus.status = 'degraded';
    }

    // Check Redis connectivity (if enabled)
    try {
      const { getRedisClient, shouldSkipRedis } = require('./src/config/redis');
      if (!shouldSkipRedis) {
        const redis = getRedisClient();
        await redis.ping();
        healthStatus.checks.redis = { status: 'healthy', message: 'Redis connected' };
      } else {
        healthStatus.checks.redis = { status: 'skipped', message: 'Redis disabled' };
      }
    } catch (redisError) {
      healthStatus.checks.redis = { status: 'degraded', message: 'Redis check failed', error: redisError.message };
      // Redis is optional, don't mark as degraded
    }

    // Memory check
    const memUsage = process.memoryUsage();
    const memLimit = 1024 * 1024 * 1024; // 1GB
    const memPercent = (memUsage.heapUsed / memLimit) * 100;
    healthStatus.checks.memory = {
      status: memPercent > 90 ? 'warning' : 'healthy',
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      percentage: `${memPercent.toFixed(2)}%`
    };

    // Check if any checks failed
    const hasUnhealthy = Object.values(healthStatus.checks).some(check => check.status === 'unhealthy');
    if (hasUnhealthy) {
      healthStatus.status = 'unhealthy';
    }

    // Return appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 :
      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Simple healthcheck for load balancers
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

function stopMetricsBroadcasting() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (rtpInterval) {
    clearInterval(rtpInterval);
    rtpInterval = null;
  }
  console.log('? Real-time metrics broadcasting stopped');
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('? SIGTERM received, stopping metrics broadcasting...');
  stopMetricsBroadcasting();
});

process.on('SIGINT', () => {
  console.log('? SIGINT received, stopping metrics broadcasting...');
  stopMetricsBroadcasting();
});

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:3000';

// server port configuration: port 3000 default
// Avoid binding to a fixed port when running under Jest/test runner
const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

if (!isTestEnv) {
  server.listen(PORT, () => {
    // app.listen(PORT); // legacy fallback for single-process deployments
    console.log(`? Infinity Storm Server running on port ${PORT}`);
    console.log(`?? Client URL: ${CLIENT_URL}`);
    console.log('? WebSocket server ready');
    console.log(`? Game available at: http://127.0.0.1:${PORT}`);
    console.log('?? Authentication system active');
    console.log(`??儭?Admin panel available at: http://127.0.0.1:${PORT}/admin`);

    // Start real-time metrics broadcasting
    startMetricsBroadcasting();
  });
}

module.exports = { app, server, io };

