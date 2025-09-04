const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
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

// Authentication system
const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const walletRoutes = require('./src/routes/wallet');
const adminRoutes = require('./src/routes/admin');
const { authenticate, optionalAuth, authErrorHandler } = require('./src/middleware/auth');
// const { initializeRedis, testConnection } = require('./src/config/redis');
const { logger } = require('./src/utils/logger');
const metricsService = require('./src/services/metricsService');

// Load environment variables
dotenv.config();

// Initialize game engine and cascade services
const gridEngine = new GridEngine();
const cascadeSynchronizer = new CascadeSynchronizer();
const cascadeValidator = new CascadeValidator();

const app = express();
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Global OPTIONS handler to satisfy preflight in dev
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

// Explicit preflight handler for wallet balance in dev/playtest
app.options('/api/wallet/balance', cors({
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin']
}));

// Disable caching in development so updated assets appear immediately
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for Phaser
}));
app.use(compression());
app.use(morgan('combined'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set view engine for admin panel
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Redis disabled for demo mode
console.log('⚠️  Redis disabled - using fallback authentication');

// // Initialize Redis connection
// (async () => {
//     try {
//         initializeRedis();
//         const connected = await testConnection();
//         if (connected) {
//             console.log('✅ Redis connection established for session management');
//         } else {
//             console.warn('⚠️  Redis connection failed - authentication will use fallback');
//         }
//     } catch (error) {
//         console.error('Redis initialization error:', error);
//     }
// })();

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

// Authentication routes
app.use('/api/auth', authRoutes);

// Wallet API routes (temporarily disabled due to Redis dependency)
// app.use('/api/wallet', walletRoutes);

// Demo balance endpoint (no auth required)
app.get('/api/wallet/balance', async (req, res) => {
  // Return demo balance for non-authenticated users
  // Real users would need proper authentication endpoints
  res.json({
    success: true,
    data: {
      balance: 5000.00,
      currency: 'USD'
    },
    message: 'Demo balance'
  });
});

// Test Supabase connection endpoint (no auth required)
app.get('/api/test-supabase', async (req, res) => {
  try {
    const { getPlayerBalance, getDemoPlayer } = require('./src/db/supabaseClient');

    // Test getting demo player
    const demoPlayer = await getDemoPlayer();
    console.log('Demo player:', demoPlayer);

    // Test getting balance
    const balanceResult = await getPlayerBalance(demoPlayer.id);
    console.log('Balance result:', balanceResult);

    res.json({
      success: true,
      message: 'Supabase connection test successful',
      data: {
        demoPlayer,
        balanceResult
      }
    });
  } catch (error) {
    console.error('Supabase test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test wallet balance endpoint (no auth required) - bypass authentication for testing
app.get('/api/test-wallet-balance', async (req, res) => {
  try {
    const { getPlayerBalance, getDemoPlayer } = require('./src/db/supabaseClient');

    // Get demo player for testing
    const demoPlayer = await getDemoPlayer();
    const balanceResult = await getPlayerBalance(demoPlayer.id);

    if (balanceResult.error) {
      return res.status(400).json({
        success: false,
        error: balanceResult.error
      });
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
    console.error('Wallet balance test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Transaction History Endpoints for Regulatory Compliance (defined before API routes to avoid middleware conflicts)

// Get player transaction history
app.get('/api/wallet/transactions', async (req, res) => {
  console.log('🔍 Transaction history endpoint reached');
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

// Serve static files from the parent directory (game client)
app.use(express.static(path.join(__dirname, '..')));

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

    console.log(`✅ Portal session validated for player ${player.username}`);

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

    console.log(`🎮 Portal session created for player ${decoded.username}`);

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

    console.log(`🎰 Auth Spin: Player ${player.username} bet $${betAmount}, won $${spinResult.totalWin}`);

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

      console.log(`💰 Transactions logged: bet=-$${betAmountFloat}, win=+$${winAmountFloat}, balance=${newCredits.toFixed(2)}`);

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

    console.log(`🎰 Spin request: bet=$${bet}, quickSpin=${quickSpinMode}, freeSpins=${freeSpinsActive}, multiplier=${accumulatedMultiplier}x`);

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
      console.log(`✅ Spin ${spinResult.spinId} (Player: ${req.user.username}): ${cascadeCount} cascades, $${spinResult.totalWin} win, ${spinResult.totalSpinDuration}ms duration`);

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
      console.error(`❌ Spin failed for ${req.user.username}: ${spinResult.errorMessage}`);
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
    //     console.error('⚠️  Persist spin failed:', persistErr.message);
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
    const { spinId, playerId, gridState } = req.body;

    if (!spinId || !playerId || !gridState) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'spinId, playerId, and gridState are required'
      });
    }

    // Create or get game session
    const gameSession = new GameSession(playerId);

    // Start sync session
    const syncSession = await cascadeSynchronizer.startSyncSession(spinId, gameSession, {
      initialGridState: gridState,
      clientTimestamp: Date.now()
    });

    res.json({
      success: true,
      syncSessionId: syncSession.syncSessionId,
      validationSalt: syncSession.validationSalt,
      syncSeed: syncSession.syncSeed,
      serverTimestamp: syncSession.serverTimestamp
    });
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

    if (!syncSessionId || stepIndex === undefined || !gridState) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'syncSessionId, stepIndex, and gridState are required'
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

    res.json({
      success: true,
      stepValidated: acknowledgment.validated,
      serverHash: acknowledgment.serverHash,
      nextStepData: acknowledgment.nextStepData,
      syncStatus: acknowledgment.syncStatus
    });
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
        errorMessage: 'syncSessionId and finalGridState are required'
      });
    }

    // Complete sync session
    const completion = await cascadeSynchronizer.completeSyncSession(syncSessionId, {
      finalGridState,
      totalWin,
      clientHash,
      clientTimestamp: Date.now()
    });

    res.json({
      success: true,
      validated: completion.validated,
      performanceScore: completion.performanceScore,
      totalSteps: completion.totalSteps,
      serverTimestamp: completion.serverTimestamp
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'gridState is required'
      });
    }

    // Validate grid state
    const validation = await cascadeValidator.validateGridState(gridState, { expectedHash, salt });

    res.json({
      success: true,
      valid: validation.valid,
      generatedHash: validation.hash,
      errors: validation.errors,
      fraudScore: validation.fraudScore
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'cascadeStep is required'
      });
    }

    // Validate cascade step
    const validation = await cascadeValidator.validateCascadeStep(cascadeStep, previousStep, gameConfig);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      fraudDetected: validation.fraudDetected,
      fraudScore: validation.fraudScore
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'cascadeSteps array is required'
      });
    }

    // Validate cascade sequence
    const validation = await cascadeValidator.validateCascadeSequence(cascadeSteps, spinResult);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      fraudDetected: validation.fraudDetected,
      overallScore: validation.overallScore,
      stepValidations: validation.stepValidations
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'timingData is required'
      });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'gridState is required'
      });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'cascadeStep is required'
      });
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

    if (!syncSessionId || !desyncType || !clientState) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'syncSessionId, desyncType, and clientState are required'
      });
    }

    // Request recovery data
    const recovery = await cascadeSynchronizer.requestRecovery(syncSessionId, {
      desyncType,
      clientState,
      stepIndex,
      requestTimestamp: Date.now()
    });

    res.json({
      success: true,
      recoveryType: recovery.recoveryType,
      recoveryData: recovery.recoveryData,
      requiredSteps: recovery.requiredSteps,
      recoveryId: recovery.recoveryId
    });
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

    if (!recoveryId || !clientState) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'recoveryId and clientState are required'
      });
    }

    // Apply recovery and validate result
    const application = await cascadeSynchronizer.applyRecovery(recoveryId, {
      clientState,
      recoveryResult,
      applicationTimestamp: Date.now()
    });

    res.json({
      success: true,
      recoverySuccessful: application.successful,
      syncRestored: application.syncRestored,
      newSyncState: application.newSyncState,
      nextActions: application.nextActions
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'recoveryId is required'
      });
    }

    // Get recovery status
    const status = await cascadeSynchronizer.getRecoveryStatus(recoveryId);

    res.json({
      success: true,
      status: status.status,
      progress: status.progress,
      estimatedCompletion: status.estimatedCompletion,
      errors: status.errors
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'playerId is required'
      });
    }

    // Create new game session
    const gameSession = new GameSession(playerId, gameConfig);
    await gameSession.initialize();

    res.json({
      success: true,
      sessionId: gameSession.sessionId,
      playerId: gameSession.playerId,
      createdAt: gameSession.createdAt,
      config: gameSession.getPublicConfig()
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'sessionId is required'
      });
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

    res.json({
      success: true,
      sessionId: session.sessionId,
      playerId: session.playerId,
      status: session.status,
      cascadeState: session.getCascadeState(),
      performance: session.getPerformanceMetrics()
    });
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
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'sessionId is required'
      });
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

    res.json({
      success: true,
      sessionId: session.sessionId,
      updated: true,
      newState: session.getCascadeState()
    });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_UPDATE_FAILED',
      errorMessage: 'Failed to update game session'
    });
  }
});

app.delete('/api/cascade/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        errorMessage: 'sessionId is required'
      });
    }

    // Clean up session
    const session = await GameSession.getById(sessionId);
    if (session) {
      await session.cleanup();
      await session.delete();
    }

    res.json({
      success: true,
      sessionId: sessionId,
      deleted: true
    });
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
    console.log('🎰 WebSocket spin request:', data);

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
        console.error(`❌ Bet failed: ${betResult.error}`);
        socket.emit('spin_result', {
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          errorMessage: betResult.error
        });
        return;
      }

      console.log(`💰 Bet processed: $${betAmount}, new balance: $${betResult.newBalance || betResult.balance}`);

      // Generate complete spin result using GridEngine
      const spinResult = gridEngine.generateSpinResult({
        bet: betAmount,
        quickSpinMode: Boolean(quickSpinMode),
        freeSpinsActive: Boolean(freeSpinsActive),
        accumulatedMultiplier: parseFloat(accumulatedMultiplier)
      });

      if (spinResult.success) {
        console.log(`✅ WebSocket Spin ${spinResult.spinId}: ${spinResult.cascades.length} cascades, $${spinResult.totalWin} win, ${spinResult.totalSpinDuration}ms duration`);

        // Process win if any
        if (spinResult.totalWin > 0) {
          const winResult = await processWin(actualPlayerId, spinResult.totalWin);
          if (winResult.error) {
            console.error('Failed to process win:', winResult.error);
          } else {
            console.log(`🎉 Win processed: $${spinResult.totalWin}, new balance: $${winResult.newBalance}`);
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
            console.log('📊 Spin result saved to spin_results with ID:', saveResult.spinResultId);
            spinResult.spinResultId = saveResult.spinResultId;
          } else if (saveResult && saveResult.error) {
            console.warn('saveSpinResult error:', saveResult.error);
          }
        } catch (e) {
          console.warn('saveSpinResult exception:', e.message);
        }

        // Also save to spins table using existing function
        const recordResult = await recordSpinResult({
          spinId: spinResult.spinId,
          playerId: actualPlayerId,
          betAmount: betAmount,
          totalWin: spinResult.totalWin,
          rngSeed: spinResult.rngSeed,
          initialGrid: spinResult.initialGrid,
          cascades: spinResult.cascades || []
        });

        if (recordResult.error) {
          console.error('Failed to record spin:', recordResult.error);
        } else {
          console.log('📝 Spin recorded to spins table');
        }

        // If cascade sync enabled, prepare sync session data
        if (enableSync) {
          spinResult.syncEnabled = true;
          spinResult.validationSalt = cascadeSynchronizer.generateValidationSalt();
          spinResult.syncSeed = cascadeSynchronizer.generateSyncSeed();
        }
      } else {
        console.error(`❌ WebSocket Spin failed: ${spinResult.errorMessage}`);
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
      console.log(`🔄 Cascade sync start: ${spinId} for player ${playerId}`);

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
      console.log(`✅ Step validation: session ${syncSessionId}, step ${stepIndex}`);

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
      console.log(`⚠️ Desync detected: session ${syncSessionId}, type ${desyncType}, step ${stepIndex}`);

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
      console.log(`🏁 Cascade sync complete: session ${syncSessionId}`);

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
      console.log(`📊 Admin ${data.adminId || 'unknown'} subscribed to real-time metrics`);
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
    console.log(`📊 Admin ${data.adminId || socket.admin_id || 'unknown'} unsubscribed from real-time metrics`);
    socket.leave('admin_metrics');
    socket.admin_id = null;
  });

  // RTP alert subscription
  socket.on('subscribe_rtp_alerts', (data) => {
    try {
      console.log(`⚠️ Admin ${data.adminId || 'unknown'} subscribed to RTP alerts`);
      socket.join('rtp_alerts');
      socket.admin_id = data.adminId;
    } catch (error) {
      console.error('RTP alerts subscription error:', error);
    }
  });

  socket.on('unsubscribe_rtp_alerts', (data) => {
    console.log(`⚠️ Admin ${data.adminId || socket.admin_id || 'unknown'} unsubscribed from RTP alerts`);
    socket.leave('rtp_alerts');
  });

  // System alerts subscription
  socket.on('subscribe_system_alerts', (data) => {
    try {
      console.log(`🚨 Admin ${data.adminId || 'unknown'} subscribed to system alerts`);
      socket.join('system_alerts');
      socket.admin_id = data.adminId;
    } catch (error) {
      console.error('System alerts subscription error:', error);
    }
  });

  socket.on('unsubscribe_system_alerts', (data) => {
    console.log(`🚨 Admin ${data.adminId || socket.admin_id || 'unknown'} unsubscribed from system alerts`);
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
          console.log(`⚠️ RTP Alert broadcasted: ${alert.message}`);
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
        console.log(`🚨 System Alert broadcasted: ${systemAlert.message}`);
      }

    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  console.log('📡 Real-time metrics broadcasting started');
}

function stopMetricsBroadcasting() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (rtpInterval) {
    clearInterval(rtpInterval);
    rtpInterval = null;
  }
  console.log('📡 Real-time metrics broadcasting stopped');
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, stopping metrics broadcasting...');
  stopMetricsBroadcasting();
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, stopping metrics broadcasting...');
  stopMetricsBroadcasting();
});

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Avoid binding to a fixed port when running under Jest/test runner
const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

if (!isTestEnv) {
  server.listen(PORT, () => {
    console.log(`🎰 Infinity Storm Server running on port ${PORT}`);
    console.log(`🌐 Client URL: ${CLIENT_URL}`);
    console.log('📡 WebSocket server ready');
    console.log(`🎮 Game available at: http://localhost:${PORT}`);
    console.log('🔐 Authentication system active');
    console.log(`🏛️ Admin panel available at: http://localhost:${PORT}/admin`);

    // Start real-time metrics broadcasting
    startMetricsBroadcasting();
  });
}

module.exports = { app, server, io };
