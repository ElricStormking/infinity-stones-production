/**
 * Admin Routes
 *
 * Secure routing for admin panel with comprehensive authentication,
 * authorization, and audit logging for all administrative operations.
 *
 * Features:
 * - Secure admin authentication and session management
 * - Role-based access control (ready for expansion)
 * - Comprehensive audit logging for all admin actions
 * - Simplified authentication with JWT tokens
 * - Rate limiting for security-sensitive endpoints
 * - Input validation and sanitization
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');
const { featureFlags } = require('../config/featureFlags');

const adminController = require('../controllers/admin');
const {
  authenticateAdmin,
  checkAdminSessionTimeout,
  logAdminActivity,
  completeAdminActivityLog,
  requireAdminRole
} = require('../middleware/adminAuth');

const router = express.Router();

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV !== 'production';
  }
});

// Rate limiting for sensitive operations
const sensitiveRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 operations per window
  message: {
    error: 'Too many operations',
    code: 'OPERATION_RATE_LIMIT',
    message: 'Please wait before performing more operations'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== 'production';
  }
});

// Validation middleware
const validateErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.accepts('json')) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.array()
      });
    } else {
      // For web requests, redirect with error
      const firstError = errors.array()[0];
      return res.redirect(`${req.originalUrl}?error=${encodeURIComponent(firstError.msg)}`);
    }
  }
  next();
};

/**
 * Public Routes (No Authentication Required)
 */

// Admin Login Page
router.get('/login', authRateLimit, adminController.loginPage);

// Process Admin Login
router.post('/login',
  authRateLimit,
  [
    body('account_id')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Account ID must be between 3 and 50 characters'),
    body('password')
      .isLength({ min: 1, max: 128 })
      .withMessage('Password is required'),
    body('remember_me')
      .optional()
      .isIn(['on'])
      .withMessage('Invalid remember me value')
  ],
  validateErrors,
  adminController.processLogin
);

// Test Dashboard (no auth required) - dev/test only
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-dashboard', async (req, res) => {
    try {
      // Render dashboard directly without authentication
      const metricsService = require('../services/metricsService');
      const dashboardData = {
        user: { username: 'demo-admin', is_admin: true },
        metrics: await metricsService.getDashboardMetrics('24h'),
        realtime: await metricsService.getRealtimeMetrics()
      };
      res.render('admin/dashboard', dashboardData);
    } catch (error) {
      // eslint-disable-next-line no-console
      logger.error('Test dashboard error:', { details: error });
      res.status(500).json({ error: 'Dashboard error', message: error.message });
    }
  });
}

/**
 * Protected Routes (Admin Authentication Required)
 */

// Apply admin authentication to all remaining routes
router.use(authenticateAdmin);
router.use(checkAdminSessionTimeout);
router.use(logAdminActivity());
router.use(completeAdminActivityLog);

// Admin Logout
router.post('/logout', adminController.logout);
router.get('/logout', adminController.logout);

// Admin Dashboard
router.get('/', adminController.dashboard);
router.get('/dashboard', adminController.dashboard);

/**
 * Player Management Routes
 */

// List Players
router.get('/players',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('status').optional().isIn(['active', 'suspended', 'banned']).withMessage('Invalid status'),
    query('is_admin').optional().isBoolean().withMessage('Invalid admin flag'),
    query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Invalid search term')
  ],
  validateErrors,
  adminController.listPlayers
);

// View Player Details
router.get('/players/:id',
  [
    param('id').isUUID().withMessage('Invalid player ID')
  ],
  validateErrors,
  logAdminActivity('balance_inquiry'),
  adminController.viewPlayer
);

// Suspend Player
router.post('/players/:id/suspend',
  sensitiveRateLimit,
  [
    param('id').isUUID().withMessage('Invalid player ID'),
    body('reason')
      .optional()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('account_suspension'),
  adminController.suspendPlayer
);

// Activate Player
router.post('/players/:id/activate',
  sensitiveRateLimit,
  [
    param('id').isUUID().withMessage('Invalid player ID')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('account_activation'),
  adminController.activatePlayer
);

// Adjust Player Credits
router.post('/players/:id/credits',
  sensitiveRateLimit,
  [
    param('id').isUUID().withMessage('Invalid player ID'),
    body('amount')
      .isFloat({ min: 0.01, max: 1000000 })
      .withMessage('Amount must be between 0.01 and 1,000,000'),
    body('type')
      .isIn(['add', 'subtract', 'set'])
      .withMessage('Type must be add, subtract, or set'),
    body('reason')
      .optional()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Reason must be between 1 and 500 characters')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('credit_adjustment'),
  adminController.adjustCredits
);

// Ban Player
router.post('/players/:id/ban',
  sensitiveRateLimit,
  [
    param('id').isUUID().withMessage('Invalid player ID'),
    body('reason')
      .trim()
      .isLength({ min: 3, max: 1000 })
      .withMessage('Reason must be between 3 and 1000 characters')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('account_ban'),
  adminController.banPlayer
);

// Send Notification to Player
router.post('/players/:id/notify',
  sensitiveRateLimit,
  [
    param('id').isUUID().withMessage('Invalid player ID'),
    body('type')
      .isIn(['info', 'warning', 'promotion', 'system'])
      .withMessage('Invalid notification type'),
    body('title')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be between 1 and 100 characters'),
    body('message')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Message must be between 1 and 500 characters'),
    body('urgent')
      .optional()
      .isBoolean()
      .withMessage('Urgent must be a boolean')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('player_notification'),
  adminController.sendNotification
);

// Get Player Transaction History (AJAX)
router.get('/players/:id/transactions',
  [
    param('id').isUUID().withMessage('Invalid player ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Invalid limit')
  ],
  validateErrors,
  logAdminActivity('transaction_history_inquiry'),
  adminController.getPlayerTransactions
);

// Get Player Game History (AJAX)
router.get('/players/:id/game-history',
  [
    param('id').isUUID().withMessage('Invalid player ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Invalid limit')
  ],
  validateErrors,
  logAdminActivity('game_history_inquiry'),
  adminController.getPlayerGameHistory
);

// Export Player Transaction History
router.get('/players/:id/transactions/export',
  [
    param('id').isUUID().withMessage('Invalid player ID')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('transaction_export'),
  adminController.exportPlayerTransactions
);

// Export Player Game History
router.get('/players/:id/game-history/export',
  [
    param('id').isUUID().withMessage('Invalid player ID')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('game_history_export'),
  adminController.exportPlayerGameHistory
);

/**
 * Audit and Monitoring Routes
 */

// View Audit Logs
router.get('/audit/logs',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('admin_id').optional().isUUID().withMessage('Invalid admin ID'),
    query('action_type').optional().trim().isLength({ min: 1 }).withMessage('Invalid action type'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    query('result').optional().isIn(['success', 'failure', 'partial', 'pending']).withMessage('Invalid result'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Invalid days value')
  ],
  validateErrors,
  adminController.viewAuditLogs
);

/**
 * API Endpoints for AJAX requests
 */

// Comprehensive Dashboard Metrics API
router.get('/api/metrics',
  [
    query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe')
  ],
  validateErrors,
  logAdminActivity('metrics_access'),
  adminController.getMetrics
);

// Real-time Metrics API
router.get('/api/realtime-metrics',
  logAdminActivity('realtime_metrics_access'),
  adminController.getRealtimeMetrics
);

// RTP Monitoring API
router.get('/api/rtp-metrics',
  [
    query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe')
  ],
  validateErrors,
  logAdminActivity('rtp_metrics_access'),
  adminController.getRTPMetrics
);

// System Health Check API
router.get('/api/health',
  adminController.getSystemHealth
);

// Compliance Report Generation
router.get('/api/compliance-report',
  [
    query('timeframe').optional().isIn(['24h', '7d', '30d', '90d']).withMessage('Invalid timeframe')
  ],
  validateErrors,
  requireAdminRole('admin'),
  logAdminActivity('compliance_report_generation'),
  adminController.generateComplianceReport
);

// Health Check (for monitoring) - Legacy endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    admin: {
      id: req.admin.id,
      username: req.admin.username
    },
    session: {
      id: req.admin_session.id,
      expires_at: req.admin_session.expires_at
    }
  });
});

// Session Status Check
router.get('/session/status', (req, res) => {
  const expiresAt = new Date(req.admin_session.expires_at);
  const now = new Date();
  const timeRemaining = expiresAt.getTime() - now.getTime();

  res.json({
    status: 'active',
    expires_at: req.admin_session.expires_at,
    time_remaining_ms: timeRemaining,
    needs_refresh: timeRemaining < (15 * 60 * 1000), // 15 minutes
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      last_activity: req.admin_session.last_activity_at
    }
  });
});

// Extend Session
router.post('/session/extend',
  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 extensions per window
    message: { error: 'Too many session extension requests' }
  }),
  async (req, res) => {
    try {
      const extended = await SessionManager.extendSession(req.admin_session.id);

      if (extended) {
        res.json({
          success: true,
          message: 'Session extended successfully',
          new_expires_at: extended.expires_at
        });
      } else {
        res.status(400).json({
          error: 'Failed to extend session',
          code: 'SESSION_EXTENSION_FAILED'
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Session extension error',
        code: 'SESSION_EXTENSION_ERROR'
      });
    }
  }
);

/**
 * Error Handling
 */

// Handle validation errors
router.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON'
    });
  }
  next(err);
});

// Generic error handler
router.use((err, req, res, next) => {
  logger.error('Admin route error', {
    error: err.message,
    stack: err.stack,
    admin_id: req.admin?.id,
    endpoint: req.originalUrl,
    method: req.method
  });

  if (req.accepts('json')) {
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    });
  } else {
    res.render('admin/error', {
      title: 'System Error',
      error: 'An unexpected error occurred',
      message: 'Please try again or contact support'
    });
  }
});

/**
 * GET /admin/api/feature-flags
 * Get all feature flags and their current states
 */
router.get('/api/feature-flags',
  authenticateAdmin,
  checkAdminSessionTimeout,
  logAdminActivity,
  async (req, res) => {
    try {
      const flags = featureFlags.getAllFlags();
      const history = featureFlags.getHistory();

      res.json({
        success: true,
        data: {
          flags,
          history: history.slice(-20), // Last 20 changes
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Feature flags retrieval error', {
        admin: req.admin?.username,
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve feature flags'
      });
    }
  }
);

/**
 * POST /admin/api/feature-flags/:flagName
 * Toggle a feature flag
 */
router.post('/api/feature-flags/:flagName',
  authenticateAdmin,
  checkAdminSessionTimeout,
  sensitiveRateLimit,
  logAdminActivity,
  [
    param('flagName')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Flag name is required'),
    body('enabled')
      .isBoolean()
      .withMessage('Enabled must be a boolean'),
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Reason must be a string (max 200 chars)')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { flagName } = req.params;
      const { enabled, reason } = req.body;
      const adminUsername = req.admin?.username || 'unknown';

      featureFlags.setFlag(
        flagName,
        enabled,
        `${reason || 'Manual toggle'} by ${adminUsername}`
      );

      logger.info('Feature flag toggled', {
        admin: adminUsername,
        flag: flagName,
        enabled,
        reason
      });

      res.json({
        success: true,
        data: {
          flag: flagName,
          enabled,
          message: `Feature flag ${flagName} ${enabled ? 'enabled' : 'disabled'}`
        }
      });
    } catch (error) {
      logger.error('Feature flag toggle error', {
        admin: req.admin?.username,
        flag: req.params.flagName,
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to toggle feature flag'
      });
    }
  }
);

/**
 * POST /admin/api/feature-flags/category/:category
 * Bulk enable/disable feature flags by category
 */
router.post('/api/feature-flags/category/:category',
  authenticateAdmin,
  checkAdminSessionTimeout,
  sensitiveRateLimit,
  logAdminActivity,
  [
    param('category')
      .isString()
      .trim()
      .isIn(['debug', 'security', 'performance', 'sync'])
      .withMessage('Invalid category'),
    body('enabled')
      .isBoolean()
      .withMessage('Enabled must be a boolean'),
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Reason must be a string (max 200 chars)')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { category } = req.params;
      const { enabled, reason } = req.body;
      const adminUsername = req.admin?.username || 'unknown';

      featureFlags.setCategoryFlags(category, enabled);

      logger.info('Feature flag category toggled', {
        admin: adminUsername,
        category,
        enabled,
        reason
      });

      res.json({
        success: true,
        data: {
          category,
          enabled,
          message: `Category '${category}' flags ${enabled ? 'enabled' : 'disabled'}`
        }
      });
    } catch (error) {
      logger.error('Feature flag category toggle error', {
        admin: req.admin?.username,
        category: req.params.category,
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to toggle category flags'
      });
    }
  }
);

// =====================================================
// RTP TUNING TOOL ROUTES
// =====================================================

const rtpSimulator = require('../services/rtpSimulator');
const rtpOptimizer = require('../services/rtpOptimizer');
const configManager = require('../services/configManager');

/**
 * GET /admin/rtp-tuning
 * RTP Tuning Tool Page
 */
router.get('/rtp-tuning',
  authenticateAdmin,
  checkAdminSessionTimeout,
  async (req, res) => {
    try {
      res.render('admin/rtp-tuning', {
        title: 'RTP Tuning Tool - Infinity Storm Admin',
        admin: req.admin
      });
    } catch (error) {
      logger.error('RTP tuning page error', {
        admin: req.admin?.account_id,
        error: error.message
      });
      res.status(500).render('admin/error', {
        title: 'Error',
        error: 'Failed to load RTP tuning tool'
      });
    }
  }
);

/**
 * GET /admin/api/rtp/config
 * Get current game configuration
 */
router.get('/api/rtp/config',
  authenticateAdmin,
  async (req, res) => {
    try {
      const config = await configManager.readCurrentConfig();
      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Get RTP config error', {
        admin: req.admin?.account_id,
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: 'Failed to read current configuration'
      });
    }
  }
);

/**
 * POST /admin/api/rtp/simulate
 * Run RTP simulation with custom config
 */
router.post('/api/rtp/simulate',
  authenticateAdmin,
  [
    body('spinCount')
      .optional()
      .isInt({ min: 1000, max: 1000000 })
      .withMessage('Spin count must be between 1,000 and 1,000,000'),
    body('symbolWeights')
      .optional()
      .isObject()
      .withMessage('Symbol weights must be an object'),
    body('scatterChance')
      .optional()
      .isFloat({ min: 0.001, max: 0.2 })
      .withMessage('Scatter chance must be between 0.001 and 0.2'),
    body('multiplierTable')
      .optional()
      .isArray()
      .withMessage('Multiplier table must be an array'),
    body('freeSpinsConfig')
      .optional()
      .isObject()
      .withMessage('Free spins config must be an object')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const {
        symbolWeights,
        scatterChance,
        multiplierTable,
        freeSpinsConfig,
        spinCount = 100000
      } = req.body;

      logger.info('Starting RTP simulation', {
        admin: req.admin?.account_id,
        spinCount
      });

      // Run simulation
      const results = await rtpSimulator.runSimulation({
        symbolWeights,
        scatterChance,
        multiplierTable,
        freeSpinsConfig,
        spinCount
      });

      res.json({
        success: true,
        results
      });
    } catch (error) {
      logger.error('RTP simulation error', {
        admin: req.admin?.account_id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Simulation failed'
      });
    }
  }
);

/**
 * POST /admin/api/rtp/optimize
 * Get optimal weights for target RTP
 */
router.post('/api/rtp/optimize',
  authenticateAdmin,
  [
    body('targetRTP')
      .isFloat({ min: 85, max: 110 })
      .withMessage('Target RTP must be between 85% and 110%'),
    body('currentConfig')
      .isObject()
      .withMessage('Current config must be provided'),
    body('maxIterations')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Max iterations must be between 1 and 20')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const {
        targetRTP,
        currentConfig,
        maxIterations = 10
      } = req.body;

      logger.info('Starting RTP optimization', {
        admin: req.admin?.account_id,
        targetRTP,
        maxIterations
      });

      // Run optimization
      const results = await rtpOptimizer.optimize({
        targetRTP,
        currentConfig,
        maxIterations
      });

      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      logger.error('RTP optimization error', {
        admin: req.admin?.account_id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Optimization failed'
      });
    }
  }
);

/**
 * POST /admin/api/rtp/apply
 * Apply new configuration to server
 */
router.post('/api/rtp/apply',
  authenticateAdmin,
  sensitiveRateLimit,
  [
    body('newConfig')
      .isObject()
      .withMessage('New config must be provided'),
    body('adminConfirmation')
      .equals('true')
      .withMessage('Admin confirmation required')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { newConfig } = req.body;

      logger.info('Applying new RTP config', {
        admin: req.admin?.account_id,
        changes: Object.keys(newConfig)
      });

      // Apply config
      const result = await configManager.applyConfig(
        newConfig,
        req.admin.account_id
      );

      res.json({
        success: true,
        ...result,
        message: 'Configuration applied successfully'
      });
    } catch (error) {
      logger.error('Apply RTP config error', {
        admin: req.admin?.account_id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to apply configuration'
      });
    }
  }
);

/**
 * POST /admin/api/rtp/rollback
 * Rollback to previous backup
 */
router.post('/api/rtp/rollback',
  authenticateAdmin,
  sensitiveRateLimit,
  [
    body('backupPath')
      .isString()
      .withMessage('Backup path required')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { backupPath } = req.body;

      logger.info('Rolling back RTP config', {
        admin: req.admin?.account_id,
        backupPath
      });

      await configManager.rollback(backupPath, req.admin.account_id);

      res.json({
        success: true,
        message: 'Configuration rolled back successfully'
      });
    } catch (error) {
      logger.error('RTP rollback error', {
        admin: req.admin?.account_id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Rollback failed'
      });
    }
  }
);

/**
 * GET /admin/api/rtp/history
 * Get config change history
 */
router.get('/api/rtp/history',
  authenticateAdmin,
  async (req, res) => {
    try {
      const history = configManager.getHistory();
      const backups = await configManager.listBackups();

      res.json({
        success: true,
        history,
        backups
      });
    } catch (error) {
      logger.error('Get RTP history error', {
        admin: req.admin?.account_id,
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve history'
      });
    }
  }
);

module.exports = router;