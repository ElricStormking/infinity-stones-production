/**
 * Authentication Middleware for Game Server
 *
 * Protects API endpoints with JWT token validation
 * Enforces session management and player status checks
 */

const SessionManager = require('../auth/sessionManager');
const { logger } = require('../utils/logger.js');

/**
 * Extract JWT token from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and just "token"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
};

/**
 * Main authentication middleware
 * Validates JWT token and attaches user data to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from request
    const token = extractToken(req);

    if (!token) {
      // For demo mode, create a demo user session
      const { getDemoPlayer } = require('../db/supabaseClient');
      try {
        const demoPlayer = await getDemoPlayer();
        req.user = {
          id: demoPlayer.id,
          username: demoPlayer.username,
          is_demo: demoPlayer.is_demo,
          is_admin: demoPlayer.is_admin,
          status: demoPlayer.status
        };
        req.session_info = {
          id: 'demo_session',
          is_demo: true
        };
        return next();
      } catch (demoError) {
        logger.warn('Failed to create demo session', { error: demoError.message });
      }

      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN',
        message: 'Access token is required'
      });
    }

    // Validate session
    let validation;
    try {
      validation = await SessionManager.validateSession(token);
    } catch (error) {
      // If Redis is disabled and session validation fails, try JWT-only validation
      if (process.env.SKIP_REDIS === 'true' && error.message.includes('retries per request limit')) {
        logger.info('Redis unavailable, using JWT-only validation', {
          ip: req.ip,
          endpoint: req.originalUrl
        });

        // Try direct JWT validation without Redis
        const JWTAuth = require('../auth/jwt');
        try {
          const decoded = JWTAuth.verifyAccessToken(token);
          const Player = require('../models/Player');
          const player = await Player.findByPk(decoded.player_id);

          if (player) {
            validation = {
              valid: true,
              player: player,
              session: { id: 'fallback_session', player_id: decoded.player_id }
            };
          } else {
            validation = { valid: false, error: 'Player not found' };
          }
        } catch (jwtError) {
          validation = { valid: false, error: 'Invalid JWT token' };
        }
      } else {
        validation = { valid: false, error: error.message };
      }
    }

    if (!validation.valid) {
      // Log authentication failure
      logger.warn('Authentication failed', {
        error: validation.error,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });

      return res.status(401).json({
        error: 'Authentication failed',
        code: 'INVALID_TOKEN',
        message: validation.error
      });
    }

    // Attach user and session data to request
    req.user = validation.player;
    req.session_info = validation.session;
    req.token = token;

    // Log successful authentication (debug level)
    logger.debug('Authentication successful', {
      player_id: req.user.id,
      username: req.user.username,
      session_id: req.session_info.id,
      ip: req.ip
    });

    next();

  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Authentication service unavailable',
      code: 'AUTH_SERVICE_ERROR',
      message: 'Please try again in a moment'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user data if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token provided, continue without authentication
      req.user = null;
      req.session_info = null;
      return next();
    }

    // Validate session if token is provided
    const validation = await SessionManager.validateSession(token);

    if (validation.valid) {
      req.user = validation.player;
      req.session_info = validation.session;
      req.token = token;
    } else {
      req.user = null;
      req.session_info = null;
    }

    next();

  } catch (error) {
    logger.error('Optional auth middleware error', {
      error: error.message,
      ip: req.ip
    });

    // Don't fail the request, just continue without auth
    req.user = null;
    req.session_info = null;
    next();
  }
};

/**
 * Admin-only middleware
 * Requires valid authentication and admin privileges
 */
const requireAdmin = async (req, res, next) => {
  try {
    // First run authentication
    await new Promise((resolve, reject) => {
      authenticate(req, res, (err) => {
        if (err) {reject(err);}
        else {resolve();}
      });
    });

    // Check if user is admin
    if (!req.user || !req.user.is_admin) {
      logger.warn('Admin access denied', {
        player_id: req.user?.id,
        username: req.user?.username,
        is_admin: req.user?.is_admin,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        error: 'Admin privileges required',
        code: 'INSUFFICIENT_PRIVILEGES',
        message: 'This endpoint requires administrator access'
      });
    }

    logger.info('Admin access granted', {
      player_id: req.user.id,
      username: req.user.username,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    next();

  } catch (error) {
    logger.error('Admin auth middleware error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Authorization service unavailable',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Demo mode check middleware
 * Blocks certain actions in demo mode
 */
const blockDemoMode = (req, res, next) => {
  if (req.user && req.user.is_demo) {
    return res.status(403).json({
      error: 'Action not allowed in demo mode',
      code: 'DEMO_MODE_RESTRICTION',
      message: 'This action is not available in demo mode'
    });
  }

  next();
};

/**
 * Active player check middleware
 * Ensures player account is active
 */
const requireActivePlayer = (req, res, next) => {
  if (!req.user || req.user.status !== 'active') {
    return res.status(403).json({
      error: 'Account is not active',
      code: 'INACTIVE_ACCOUNT',
      message: 'Your account is suspended or banned'
    });
  }

  next();
};

/**
 * Session refresh check middleware
 * Automatically refreshes sessions that are about to expire
 */
const checkSessionRefresh = async (req, res, next) => {
  try {
    if (!req.session_info || !req.session_info.needs_refresh) {
      return next();
    }

    // Session needs refresh - generate new token (would be done by portal)
    logger.info('Session refresh needed', {
      player_id: req.user.id,
      session_id: req.session_info.id,
      expires_at: req.session_info.expires_at
    });

    // Add refresh flag to response headers
    res.set('X-Session-Refresh-Needed', 'true');
    res.set('X-Session-Expires-At', req.session_info.expires_at);

    next();

  } catch (error) {
    logger.error('Session refresh check error', {
      error: error.message,
      player_id: req.user?.id
    });

    // Don't fail the request, just continue
    next();
  }
};

/**
 * Rate limiting for authentication attempts
 * Prevents brute force attacks
 */
const authRateLimit = (req, res, next) => {
  // This would typically use express-rate-limit
  // For now, just pass through
  next();
};

/**
 * CORS middleware for authentication endpoints
 */
const authCors = (req, res, next) => {
  // Allow credentials for authentication
  res.header('Access-Control-Allow-Credentials', 'true');

  // Allow specific auth headers
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  next();
};

/**
 * Error handler for authentication failures
 */
const authErrorHandler = (err, req, res, next) => {
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      message: 'Please log in again'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      message: 'Authentication token is invalid'
    });
  }

  // Pass other errors to default handler
  next(err);
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  blockDemoMode,
  requireActivePlayer,
  checkSessionRefresh,
  authRateLimit,
  authCors,
  authErrorHandler,
  extractToken
};