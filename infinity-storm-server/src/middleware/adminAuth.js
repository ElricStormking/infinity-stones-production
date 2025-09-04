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

const SessionManager = require('../auth/sessionManager');
const AdminLog = require('../models/AdminLog');
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
 * Enhanced admin authentication middleware
 * Validates admin JWT token with additional security checks
 */
const authenticateAdmin = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // Extract admin token
    const token = extractAdminToken(req);

    if (!token) {
      await AdminLog.logFailure({
        action_type: 'login_attempt',
        details: {
          error: 'No admin token provided',
          endpoint: req.originalUrl,
          method: req.method
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        severity: 'medium'
      });

      // Redirect to admin login for web requests
      if (req.accepts('html')) {
        return res.redirect('/admin/login');
      }

      return res.status(401).json({
        error: 'Admin authentication required',
        code: 'NO_ADMIN_TOKEN',
        message: 'Admin access token is required'
      });
    }

    // Validate session with enhanced checks
    const validation = await SessionManager.validateSession(token, {
      requireAdmin: true,
      checkIPConsistency: true,
      updateLastActivity: true
    });

    if (!validation.valid) {
      // Log failed admin authentication
      await AdminLog.logFailure({
        action_type: 'login_attempt',
        details: {
          error: validation.error,
          endpoint: req.originalUrl,
          method: req.method,
          token_expired: validation.error?.includes('expired'),
          invalid_token: validation.error?.includes('invalid')
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        severity: 'high'
      });

      logger.warn('Admin authentication failed', {
        error: validation.error,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        responseTime: Date.now() - startTime
      });

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
        error: 'Admin authentication failed',
        code: 'INVALID_ADMIN_TOKEN',
        message: validation.error
      });
    }

    // Verify admin privileges
    if (!validation.player.isAdmin()) {
      await AdminLog.logFailure({
        admin_id: validation.player.id,
        action_type: 'security_event',
        details: {
          error: 'Non-admin user attempted admin access',
          endpoint: req.originalUrl,
          method: req.method,
          player_id: validation.player.id,
          username: validation.player.username,
          is_admin: validation.player.is_admin,
          account_status: validation.player.status
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        severity: 'critical'
      });

      logger.error('Non-admin user attempted admin access', {
        player_id: validation.player.id,
        username: validation.player.username,
        is_admin: validation.player.is_admin,
        status: validation.player.status,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      // Redirect to main game for web requests
      if (req.accepts('html')) {
        return res.redirect('/?error=unauthorized');
      }

      return res.status(403).json({
        error: 'Admin privileges required',
        code: 'INSUFFICIENT_ADMIN_PRIVILEGES',
        message: 'This endpoint requires active administrator access'
      });
    }

    // IP consistency check for enhanced security
    if (validation.session.ip_address && validation.session.ip_address !== req.ip) {
      await AdminLog.logFailure({
        admin_id: validation.player.id,
        action_type: 'security_event',
        details: {
          error: 'Admin IP address mismatch',
          session_ip: validation.session.ip_address,
          request_ip: req.ip,
          endpoint: req.originalUrl,
          session_id: validation.session.id
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        severity: 'high'
      });

      logger.warn('Admin IP address mismatch detected', {
        admin_id: validation.player.id,
        username: validation.player.username,
        session_ip: validation.session.ip_address,
        request_ip: req.ip,
        endpoint: req.originalUrl
      });

      // For high-security environments, you might want to terminate the session
      // For now, just log and continue with a warning
    }

    // Attach admin user and session data to request
    req.admin = validation.player;
    req.admin_session = validation.session;
    req.admin_token = token;

    // Add admin-specific response headers
    res.set('X-Admin-Session-ID', validation.session.id);
    res.set('X-Admin-Session-Expires', validation.session.expires_at);

    // Log successful admin access (for audit trail)
    logger.info('Admin access granted', {
      admin_id: req.admin.id,
      username: req.admin.username,
      session_id: req.admin_session.id,
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method,
      responseTime: Date.now() - startTime
    });

    next();

  } catch (error) {
    logger.error('Admin authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      responseTime: Date.now() - startTime
    });

    // Log system error
    await AdminLog.logFailure({
      action_type: 'security_event',
      details: {
        error: 'Admin authentication system error',
        system_error: error.message,
        endpoint: req.originalUrl
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'critical',
      error_message: error.message
    }).catch(() => {}); // Don't fail if logging fails

    // Redirect to admin login for web requests
    if (req.accepts('html')) {
      return res.redirect('/admin/login?error=system_error');
    }

    res.status(500).json({
      error: 'Admin authentication service unavailable',
      code: 'ADMIN_AUTH_SERVICE_ERROR',
      message: 'Please try again in a moment'
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
 * Admin activity logging middleware
 * Logs all admin actions for audit trail
 */
const logAdminActivity = (actionType = null) => {
  return async (req, res, next) => {
    try {
      // Skip logging for certain endpoints (like health checks)
      const skipPaths = ['/admin/health', '/admin/heartbeat', '/admin/assets'];
      if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
        return next();
      }

      // Determine action type from request
      const inferredActionType = actionType || inferActionType(req);

      if (inferredActionType) {
        // Store activity logging info for after response
        req.adminActivityLog = {
          action_type: inferredActionType,
          details: {
            endpoint: req.originalUrl,
            method: req.method,
            query_params: req.query,
            user_agent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          }
        };
      }

      next();

    } catch (error) {
      logger.error('Admin activity logging middleware error', {
        error: error.message,
        admin_id: req.admin?.id
      });

      // Don't fail the request
      next();
    }
  };
};

/**
 * Admin activity completion logging middleware
 * Logs the result of admin actions after response
 */
const completeAdminActivityLog = async (req, res, next) => {
  try {
    // Capture response information
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(body) {
      res.responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function(obj) {
      res.responseBody = obj;
      return originalJson.call(this, obj);
    };

    // Log after response is sent
    res.on('finish', async () => {
      try {
        if (req.adminActivityLog && req.admin) {
          const isSuccess = res.statusCode < 400;
          const details = {
            ...req.adminActivityLog.details,
            response_status: res.statusCode,
            response_time: Date.now() - req.startTime
          };

          // Add response body for errors or important actions
          if (!isSuccess || req.adminActivityLog.action_type.includes('deletion') ||
                        req.adminActivityLog.action_type.includes('suspension')) {
            details.response_body = res.responseBody;
          }

          await AdminLog.logAction({
            admin_id: req.admin.id,
            action_type: req.adminActivityLog.action_type,
            target_player_id: extractTargetPlayerId(req),
            details: details,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            result: isSuccess ? 'success' : 'failure',
            error_message: !isSuccess ? getErrorMessage(res.responseBody) : null
          });
        }
      } catch (error) {
        logger.error('Admin activity completion logging error', {
          error: error.message,
          admin_id: req.admin?.id
        });
      }
    });

    next();

  } catch (error) {
    logger.error('Admin activity completion middleware error', {
      error: error.message
    });
    next();
  }
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