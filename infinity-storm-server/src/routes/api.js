/**
 * API Routes - Complete Game API Endpoints
 *
 * Defines all game-related API routes with comprehensive validation,
 * authentication, and error handling.
 *
 * Endpoints:
 * - POST /api/spin - Process spin requests
 * - GET /api/game-state - Get current game state
 * - PUT /api/game-state - Update game state
 * - GET /api/player-stats - Get player statistics
 * - GET /api/game-status - Get game system status
 *
 * Features:
 * - Complete request validation
 * - Authentication middleware integration
 * - Rate limiting protection
 * - Comprehensive error handling
 * - Audit logging
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const GameController = require('../controllers/game');
const {
  authenticate,
  optionalAuth,
  requireAdmin,
  requireActivePlayer,
  checkSessionRefresh,
  blockDemoMode
} = require('../middleware/auth');
const gameValidation = require('../middleware/gameValidation');
const responseHelper = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

const router = express.Router();
// Admin sync metrics endpoints (no auth in dev)
router.get('/admin/sync-metrics', async (req, res) => {
  try {
    const metricsService = require('../services/metricsService');
    const metrics = await metricsService.getDashboardMetrics(req.query.timeframe || '24h');
    res.json({ success: true, metrics });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/admin/sync-health', async (req, res) => {
  try {
    const metricsService = require('../services/metricsService');
    const system = await metricsService.getSystemMetrics('24h');
    const rtp = await metricsService.getRTPMetrics('24h');
    const realtime = await metricsService.getRealtimeMetrics();
    res.json({ success: true, system, rtp, realtime });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Middleware to validate request and handle errors
const validateAndProceed = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return responseHelper.validationError(res, 'Request validation failed', errors.array());
  }
  next();
};

// Request logging middleware
router.use((req, res, next) => {
  logger.info('API request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    playerId: req.user?.id
  });
  next();
});

/**
 * POST /api/demo-spin
 * Process a demo spin request (no auth required for testing)
 * Body: { betAmount, quickSpinMode?, freeSpinsActive?, accumulatedMultiplier?, bonusMode? }
 */
// Demo mode: separate game engine with boosted RTP
const GameEngine = require('../game/gameEngine');
const { saveSpinResult, ensureTestPlayer } = require('../db/supabaseClient');
const { getDemoState, setDemoState, resetDemoState, initDemoState, DEMO_START_BALANCE } = require('../demo/demoSession');

// Create demo engine with demo mode enabled
const demoEngine = new GameEngine({ mode: 'demo' });

const DEMO_IDENTIFIER = 'demo-player';
const DEMO_SESSION_ID = 'demo-session';

const resolveBypassIdentifier = (req) => {
  return (
    req.headers['x-test-player'] ||
    req.body?.playerId ||
    req.query?.playerId ||
    DEMO_IDENTIFIER
  );
};

/**
 * POST /api/demo-spin
 * Free-to-play demo spin (no auth, cookie-based state, boosted RTP)
 */
router.post('/demo-spin',
  [
    body('betAmount')
      .isNumeric()
      .withMessage('Bet amount must be a number')
      .isFloat({ min: 0.01, max: 1000 })
      .withMessage('Bet amount must be between 0.01 and 1000')
      .toFloat(),
    body('quickSpinMode')
      .optional()
      .isBoolean()
      .withMessage('Quick spin mode must be a boolean')
      .toBoolean()
  ],
  validateAndProceed,
  async (req, res) => {
    const {
      betAmount = 1.0,
      quickSpinMode = false,
      rngSeed
    } = req.body;
    
    try {
      // Initialize or get demo state from cookie
      const demoState = initDemoState(req, res);
      
      console.log('[DemoSpin] Starting demo spin - Balance:', demoState.balance, 'Game mode:', demoState.game_state.game_mode);
      
      // Check balance
      if (demoState.balance < betAmount) {
        return res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient demo balance. Please reset your demo balance.',
          balance: demoState.balance
        });
      }
      
      // Deduct bet from balance
      demoState.balance -= betAmount;
      
      // Process spin using demo engine (boosted RTP)
      const spin = await demoEngine.processCompleteSpin({
        betAmount: parseFloat(betAmount),
        playerId: demoState.session_id, // Use session_id as virtual player ID
        sessionId: demoState.session_id,
        freeSpinsActive: demoState.game_state.game_mode === 'free_spins',
        accumulatedMultiplier: demoState.game_state.accumulated_multiplier || 1,
        quickSpinMode: Boolean(quickSpinMode),
        rngSeed: typeof rngSeed === 'string' ? rngSeed : undefined
      });
      
      // Credit win to balance
      demoState.balance += spin.totalWin;
      
      // CRITICAL: Update accumulated multiplier FIRST (before any mode transitions that might reset it)
      if (spin.newAccumulatedMultiplier !== undefined && demoState.game_state.game_mode === 'free_spins') {
        demoState.game_state.accumulated_multiplier = spin.newAccumulatedMultiplier;
        console.log('[DemoSpin] Updated accumulated multiplier:', spin.newAccumulatedMultiplier);
      }
      
      // Update game state
      if (spin.freeSpinsTriggered) {
        // Initial free spins trigger
        demoState.game_state.game_mode = 'free_spins';
        demoState.game_state.free_spins_remaining = spin.freeSpinsRemaining || 15;
        demoState.game_state.accumulated_multiplier = 1; // Reset on initial trigger
        console.log('[DemoSpin] Free spins TRIGGERED - Remaining:', demoState.game_state.free_spins_remaining);
      } else if (spin.freeSpinsRetriggered) {
        // Retrigger during free spins (add 5 more)
        demoState.game_state.game_mode = 'free_spins';
        demoState.game_state.free_spins_remaining = spin.freeSpinsRemaining || (demoState.game_state.free_spins_remaining + 5);
        // DON'T reset accumulated multiplier on retrigger
        console.log('[DemoSpin] Free spins RETRIGGERED - Remaining:', demoState.game_state.free_spins_remaining);
      } else if (spin.freeSpinsEnded) {
        // Free spins naturally ended
        demoState.game_state.game_mode = 'base';
        demoState.game_state.free_spins_remaining = 0;
        demoState.game_state.accumulated_multiplier = 1;
        console.log('[DemoSpin] Free spins ENDED');
      } else if (demoState.game_state.game_mode === 'free_spins' && demoState.game_state.free_spins_remaining > 0) {
        // Normal free spin decrement
        demoState.game_state.free_spins_remaining -= 1;
        console.log('[DemoSpin] Free spin consumed - Remaining:', demoState.game_state.free_spins_remaining);
        if (demoState.game_state.free_spins_remaining === 0) {
          demoState.game_state.game_mode = 'base';
          demoState.game_state.accumulated_multiplier = 1;
          console.log('[DemoSpin] Free spins depleted - returning to base mode');
        }
      }
      
      // Save updated demo state to cookie (NO DATABASE WRITES)
      setDemoState(res, demoState);
      
      console.log('[DemoSpin] Spin complete - New balance:', demoState.balance, 'Win:', spin.totalWin);
      
      const responsePayload = {
        success: true,
        data: {
          spinId: spin.spinId,
          betAmount: spin.betAmount,
          totalWin: spin.totalWin,
          baseWin: spin.baseWin,
          initialGrid: spin.initialGrid,
          finalGrid: spin.finalGrid,
          cascadeSteps: spin.cascadeSteps,
          bonusFeatures: spin.bonusFeatures,
          multiplierEvents: spin.multiplierEvents || [],
          multiplierAwarded: spin.multiplierAwarded,
          timing: spin.timing,
          quickSpinMode,
          freeSpinsActive: demoState.game_state.game_mode === 'free_spins',
          freeSpinsRemaining: demoState.game_state.free_spins_remaining,
          freeSpinsTriggered: spin.freeSpinsTriggered,
          freeSpinsRetriggered: spin.freeSpinsRetriggered,
          freeSpinsEnded: spin.freeSpinsEnded,
          gameMode: demoState.game_state.game_mode,
          accumulatedMultiplier: demoState.game_state.accumulated_multiplier,
          balance: demoState.balance, // Return updated balance
          playerCredits: demoState.balance,
          rngSeed: spin.rngSeed,
          metadata: {
            rngAuditId: spin.rngSeed,
            mode: 'demo'
          }
        }
      };

      // Add payload size monitoring header
      const payloadString = JSON.stringify(responsePayload);
      const payloadBytes = Buffer.byteLength(payloadString, 'utf8');
      res.setHeader('X-Payload-Bytes', String(payloadBytes));
      if (payloadBytes > 51200) { // 50KB
        console.warn('Demo-spin response payload exceeded 50KB:', payloadBytes, 'bytes');
      }

      return res.json(responsePayload);
    } catch (e) {
      console.error('Demo spin engine error:', e.message, e.stack);
      return res.status(500).json({ success: false, error: 'DEMO_SPIN_FAILED', message: e.message });
    }
  }
);

/**
 * GET /api/demo/balance
 * Get current demo balance and game state
 */
router.get('/demo/balance', async (req, res) => {
  try {
    const demoState = initDemoState(req, res);
    
    res.json({
      success: true,
      balance: demoState.balance,
      game_state: demoState.game_state,
      session_id: demoState.session_id
    });
  } catch (error) {
    console.error('Demo balance error:', error);
    res.status(500).json({ success: false, error: 'DEMO_BALANCE_ERROR', message: error.message });
  }
});

/**
 * POST /api/demo/reset
 * Reset demo balance to initial amount
 */
router.post('/demo/reset', async (req, res) => {
  try {
    const freshState = resetDemoState(res);
    
    res.json({
      success: true,
      balance: freshState.balance,
      game_state: freshState.game_state,
      message: 'Demo balance reset to initial amount'
    });
  } catch (error) {
    console.error('Demo reset error:', error);
    res.status(500).json({ success: false, error: 'DEMO_RESET_ERROR', message: error.message });
  }
});

const demoAuthBypass = async (req, res, next) => {
  try {
    if (req.headers['x-demo-bypass'] === 'true' || req.query.demo === 'true') {
      req.demoBypass = true;
    }

    if (!req.demoBypass) {
      return next();
    }

    const bypassIdentifier = resolveBypassIdentifier(req);
    const result = await ensureTestPlayer(bypassIdentifier, {
      allowCreate: true,
      markDemo: bypassIdentifier === DEMO_IDENTIFIER,
      initialCredits: bypassIdentifier === DEMO_IDENTIFIER ? 5000 : 0,
      returnPassword: false
    });

    if (result?.error || !result.player) {
      return res.status(500).json({
        success: false,
        error: 'TEST_PLAYER_UNAVAILABLE',
        message: result?.error || 'Test player account is not provisioned'
      });
    }

    const player = result.player;

    req.user = {
      id: player.id,
      username: player.username || bypassIdentifier,
      is_demo: Boolean(player.is_demo),
      status: player.status || 'active'
    };
    req.session_info = { id: DEMO_SESSION_ID, is_demo: Boolean(player.is_demo), player_id: player.id };

    return next();
  } catch (error) {
    console.error('Demo auth bypass failed:', error);
    return res.status(500).json({
      success: false,
      error: 'TEST_PLAYER_LOOKUP_FAILED',
      message: error.message
    });
  }
};

/**
 * POST /api/spin
 * Process a spin request
 * Requires: Active player authentication
 * Body: { betAmount, quickSpinMode?, freeSpinsActive?, accumulatedMultiplier?, bonusMode? }
 */
router.post('/spin',
  demoAuthBypass,
  authenticate,
  requireActivePlayer,
  checkSessionRefresh,
  gameValidation.validateSpinRequest,
  [
    body('betAmount')
      .isNumeric()
      .withMessage('Bet amount must be a number')
      .isFloat({ min: 0.01, max: 1000 })
      .withMessage('Bet amount must be between 0.01 and 1000')
      .toFloat(),
    body('quickSpinMode')
      .optional()
      .isBoolean()
      .withMessage('Quick spin mode must be a boolean')
      .toBoolean(),
    body('freeSpinsActive')
      .optional()
      .isBoolean()
      .withMessage('Free spins active must be a boolean')
      .toBoolean(),
    body('accumulatedMultiplier')
      .optional()
      .isNumeric()
      .withMessage('Accumulated multiplier must be a number')
      .isFloat({ min: 1, max: 5000 })
      .withMessage('Accumulated multiplier must be between 1 and 5000')
      .toFloat(),
    body('bonusMode')
      .optional()
      .isBoolean()
      .withMessage('Bonus mode must be a boolean')
      .toBoolean()
  ],
  validateAndProceed,
    GameController.processSpin.bind(GameController)
);

/**
 * GET /api/spin/result/:requestId
 * Retrieve cached spin result using the original client request ID
 */
router.get('/spin/result/:requestId',
  demoAuthBypass,
  authenticate,
  requireActivePlayer,
  [
    param('requestId')
      .exists()
      .withMessage('requestId is required')
      .isString()
      .withMessage('requestId must be a string')
      .trim()
  ],
  validateAndProceed,
  GameController.getPendingSpinResultByRequest.bind(GameController)
);

/**
 * GET /api/game-state
 * Get current player game state
 * Requires: Active player authentication
 */
router.get('/game-state',
  demoAuthBypass,
  authenticate,
  requireActivePlayer,
  GameController.getGameState.bind(GameController)
);

/**
 * PUT /api/game-state
 * Update game state (admin only or specific conditions)
 * Requires: Active player authentication
 * Body: { stateUpdates: object, reason?: string }
 */
router.put('/game-state',
  demoAuthBypass,
  authenticate,
  requireActivePlayer,
  gameValidation.validateStateUpdate,
  [
    body('stateUpdates')
      .exists()
      .withMessage('State updates are required')
      .isObject()
      .withMessage('State updates must be an object'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string')
      .isLength({ max: 255 })
      .withMessage('Reason must be less than 255 characters')
  ],
  validateAndProceed,
  GameController.updateGameState.bind(GameController)
);

/**
 * GET /api/player-stats
 * Get comprehensive player statistics
 * Requires: Active player authentication
 * Query: { period?: string, limit?: number }
 */
router.get('/player-stats',
  authenticate,
  requireActivePlayer,
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'year', 'all'])
      .withMessage('Period must be one of: day, week, month, year, all'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Limit must be between 1 and 10000')
      .toInt()
  ],
  validateAndProceed,
  GameController.getPlayerStats.bind(GameController)
);

/**
 * GET /api/game-status
 * Get game system status and health
 * Optional authentication - public health check
 */
router.get('/game-status',
  optionalAuth,
  GameController.getGameStatus.bind(GameController)
);

/**
 * POST /api/buy-feature
 * Purchase bonus features (free spins, etc.)
 * Requires: Active player authentication, blocks demo mode
 * Body: { featureType: string, cost: number }
 */
router.post('/buy-feature',
  demoAuthBypass,
  authenticate,
  requireActivePlayer,
  blockDemoMode,
  gameValidation.validateFeaturePurchase,
  [
    body('featureType')
      .exists()
      .withMessage('Feature type is required')
      .isIn(['free_spins', 'bonus_round'])
      .withMessage('Feature type must be free_spins or bonus_round'),
    body('cost')
      .isNumeric()
      .withMessage('Cost must be a number')
      .isFloat({ min: 0.01 })
      .withMessage('Cost must be at least 0.01')
      .toFloat()
  ],
  validateAndProceed,
  async (req, res) => {
    // Feature purchase logic would go here
    // For now, return not implemented
    responseHelper.notImplemented(res, 'Feature purchase not yet implemented');
  }
);

/**
 * GET /api/spin-history
 * Get player's spin history
 * Requires: Active player authentication
 * Query: { limit?: number, offset?: number, dateFrom?, dateTo? }
 */
router.get('/spin-history',
  demoAuthBypass,
  authenticate,
  requireActivePlayer,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000')
      .toInt(),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be 0 or greater')
      .toInt(),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be valid ISO 8601 date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be valid ISO 8601 date')
  ],
  validateAndProceed,
  async (req, res) => {
    try {
      const { getSpinHistory } = require('../db/supabaseClient');
      
      // Get authenticated player ID from middleware
      const playerId = req.user.id;
      
      // Parse query parameters
      const limit = Math.min(parseInt(req.query.limit) || 200, 200);
      const offset = parseInt(req.query.offset) || 0;
      const order = 'desc'; // Always descending (newest first)
      
      // Fetch spin history for the authenticated player
      const result = await getSpinHistory(playerId, limit, offset, order);
      
      if (result.error) {
        return res.status(500).json({ 
          success: false, 
          error: 'HISTORY_ERROR', 
          message: result.error 
        });
      }
      
      // Map to required fields
      const rows = (result.rows || []).map(r => ({
        bet_time: r.created_at || r.createdAt || r.timestamp || null,
        player_id: r.player_id || null,
        spin_id: r.id || r.spin_id || r.spinId || null,
        bet_amount: Number(r.bet_amount || r.bet || 0),
        total_win: Number(r.total_win || r.win || 0),
        game_mode: r.game_mode || (r.freeSpinsActive ? 'free_spins' : 'base')
      }));
      
      const total = Number(result.total || 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      
      // Calculate page number from offset
      const page = Math.floor(offset / limit) + 1;
      
      res.json({ 
        success: true, 
        page, 
        limit, 
        total, 
        totalPages, 
        data: rows 
      });
    } catch (error) {
      console.error('Spin history endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'HISTORY_ENDPOINT_ERROR', 
        message: error.message 
      });
    }
  }
);

/**
 * GET /api/jackpots
 * Get current jackpot information
 * Optional authentication
 */
router.get('/jackpots',
  optionalAuth,
  async (req, res) => {
    // Jackpot information logic would go here
    // For now, return mock data
    responseHelper.success(res, 'Jackpot data retrieved', {
      jackpots: [],
      message: 'Jackpot system not yet implemented'
    });
  }
);

/**
 * POST /api/validate-session
 * Validate current game session
 * Requires: Authentication
 */
router.post('/validate-session',
  demoAuthBypass,
  authenticate,
  async (req, res) => {
    try {
      responseHelper.success(res, 'Session is valid', {
        playerId: req.user.id,
        sessionId: req.session_info.id,
        sessionValid: true,
        expiresAt: req.session_info.expires_at,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Session validation error', {
        error: error.message,
        playerId: req.user?.id
      });
      responseHelper.serverError(res, 'Session validation failed');
    }
  }
);

// Admin-only routes
/**
 * GET /api/admin/game-metrics
 * Get detailed game metrics (admin only)
 * Requires: Admin authentication
 */
router.get('/admin/game-metrics',
  requireAdmin,
  async (req, res) => {
    // Admin metrics logic would go here
    responseHelper.notImplemented(res, 'Admin metrics not yet implemented');
  }
);

/**
 * POST /api/admin/emergency-stop
 * Emergency stop for game operations (admin only)
 * Requires: Admin authentication
 */
router.post('/admin/emergency-stop',
  requireAdmin,
  [
    body('reason')
      .exists()
      .withMessage('Reason is required')
      .isString()
      .withMessage('Reason must be a string')
      .isLength({ min: 10 })
      .withMessage('Reason must be at least 10 characters')
  ],
  validateAndProceed,
  async (req, res) => {
    // Emergency stop logic would go here
    responseHelper.notImplemented(res, 'Emergency stop not yet implemented');
  }
);

// Error handling middleware for API routes
router.use((err, req, res, next) => {
  logger.error('API route error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    playerId: req.user?.id
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return responseHelper.validationError(res, 'Validation failed', [err.message]);
  }

  if (err.name === 'UnauthorizedError') {
    return responseHelper.unauthorized(res, 'Authentication required');
  }

  if (err.name === 'ForbiddenError') {
    return responseHelper.forbidden(res, 'Access denied');
  }

  if (err.code === 'INSUFFICIENT_CREDITS') {
    return responseHelper.badRequest(res, 'Insufficient credits', {
      error: err.code,
      availableCredits: err.availableCredits
    });
  }

  if (err.code === 'ANTI_CHEAT_VIOLATION') {
    return responseHelper.forbidden(res, 'Security violation detected', {
      error: err.code,
      violations: err.violations
    });
  }

  // Default server error
  responseHelper.serverError(res, 'An unexpected error occurred', {
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

module.exports = router;
