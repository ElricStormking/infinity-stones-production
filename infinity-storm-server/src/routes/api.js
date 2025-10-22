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

// Reset game state for testing (dev only)
router.post('/reset-game-state', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../db/supabaseClient');
    const playerId = req.body.playerId || req.query.playerId;
    
    if (!playerId) {
      return res.status(400).json({ success: false, error: 'playerId required' });
    }
    
    // Reset to base mode with default values
    const { data, error } = await supabaseAdmin
      .from('game_states')
      .update({
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00,
        state_data: { reset_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('player_id', playerId)
      .select();
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ 
      success: true, 
      message: 'Game state reset to base mode',
      state: data[0] || null
    });
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
// Reuse full game engine for demo spins so client sees real cascades
const GameEngine = require('../game/gameEngine');
const { saveSpinResult, ensureTestPlayer } = require('../db/supabaseClient');
const demoEngine = new GameEngine();

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
  async (req, res) => {
    const {
      betAmount = 1.0,
      quickSpinMode = false,
      freeSpinsActive = false,
      accumulatedMultiplier = 1,
      rngSeed,
      playerId: requestedPlayerId,
      sessionId: requestedSessionId
    } = req.body;
    try {
      const playerIdentifier = typeof requestedPlayerId === 'string' && requestedPlayerId.trim().length > 0
        ? requestedPlayerId.trim()
        : DEMO_IDENTIFIER;
      const sessionIdentifier = typeof requestedSessionId === 'string' && requestedSessionId.trim().length > 0
        ? requestedSessionId.trim()
        : DEMO_SESSION_ID;

      const testPlayerResult = await ensureTestPlayer(playerIdentifier, {
        allowCreate: true,
        markDemo: playerIdentifier === DEMO_IDENTIFIER,
        initialCredits: playerIdentifier === DEMO_IDENTIFIER ? 5000 : 0,
        returnPassword: false
      });

      if (testPlayerResult?.error || !testPlayerResult.player) {
        return res.status(500).json({
          success: false,
          error: 'TEST_PLAYER_UNAVAILABLE',
          message: testPlayerResult?.error || 'Test player account is not provisioned'
        });
      }

      const playerRecord = testPlayerResult.player;

      // Use real engine to generate deterministic cascades without auth
      const spin = await demoEngine.processCompleteSpin({
        betAmount: parseFloat(betAmount),
        playerId: playerRecord.id,
        sessionId: sessionIdentifier,
        freeSpinsActive: Boolean(freeSpinsActive),
        accumulatedMultiplier: parseFloat(accumulatedMultiplier),
        quickSpinMode: Boolean(quickSpinMode),
        rngSeed: typeof rngSeed === 'string' ? rngSeed : undefined
      });

      // Save demo spin result to Supabase (async, non-blocking)
      saveSpinResult(playerRecord.id, {
        sessionId: sessionIdentifier,
        bet: parseFloat(betAmount),
        initialGrid: spin.initialGrid,
        cascades: spin.cascadeSteps,
        totalWin: spin.totalWin,
        multipliers: spin.multipliers,
        rngSeed: spin.rngSeed,
        freeSpinsActive: Boolean(freeSpinsActive)
      }).catch(err => {
        console.error('Failed to save demo spin result to Supabase:', err.message);
      });

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
          // CRITICAL FIX: Return the NEW accumulated multiplier from game engine, not the old input value!
          accumulatedMultiplier: spin.newAccumulatedMultiplier || accumulatedMultiplier,
          rngSeed: spin.rngSeed,
          metadata: {
            rngAuditId: spin.rngSeed
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
      console.error('Demo spin engine error:', e.message);
      return res.status(500).json({ success: false, error: 'DEMO_SPIN_FAILED', message: e.message });
    }
  }
);

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
