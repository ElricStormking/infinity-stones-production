/**
 * Authentication Routes for Game Server
 * 
 * Defines API endpoints for session management and authentication
 * Portal-first architecture support
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthController = require('../controllers/auth');
const { 
    authenticate, 
    optionalAuth, 
    requireAdmin, 
    authRateLimit,
    authCors 
} = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Apply CORS for authentication endpoints
router.use(authCors);

// Validation middleware helper
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors.array()
        });
    }
    next();
};

// Rate limiting for auth endpoints
router.use(authRateLimit);

/**
 * POST /api/auth/validate
 * Validate existing session token
 * Public endpoint - no authentication required
 */
router.post('/validate',
    [
        body('token')
            .notEmpty()
            .withMessage('Token is required')
            .isString()
            .withMessage('Token must be a string')
            .isLength({ min: 10 })
            .withMessage('Token appears to be invalid')
    ],
    validateRequest,
    AuthController.validateSession
);

/**
 * POST /api/auth/session
 * Create new session from portal authentication
 * Public endpoint - validates token internally
 */
router.post('/session',
    [
        body('token')
            .notEmpty()
            .withMessage('Token is required')
            .isString()
            .withMessage('Token must be a string'),
        body('ip_address')
            .optional()
            .isIP()
            .withMessage('Invalid IP address format'),
        body('user_agent')
            .optional()
            .isString()
            .isLength({ max: 500 })
            .withMessage('User agent too long')
    ],
    validateRequest,
    AuthController.createSession
);

/**
 * POST /api/auth/refresh
 * Refresh session with new token
 * Public endpoint - validates tokens internally
 */
router.post('/refresh',
    [
        body('current_token')
            .notEmpty()
            .withMessage('Current token is required')
            .isString()
            .withMessage('Current token must be a string'),
        body('new_token')
            .notEmpty()
            .withMessage('New token is required')
            .isString()
            .withMessage('New token must be a string')
    ],
    validateRequest,
    AuthController.refreshSession
);

/**
 * POST /api/auth/logout
 * End current session
 * Requires authentication
 */
router.post('/logout',
    authenticate,
    AuthController.logout
);

/**
 * GET /api/auth/session
 * Get current session information
 * Requires authentication
 */
router.get('/session',
    authenticate,
    AuthController.getSessionInfo
);

/**
 * GET /api/auth/status
 * Check authentication status (health check)
 * Optional authentication - works with or without token
 */
router.get('/status',
    optionalAuth,
    AuthController.checkStatus
);

// Admin Routes
// Require admin privileges for all routes below

/**
 * GET /api/auth/admin/sessions
 * Get all active sessions
 * Admin only
 */
router.get('/admin/sessions',
    requireAdmin,
    AuthController.getActiveSessions
);

/**
 * POST /api/auth/admin/force-logout
 * Force logout a specific player
 * Admin only
 */
router.post('/admin/force-logout',
    requireAdmin,
    [
        body('player_id')
            .notEmpty()
            .withMessage('Player ID is required')
            .isUUID()
            .withMessage('Player ID must be a valid UUID'),
        body('reason')
            .optional()
            .isString()
            .isLength({ max: 255 })
            .withMessage('Reason must be a string (max 255 characters)')
    ],
    validateRequest,
    AuthController.forceLogout
);

/**
 * POST /api/auth/register
 * Register a new player account
 * Public endpoint for player registration
 */
router.post('/register',
    [
        body('username')
            .notEmpty()
            .withMessage('Username is required')
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be between 3 and 50 characters')
            .isAlphanumeric()
            .withMessage('Username can only contain letters and numbers'),
        body('email')
            .notEmpty()
            .withMessage('Email is required')
            .isEmail()
            .withMessage('Must be a valid email address')
            .normalizeEmail(),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters'),
        body('confirmPassword')
            .notEmpty()
            .withMessage('Password confirmation is required')
            .custom((value, { req }) => value === req.body.password)
            .withMessage('Passwords do not match')
    ],
    validateRequest,
    AuthController.register
);

/**
 * POST /api/auth/login
 * Login with username/email and password
 * Public endpoint for player authentication
 */
router.post('/login',
    [
        body('username')
            .notEmpty()
            .withMessage('Username or email is required'),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ],
    validateRequest,
    AuthController.login
);

/**
 * GET /api/auth/admin/stats
 * Get session statistics
 * Admin only
 */
router.get('/admin/stats',
    requireAdmin,
    AuthController.getSessionStats
);

/**
 * POST /api/auth/admin/cleanup
 * Cleanup expired sessions
 * Admin only
 */
router.post('/admin/cleanup',
    requireAdmin,
    AuthController.cleanupSessions
);

// Error handling middleware specific to auth routes
router.use((err, req, res, next) => {
    logger.error('Auth route error', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        user_id: req.user?.id
    });

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            message: err.message
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
        });
    }

    res.status(500).json({
        error: 'Authentication service error',
        code: 'SERVICE_ERROR',
        message: 'An unexpected error occurred'
    });
});

module.exports = router;