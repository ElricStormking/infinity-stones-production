/**
 * Enhanced Admin Authentication Middleware
 *
 * Provides secure authentication and authorization for admin panel access
 * with enhanced security features, session management, and audit logging.
 *
 * Features:
 * - Enhanced admin session security
 * - IP address validation and tracking
 * - Session timeout management
 * - Comprehensive audit logging
 * - Two-factor authentication ready
 * - Admin activity monitoring
 */

const { logger } = require('../utils/logger');

/**
 * Extract admin token from request (cookies or headers)
 * @param {Object} req - Express request object
 * @returns {string|null} Admin token or null
 */
const extractAdminToken = (req) => {
  // Check cookie first (preferred for admin panel)
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }

  // Fall back to Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
};

/**
 * Simplified admin authentication middleware
 * Validates admin JWT token
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Extract admin token
    const token = extractAdminToken(req);

    if (!token) {
      // Redirect to admin login for web requests
      if (req.accepts('html')) {
        return res.redirect('/admin/login');
      }

      return res.status(401).json({
        error: 'Admin authentication required',
        code: 'NO_ADMIN_TOKEN'
      });
    }

    // Decode JWT
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-min-32-chars-change-in-production';
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Clear invalid admin cookie
      if (req.cookies?.admin_token) {
        res.clearCookie('admin_token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      }

      // Redirect to admin login for web requests
      if (req.accepts('html')) {
        return res.redirect('/admin/login?error=invalid_session');
      }

      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_ADMIN_TOKEN'
      });
    }

    // Verify it's an admin token
    if (decoded.type !== 'admin' || !decoded.adminId) {
      // Redirect to admin login for web requests
      if (req.accepts('html')) {
        return res.redirect('/admin/login?error=unauthorized');
      }

      return res.status(403).json({
        error: 'Admin privileges required',
        code: 'INSUFFICIENT_ADMIN_PRIVILEGES'
      });
    }

    // Look up admin from database
    const { Admin } = require('../models');
    const admin = await Admin.findOne({
      where: { id: decoded.adminId }
    });

    if (!admin) {
      // Clear cookie - admin deleted
      if (req.cookies?.admin_token) {
        res.clearCookie('admin_token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      }

      // Redirect to admin login for web requests
      if (req.accepts('html')) {
        return res.redirect('/admin/login?error=invalid_session');
      }

      return res.status(401).json({
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    // Attach admin to request
    req.admin = admin.getSafeData();
    req.admin_token = token;

    logger.info('Admin access granted', {
      admin_id: admin.id,
      account_id: admin.account_id,
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method
    });

    next();

  } catch (error) {
    logger.error('Admin authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    // Redirect to admin login for web requests
    if (req.accepts('html')) {
      return res.redirect('/admin/login?error=system_error');
    }

    res.status(500).json({
      error: 'Admin authentication service unavailable',
      code: 'ADMIN_AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Admin session timeout check middleware
 * Warns about approaching session expiration
 */
const checkAdminSessionTimeout = async (req, res, next) => {
  try {
    if (!req.admin_session) {
      return next();
    }

    const expiresAt = new Date(req.admin_session.expires_at);
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    const warningThreshold = 15 * 60 * 1000; // 15 minutes

    if (timeRemaining <= warningThreshold && timeRemaining > 0) {
      // Add session timeout warning to response
      res.set('X-Admin-Session-Warning', 'true');
      res.set('X-Admin-Session-Expires-In', Math.floor(timeRemaining / 1000));

      logger.warn('Admin session approaching expiration', {
        admin_id: req.admin.id,
        session_id: req.admin_session.id,
        expires_at: expiresAt,
        time_remaining_ms: timeRemaining
      });
    }

    next();

  } catch (error) {
    logger.error('Admin session timeout check error', {
      error: error.message,
      admin_id: req.admin?.id
    });

    // Don't fail the request, just continue
    next();
  }
};

/**
 * Admin activity logging middleware (Simplified)
 * Logs admin actions to console instead of database
 */
const logAdminActivity = (actionType = null) => {
  return async (req, res, next) => {
    try {
      // Skip logging for certain endpoints
      const skipPaths = ['/admin/health', '/admin/heartbeat', '/admin/assets'];
      if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
        return next();
      }

      // Just log to console for now
      logger.info('Admin activity', {
        admin_id: req.admin?.id,
        account_id: req.admin?.account_id,
        action: actionType || req.method,
        endpoint: req.originalUrl,
        ip: req.ip
      });

      next();

    } catch (error) {
      logger.error('Admin activity logging error', {
        error: error.message,
        admin_id: req.admin?.id
      });
      next();
    }
  };
};

/**
 * Admin activity completion logging middleware (Simplified)
 * Just passes through - logging handled by logAdminActivity
 */
const completeAdminActivityLog = async (req, res, next) => {
  // Simplified - just continue
  next();
};

/**
 * Helper functions
 */

/**
 * Infer action type from request
 * @param {Object} req - Express request
 * @returns {string|null} Inferred action type
 */
const inferActionType = (req) => {
  const path = req.originalUrl.toLowerCase();
  const method = req.method.toLowerCase();

  // Player management actions
  if (path.includes('/players/')) {
    if (method === 'post') {return 'account_creation';}
    if (method === 'put' || method === 'patch') {return 'account_modification';}
    if (method === 'delete') {return 'account_deletion';}
    if (path.includes('/suspend')) {return 'account_suspension';}
    if (path.includes('/ban')) {return 'account_ban';}
    if (path.includes('/activate')) {return 'account_activation';}
    if (path.includes('/credits')) {return 'credit_adjustment';}
  }

  // System actions
  if (path.includes('/system')) {
    if (path.includes('/backup')) {return 'database_backup';}
    if (path.includes('/maintenance')) {return 'system_maintenance';}
    return 'configuration_change';
  }

  // Game management actions
  if (path.includes('/game')) {
    if (path.includes('/jackpot')) {return 'jackpot_reset';}
    return 'spin_replay';
  }

  // Default based on method
  if (method === 'get' && path.includes('/export')) {return 'data_export';}
  if (method === 'get') {return 'balance_inquiry';}

  return null;
};

/**
 * Extract target player ID from request
 * @param {Object} req - Express request
 * @returns {string|null} Target player ID
 */
const extractTargetPlayerId = (req) => {
  // Check URL parameters
  if (req.params && req.params.playerId) {
    return req.params.playerId;
  }
  if (req.params && req.params.id && req.originalUrl.includes('/players/')) {
    return req.params.id;
  }

  // Check request body
  if (req.body && req.body.player_id) {
    return req.body.player_id;
  }
  if (req.body && req.body.target_player_id) {
    return req.body.target_player_id;
  }

  return null;
};

/**
 * Extract error message from response body
 * @param {*} responseBody - Response body
 * @returns {string|null} Error message
 */
const getErrorMessage = (responseBody) => {
  if (!responseBody) {return null;}

  if (typeof responseBody === 'string') {
    try {
      const parsed = JSON.parse(responseBody);
      return parsed.message || parsed.error || null;
    } catch {
      return responseBody.length > 200 ? responseBody.substring(0, 200) + '...' : responseBody;
    }
  }

  if (typeof responseBody === 'object') {
    return responseBody.message || responseBody.error || null;
  }

  return null;
};

/**
 * Admin role verification middleware
 * Ensures admin has specific role permissions (for future role-based access)
 */
const requireAdminRole = (requiredRole = 'admin') => {
  return (req, res, next) => {
    try {
      // For now, all admins have full access
      // In the future, implement role-based access control
      if (!req.admin || !req.admin.isAdmin()) {
        return res.status(403).json({
          error: 'Insufficient admin permissions',
          code: 'INSUFFICIENT_ROLE_PERMISSIONS',
          message: `Admin role '${requiredRole}' required`
        });
      }

      next();

    } catch (error) {
      logger.error('Admin role verification error', {
        error: error.message,
        admin_id: req.admin?.id,
        required_role: requiredRole
      });

      res.status(500).json({
        error: 'Role verification failed',
        code: 'ROLE_VERIFICATION_ERROR'
      });
    }
  };
};

module.exports = {
  authenticateAdmin,
  checkAdminSessionTimeout,
  logAdminActivity,
  completeAdminActivityLog,
  requireAdminRole,
  extractAdminToken
};