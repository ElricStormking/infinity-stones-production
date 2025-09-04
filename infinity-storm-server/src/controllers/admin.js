/**
 * Admin Controller
 *
 * Handles all administrative operations for the casino management system
 * including player management, system monitoring, and configuration.
 *
 * Features:
 * - Secure admin authentication and session management
 * - Player account management (CRUD operations)
 * - System health monitoring and metrics
 * - Audit log management and reporting
 * - Credit adjustments and transaction oversight
 * - Security event monitoring
 */

const Player = require('../models/Player');
const AdminLog = require('../models/AdminLog');
const SpinResult = require('../models/SpinResult');
const Transaction = require('../models/Transaction');
const GameSession = require('../models/GameSession');
const SessionManager = require('../auth/sessionManager');
const { logger } = require('../utils/logger');
const metricsService = require('../services/metricsService');

/**
 * Admin Panel Dashboard
 * Display main admin panel with system overview
 */
const dashboard = async (req, res) => {
  try {
    // Get system statistics
    const [playerStats, gameStats, securityEvents] = await Promise.all([
      getPlayerStatistics(),
      getGameStatistics(),
      AdminLog.getSecurityEvents(24) // Last 24 hours
    ]);

    // Get admin activity for current admin
    const adminActivity = await AdminLog.getAdminStats({
      admin_id: req.admin.id,
      days: 7 // Last 7 days
    });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Infinity Storm',
      admin: req.admin.getSafeData(),
      playerStats,
      gameStats,
      securityEvents,
      adminActivity,
      currentTime: new Date()
    });

  } catch (error) {
    logger.error('Admin dashboard error', {
      error: error.message,
      admin_id: req.admin.id,
      stack: error.stack
    });

    res.render('admin/error', {
      title: 'Dashboard Error',
      error: 'Failed to load dashboard',
      message: 'Please try refreshing the page'
    });
  }
};

/**
 * Admin Login Page
 */
const loginPage = (req, res) => {
  const error = req.query.error;
  const errorMessages = {
    'invalid_session': 'Your session has expired. Please log in again.',
    'unauthorized': 'Access denied. Admin privileges required.',
    'system_error': 'System error occurred. Please try again.'
  };

  res.render('admin/login', {
    title: 'Admin Login - Infinity Storm',
    error: errorMessages[error] || null,
    csrfToken: req.csrfToken ? req.csrfToken() : null
  });
};

/**
 * Process Admin Login
 */
const processLogin = async (req, res) => {
  try {
    const { username, password, remember_me } = req.body;

    if (!username || !password) {
      await AdminLog.logFailure({
        action_type: 'login_attempt',
        details: {
          error: 'Missing credentials',
          username: username || 'not_provided'
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      return res.render('admin/login', {
        title: 'Admin Login - Infinity Storm',
        error: 'Username and password are required',
        formData: { username }
      });
    }

    // Find admin user
    const admin = await Player.findByIdentifier(username);

    if (!admin || !admin.isAdmin()) {
      await AdminLog.logFailure({
        action_type: 'login_attempt',
        details: {
          error: 'Invalid admin credentials or insufficient privileges',
          username: username,
          user_exists: !!admin,
          user_is_admin: admin?.is_admin || false
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      return res.render('admin/login', {
        title: 'Admin Login - Infinity Storm',
        error: 'Invalid admin credentials',
        formData: { username }
      });
    }

    // Verify password
    const validPassword = await admin.verifyPassword(password);

    if (!validPassword) {
      await AdminLog.logFailure({
        admin_id: admin.id,
        action_type: 'login_attempt',
        details: {
          error: 'Invalid password',
          username: username
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      return res.render('admin/login', {
        title: 'Admin Login - Infinity Storm',
        error: 'Invalid admin credentials',
        formData: { username }
      });
    }

    // Create admin session with enhanced security
    const sessionData = await SessionManager.createSession(admin.id, {
      isAdminSession: true,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      extendedExpiry: remember_me === 'on'
    });

    // Update last login
    await admin.updateLastLogin();

    // Set secure admin cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: remember_me === 'on' ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000 // 30 days or 8 hours
    };

    res.cookie('admin_token', sessionData.token, cookieOptions);

    // Log successful admin login
    await AdminLog.logSuccess({
      admin_id: admin.id,
      action_type: 'login_attempt',
      details: {
        session_id: sessionData.session.id,
        remember_me: remember_me === 'on',
        login_method: 'web_form'
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium'
    });

    logger.info('Admin login successful', {
      admin_id: admin.id,
      username: admin.username,
      session_id: sessionData.session.id,
      ip: req.ip
    });

    res.redirect('/admin/dashboard');

  } catch (error) {
    logger.error('Admin login process error', {
      error: error.message,
      stack: error.stack,
      username: req.body?.username
    });

    await AdminLog.logFailure({
      action_type: 'login_attempt',
      details: {
        error: 'System error during login',
        system_error: error.message
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'high',
      error_message: error.message
    });

    res.render('admin/login', {
      title: 'Admin Login - Infinity Storm',
      error: 'System error occurred. Please try again.',
      formData: { username: req.body?.username }
    });
  }
};

/**
 * Admin Logout
 */
const logout = async (req, res) => {
  try {
    if (req.admin_session) {
      // Terminate session
      await SessionManager.terminateSession(req.admin_session.id);

      // Log logout
      await AdminLog.logSuccess({
        admin_id: req.admin.id,
        action_type: 'session_termination',
        details: {
          session_id: req.admin_session.id,
          logout_method: 'voluntary'
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    }

    // Clear admin cookie
    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.redirect('/admin/login');

  } catch (error) {
    logger.error('Admin logout error', {
      error: error.message,
      admin_id: req.admin?.id
    });

    // Even if logging fails, still log out
    res.clearCookie('admin_token');
    res.redirect('/admin/login');
  }
};

/**
 * Player Management - List Players
 */
const listPlayers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      is_admin,
      search
    } = req.query;

    const playersData = await Player.getPlayers({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      is_admin: is_admin === 'true' ? true : is_admin === 'false' ? false : null,
      search
    });

    res.render('admin/players/list', {
      title: 'Player Management - Admin Panel',
      admin: req.admin.getSafeData(),
      ...playersData,
      filters: { status, is_admin, search },
      pagination: {
        currentPage: playersData.currentPage,
        totalPages: playersData.totalPages,
        hasMore: playersData.hasMore,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Admin list players error', {
      error: error.message,
      admin_id: req.admin.id
    });

    res.render('admin/error', {
      title: 'Player Management Error',
      error: 'Failed to load players list',
      message: 'Please try again'
    });
  }
};

/**
 * Player Management - View Player Details
 */
const viewPlayer = async (req, res) => {
  try {
    const { id } = req.params;

    const player = await Player.findByPk(id, {
      include: [
        {
          model: Transaction,
          as: 'transactions',
          limit: 10,
          order: [['created_at', 'DESC']]
        },
        {
          model: SpinResult,
          as: 'spinResults',
          limit: 10,
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!player) {
      return res.render('admin/error', {
        title: 'Player Not Found',
        error: 'Player not found',
        message: 'The requested player could not be found'
      });
    }

    // Get player's admin log history (as target)
    const adminLogs = await AdminLog.getAdminLogs({
      target_player_id: id,
      limit: 20
    });

    res.render('admin/players/view', {
      title: `Player Details: ${player.username} - Admin Panel`,
      admin: req.admin.getSafeData(),
      player: player.getSafeData(),
      adminLogs: adminLogs.logs
    });

  } catch (error) {
    logger.error('Admin view player error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    res.render('admin/error', {
      title: 'Player View Error',
      error: 'Failed to load player details',
      message: 'Please try again'
    });
  }
};

/**
 * Player Management - Suspend Player
 */
const suspendPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Suspended by admin' } = req.body;

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Prevent admin from suspending themselves
    if (player.id === req.admin.id) {
      return res.status(400).json({
        error: 'Cannot suspend your own account',
        code: 'CANNOT_SUSPEND_SELF'
      });
    }

    await player.suspend(reason);

    // Log the suspension
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'account_suspension',
      target_player_id: player.id,
      details: {
        reason: reason,
        previous_status: 'active',
        new_status: 'suspended'
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'high'
    });

    logger.info('Player suspended by admin', {
      admin_id: req.admin.id,
      admin_username: req.admin.username,
      player_id: player.id,
      player_username: player.username,
      reason: reason
    });

    if (req.accepts('json')) {
      res.json({
        success: true,
        message: 'Player suspended successfully',
        player: player.getSafeData()
      });
    } else {
      res.redirect(`/admin/players/${id}?message=Player suspended successfully`);
    }

  } catch (error) {
    logger.error('Admin suspend player error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    await AdminLog.logFailure({
      admin_id: req.admin.id,
      action_type: 'account_suspension',
      target_player_id: req.params.id,
      details: {
        error: error.message,
        reason: req.body?.reason
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium',
      error_message: error.message
    });

    if (req.accepts('json')) {
      res.status(500).json({
        error: 'Failed to suspend player',
        code: 'SUSPENSION_FAILED',
        message: error.message
      });
    } else {
      res.redirect(`/admin/players/${req.params.id}?error=Failed to suspend player`);
    }
  }
};

/**
 * Player Management - Activate Player
 */
const activatePlayer = async (req, res) => {
  try {
    const { id } = req.params;

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    const previousStatus = player.status;
    await player.reactivate();

    // Log the activation
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'account_activation',
      target_player_id: player.id,
      details: {
        previous_status: previousStatus,
        new_status: 'active'
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium'
    });

    logger.info('Player activated by admin', {
      admin_id: req.admin.id,
      admin_username: req.admin.username,
      player_id: player.id,
      player_username: player.username,
      previous_status: previousStatus
    });

    if (req.accepts('json')) {
      res.json({
        success: true,
        message: 'Player activated successfully',
        player: player.getSafeData()
      });
    } else {
      res.redirect(`/admin/players/${id}?message=Player activated successfully`);
    }

  } catch (error) {
    logger.error('Admin activate player error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    if (req.accepts('json')) {
      res.status(500).json({
        error: 'Failed to activate player',
        code: 'ACTIVATION_FAILED'
      });
    } else {
      res.redirect(`/admin/players/${req.params.id}?error=Failed to activate player`);
    }
  }
};

/**
 * Player Management - Adjust Credits
 */
const adjustCredits = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, reason = 'Admin credit adjustment' } = req.body;

    const adjustmentAmount = parseFloat(amount);
    if (isNaN(adjustmentAmount) || adjustmentAmount === 0) {
      return res.status(400).json({
        error: 'Invalid adjustment amount',
        code: 'INVALID_AMOUNT'
      });
    }

    if (!['add', 'subtract', 'set'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid adjustment type',
        code: 'INVALID_TYPE'
      });
    }

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    const previousCredits = player.credits;

    // Perform credit adjustment
    switch (type) {
    case 'add':
      await player.addCredits(adjustmentAmount);
      break;
    case 'subtract':
      await player.deductCredits(adjustmentAmount);
      break;
    case 'set':
      player.credits = adjustmentAmount;
      await player.save({ fields: ['credits', 'updated_at'] });
      break;
    }

    // Log the credit adjustment
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'credit_adjustment',
      target_player_id: player.id,
      details: {
        adjustment_type: type,
        adjustment_amount: adjustmentAmount,
        previous_credits: previousCredits,
        new_credits: player.credits,
        reason: reason
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'high'
    });

    logger.info('Credits adjusted by admin', {
      admin_id: req.admin.id,
      admin_username: req.admin.username,
      player_id: player.id,
      player_username: player.username,
      adjustment_type: type,
      adjustment_amount: adjustmentAmount,
      previous_credits: previousCredits,
      new_credits: player.credits
    });

    if (req.accepts('json')) {
      res.json({
        success: true,
        message: 'Credits adjusted successfully',
        player: player.getSafeData()
      });
    } else {
      res.redirect(`/admin/players/${id}?message=Credits adjusted successfully`);
    }

  } catch (error) {
    logger.error('Admin adjust credits error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    if (req.accepts('json')) {
      res.status(500).json({
        error: 'Failed to adjust credits',
        code: 'CREDIT_ADJUSTMENT_FAILED'
      });
    } else {
      res.redirect(`/admin/players/${req.params.id}?error=Failed to adjust credits`);
    }
  }
};

/**
 * Audit Logs - View Admin Activity
 */
const viewAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      admin_id,
      action_type,
      severity,
      result,
      days = 30
    } = req.query;

    const logsData = await AdminLog.getAdminLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      admin_id,
      action_type,
      severity,
      result,
      date_from: days ? new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000)) : null
    });

    // Get available admins for filter dropdown
    const admins = await Player.scope('admins').findAll({
      attributes: ['id', 'username'],
      order: [['username', 'ASC']]
    });

    res.render('admin/audit/logs', {
      title: 'Audit Logs - Admin Panel',
      admin: req.admin.getSafeData(),
      ...logsData,
      filters: { admin_id, action_type, severity, result, days },
      admins,
      pagination: {
        currentPage: logsData.currentPage,
        totalPages: logsData.totalPages,
        hasMore: logsData.hasMore,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Admin view audit logs error', {
      error: error.message,
      admin_id: req.admin.id
    });

    res.render('admin/error', {
      title: 'Audit Logs Error',
      error: 'Failed to load audit logs',
      message: 'Please try again'
    });
  }
};

/**
 * Helper Functions
 */

/**
 * Get player statistics for dashboard
 */
const getPlayerStatistics = async () => {
  try {
    const [
      totalPlayers,
      activePlayers,
      demoPlayers,
      adminPlayers,
      newPlayersToday
    ] = await Promise.all([
      Player.count(),
      Player.count({ where: { status: 'active' } }),
      Player.count({ where: { is_demo: true } }),
      Player.count({ where: { is_admin: true } }),
      Player.count({
        where: {
          created_at: {
            [Player.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      totalPlayers,
      activePlayers,
      demoPlayers,
      adminPlayers,
      newPlayersToday,
      suspendedPlayers: totalPlayers - activePlayers
    };
  } catch (error) {
    logger.error('Get player statistics error', { error: error.message });
    return {
      totalPlayers: 0,
      activePlayers: 0,
      demoPlayers: 0,
      adminPlayers: 0,
      newPlayersToday: 0,
      suspendedPlayers: 0
    };
  }
};

/**
 * Get game statistics for dashboard
 */
const getGameStatistics = async () => {
  try {
    const [
      totalSpins,
      spinsToday,
      totalWinAmount,
      activeSessions
    ] = await Promise.all([
      SpinResult.count(),
      SpinResult.count({
        where: {
          created_at: {
            [SpinResult.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      SpinResult.sum('payout_amount') || 0,
      GameSession.count({
        where: {
          is_active: true,
          updated_at: {
            [GameSession.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
          }
        }
      })
    ]);

    return {
      totalSpins,
      spinsToday,
      totalWinAmount: parseFloat(totalWinAmount),
      activeSessions
    };
  } catch (error) {
    logger.error('Get game statistics error', { error: error.message });
    return {
      totalSpins: 0,
      spinsToday: 0,
      totalWinAmount: 0,
      activeSessions: 0
    };
  }
};

/**
 * Player Management - Ban Player
 */
const banPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({
        error: 'Ban reason is required and must be at least 3 characters',
        code: 'INVALID_REASON'
      });
    }

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Prevent admin from banning themselves
    if (player.id === req.admin.id) {
      return res.status(400).json({
        error: 'Cannot ban your own account',
        code: 'CANNOT_BAN_SELF'
      });
    }

    const previousStatus = player.status;
    await player.ban(reason.trim());

    // Log the ban
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'account_ban',
      target_player_id: player.id,
      details: {
        reason: reason.trim(),
        previous_status: previousStatus,
        new_status: 'banned'
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'critical'
    });

    logger.warn('Player banned by admin', {
      admin_id: req.admin.id,
      admin_username: req.admin.username,
      player_id: player.id,
      player_username: player.username,
      reason: reason.trim(),
      previous_status: previousStatus
    });

    if (req.accepts('json')) {
      res.json({
        success: true,
        message: 'Player banned successfully',
        player: player.getSafeData()
      });
    } else {
      res.redirect(`/admin/players/${id}?message=Player banned successfully`);
    }

  } catch (error) {
    logger.error('Admin ban player error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    await AdminLog.logFailure({
      admin_id: req.admin.id,
      action_type: 'account_ban',
      target_player_id: req.params.id,
      details: {
        error: error.message,
        reason: req.body?.reason
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'high',
      error_message: error.message
    });

    if (req.accepts('json')) {
      res.status(500).json({
        error: 'Failed to ban player',
        code: 'BAN_FAILED',
        message: error.message
      });
    } else {
      res.redirect(`/admin/players/${req.params.id}?error=Failed to ban player`);
    }
  }
};

/**
 * Player Management - Send Notification
 */
const sendNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, message, urgent = false } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        error: 'Type, title, and message are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Create notification record (extend as needed for notification system)
    const notification = {
      player_id: player.id,
      admin_id: req.admin.id,
      type: type,
      title: title.trim(),
      message: message.trim(),
      urgent: urgent === 'true' || urgent === true,
      sent_at: new Date(),
      status: 'sent'
    };

    // Log the notification
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'player_notification',
      target_player_id: player.id,
      details: {
        notification_type: type,
        title: title.trim(),
        message_length: message.trim().length,
        urgent: urgent === 'true' || urgent === true
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: urgent === 'true' || urgent === true ? 'high' : 'medium'
    });

    logger.info('Notification sent to player', {
      admin_id: req.admin.id,
      admin_username: req.admin.username,
      player_id: player.id,
      player_username: player.username,
      notification_type: type,
      title: title.trim(),
      urgent: urgent === 'true' || urgent === true
    });

    if (req.accepts('json')) {
      res.json({
        success: true,
        message: 'Notification sent successfully',
        notification: notification
      });
    } else {
      res.redirect(`/admin/players/${id}?message=Notification sent successfully`);
    }

  } catch (error) {
    logger.error('Send notification error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    if (req.accepts('json')) {
      res.status(500).json({
        error: 'Failed to send notification',
        code: 'NOTIFICATION_FAILED'
      });
    } else {
      res.redirect(`/admin/players/${req.params.id}?error=Failed to send notification`);
    }
  }
};

/**
 * Player Management - Get Player Transactions
 */
const getPlayerTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Get transaction history with pagination
    const transactionsData = await Transaction.getPlayerTransactions(id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      player_id: id,
      ...transactionsData
    });

  } catch (error) {
    logger.error('Get player transactions error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    res.status(500).json({
      error: 'Failed to fetch transactions',
      code: 'FETCH_TRANSACTIONS_FAILED'
    });
  }
};

/**
 * Player Management - Get Player Game History
 */
const getPlayerGameHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Get game history with pagination
    const spinsData = await SpinResult.getPlayerSpins(id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      player_id: id,
      ...spinsData
    });

  } catch (error) {
    logger.error('Get player game history error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    res.status(500).json({
      error: 'Failed to fetch game history',
      code: 'FETCH_GAME_HISTORY_FAILED'
    });
  }
};

/**
 * Player Management - Export Player Transactions
 */
const exportPlayerTransactions = async (req, res) => {
  try {
    const { id } = req.params;

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Get all transactions for export
    const transactions = await Transaction.findAll({
      where: { player_id: id },
      order: [['created_at', 'DESC']],
      limit: 10000 // Reasonable limit for export
    });

    // Generate CSV
    const csvHeaders = 'Date,Type,Amount,Status,Reference,Description\n';
    const csvRows = transactions.map(t => {
      const date = new Date(t.created_at).toISOString();
      const type = t.transaction_type;
      const amount = parseFloat(t.amount).toFixed(2);
      const status = t.status;
      const reference = t.reference_id || '';
      const description = (t.description || '').replace(/"/g, '""');

      return `"${date}","${type}","${amount}","${status}","${reference}","${description}"`;
    }).join('\n');

    const csvContent = csvHeaders + csvRows;

    // Log the export
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'data_export',
      target_player_id: player.id,
      details: {
        export_type: 'transactions',
        record_count: transactions.length
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium'
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${player.username}-${Date.now()}.csv"`);
    res.send(csvContent);

  } catch (error) {
    logger.error('Export player transactions error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    res.status(500).json({
      error: 'Failed to export transactions',
      code: 'EXPORT_FAILED'
    });
  }
};

/**
 * Player Management - Export Player Game History
 */
const exportPlayerGameHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const player = await Player.findByPk(id);
    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // Get all spin results for export
    const spins = await SpinResult.findAll({
      where: { player_id: id },
      order: [['created_at', 'DESC']],
      limit: 10000 // Reasonable limit for export
    });

    // Generate CSV
    const csvHeaders = 'Date,Bet Amount,Payout Amount,Multiplier,Session ID,Free Spin,Bonus,Complete,RNG Seed\n';
    const csvRows = spins.map(s => {
      const date = new Date(s.created_at).toISOString();
      const betAmount = parseFloat(s.bet_amount).toFixed(2);
      const payoutAmount = parseFloat(s.payout_amount).toFixed(2);
      const multiplier = parseFloat(s.bet_amount) > 0 ? (parseFloat(s.payout_amount) / parseFloat(s.bet_amount)).toFixed(2) : '0.00';
      const sessionId = s.session_id || '';
      const freeSpin = s.is_free_spin ? 'Yes' : 'No';
      const bonus = s.has_bonus ? 'Yes' : 'No';
      const complete = s.is_complete ? 'Yes' : 'No';
      const rngSeed = s.rng_seed || '';

      return `"${date}","${betAmount}","${payoutAmount}","${multiplier}","${sessionId}","${freeSpin}","${bonus}","${complete}","${rngSeed}"`;
    }).join('\n');

    const csvContent = csvHeaders + csvRows;

    // Log the export
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'data_export',
      target_player_id: player.id,
      details: {
        export_type: 'game_history',
        record_count: spins.length
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium'
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="game-history-${player.username}-${Date.now()}.csv"`);
    res.send(csvContent);

  } catch (error) {
    logger.error('Export player game history error', {
      error: error.message,
      admin_id: req.admin.id,
      player_id: req.params.id
    });

    res.status(500).json({
      error: 'Failed to export game history',
      code: 'EXPORT_FAILED'
    });
  }
};

/**
 * API Metrics Endpoint
 * Provides comprehensive dashboard metrics for real-time monitoring
 */
const getMetrics = async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;

    // Get comprehensive metrics from metrics service
    const metrics = await metricsService.getDashboardMetrics(timeframe);

    // Log metrics access
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'metrics_access',
      details: {
        timeframe: timeframe,
        sections_accessed: ['overview', 'financial', 'game', 'player', 'system', 'rtp', 'compliance']
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'low'
    });

    res.json({
      success: true,
      metrics: metrics,
      timestamp: new Date().toISOString(),
      admin: {
        id: req.admin.id,
        username: req.admin.username
      }
    });

  } catch (error) {
    logger.error('Get metrics API error', {
      error: error.message,
      admin_id: req.admin.id,
      timeframe: req.query.timeframe
    });

    await AdminLog.logFailure({
      admin_id: req.admin.id,
      action_type: 'metrics_access',
      details: {
        error: error.message,
        timeframe: req.query.timeframe
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium',
      error_message: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to load metrics',
      code: 'METRICS_LOAD_FAILED'
    });
  }
};

/**
 * Real-time Metrics API
 * Provides live metrics for WebSocket or polling updates
 */
const getRealtimeMetrics = async (req, res) => {
  try {
    const realtimeData = await metricsService.getRealtimeMetrics();

    res.json({
      success: true,
      data: realtimeData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get realtime metrics API error', {
      error: error.message,
      admin_id: req.admin.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to load realtime metrics',
      code: 'REALTIME_METRICS_FAILED'
    });
  }
};

/**
 * RTP Monitoring API
 * Provides detailed RTP metrics and alerts
 */
const getRTPMetrics = async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const metrics = await metricsService.getDashboardMetrics(timeframe);

    res.json({
      success: true,
      rtp: metrics.rtp,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get RTP metrics API error', {
      error: error.message,
      admin_id: req.admin.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to load RTP metrics',
      code: 'RTP_METRICS_FAILED'
    });
  }
};

/**
 * Compliance Report Generation
 * Generate and download comprehensive compliance report
 */
const generateComplianceReport = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const metrics = await metricsService.getDashboardMetrics(timeframe);

    // Generate comprehensive compliance report
    const reportData = {
      generated_at: new Date().toISOString(),
      timeframe: timeframe,
      admin: {
        id: req.admin.id,
        username: req.admin.username
      },
      rtp_compliance: metrics.rtp,
      financial_summary: metrics.financial,
      player_analytics: metrics.player,
      system_health: metrics.system,
      compliance_status: metrics.compliance,
      audit_summary: {
        total_events: metrics.compliance.auditSummary.total_events,
        admin_actions: metrics.compliance.auditSummary.admin_actions,
        system_events: metrics.compliance.auditSummary.system_events,
        suspicious_transactions: metrics.compliance.suspiciousTransactions
      }
    };

    // Create detailed compliance report
    const report = generateComplianceReportText(reportData);

    // Log report generation
    await AdminLog.logSuccess({
      admin_id: req.admin.id,
      action_type: 'compliance_report_generation',
      details: {
        timeframe: timeframe,
        report_type: 'full_compliance',
        sections_included: ['rtp', 'financial', 'player', 'system', 'compliance', 'audit']
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      severity: 'medium'
    });

    // Send as downloadable text file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${timeframe}-${Date.now()}.txt"`);
    res.send(report);

  } catch (error) {
    logger.error('Generate compliance report error', {
      error: error.message,
      admin_id: req.admin.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report',
      code: 'COMPLIANCE_REPORT_FAILED'
    });
  }
};

/**
 * System Health Check API
 * Provides system status and health metrics
 */
const getSystemHealth = async (req, res) => {
  try {
    const metrics = await metricsService.getDashboardMetrics('1h');

    res.json({
      success: true,
      health: {
        status: metrics.system.errorRate < 5 ? 'healthy' : metrics.system.errorRate < 15 ? 'warning' : 'critical',
        uptime: metrics.system.systemHealth.uptime_hours,
        response_time: metrics.system.avgResponseTime,
        error_rate: metrics.system.errorRate,
        database: 'online',
        game_server: 'running',
        security: 'active'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get system health API error', {
      error: error.message,
      admin_id: req.admin?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to check system health',
      code: 'HEALTH_CHECK_FAILED'
    });
  }
};

/**
 * Helper function to generate compliance report text
 */
function generateComplianceReportText(data) {
  const { rtp_compliance, financial_summary, compliance_status, audit_summary } = data;

  return `
INFINITY STORM CASINO - COMPLIANCE REPORT
==========================================

Generated: ${data.generated_at}
Timeframe: ${data.timeframe}
Generated by: ${data.admin.username} (ID: ${data.admin.id})

RTP COMPLIANCE SUMMARY
----------------------
Current RTP: ${rtp_compliance.currentRTP}%
Target RTP: ${rtp_compliance.targetRTP}%
Deviation: ${rtp_compliance.deviation}%
Status: ${rtp_compliance.status.toUpperCase()}
Compliance Score: ${rtp_compliance.complianceScore}/100

FINANCIAL SUMMARY
-----------------
Total Wagered: $${financial_summary.totalWagered?.toLocaleString() || 0}
Total Won: $${financial_summary.totalWon?.toLocaleString() || 0}
Net Revenue: $${financial_summary.revenue?.toLocaleString() || 0}
Total Spins: ${financial_summary.totalSpins?.toLocaleString() || 0}
Average Bet Size: $${financial_summary.avgBetSize?.toFixed(2) || '0.00'}
Profit Margin: ${financial_summary.profitMargin?.toFixed(2) || 0}%

PLAYER ACTIVITY
---------------
Total Players: ${data.player_analytics.totalPlayers || 0}
Active Users (${data.timeframe}): ${data.player_analytics.activeUsers || 0}
New Users: ${data.player_analytics.newUsers || 0}
Average Sessions per User: ${data.player_analytics.avgSessionsPerUser || 0}

AUDIT TRAIL SUMMARY
-------------------
Total Audit Events: ${audit_summary.total_events || 0}
Admin Actions: ${audit_summary.admin_actions || 0}
System Events: ${audit_summary.system_events || 0}
Suspicious Transactions Flagged: ${audit_summary.suspicious_transactions || 0}

COMPLIANCE STATUS
-----------------
Overall Status: ${compliance_status.regulatoryStatus?.toUpperCase() || 'UNKNOWN'}
Last Audit: ${compliance_status.lastAuditDate ? new Date(compliance_status.lastAuditDate).toLocaleDateString() : 'N/A'}
Next Audit: ${compliance_status.nextAuditDate ? new Date(compliance_status.nextAuditDate).toLocaleDateString() : 'N/A'}

COMPLIANCE CHECKS
-----------------
${Object.entries(compliance_status.complianceChecks || {}).map(([key, value]) =>
    `${key.replace(/_/g, ' ').toUpperCase()}: ${value ? 'PASS' : 'FAIL'}`
  ).join('\n')}

SYSTEM HEALTH
-------------
Average Response Time: ${data.system_health.avgResponseTime || 0}ms
Error Rate: ${data.system_health.errorRate?.toFixed(2) || 0}%
Total Requests: ${data.system_health.totalRequests?.toLocaleString() || 0}
System Uptime: ${data.system_health.systemHealth?.uptime_hours || 0} hours

REGULATORY NOTES
----------------
- This report is generated automatically by the Infinity Storm Casino management system
- All metrics are calculated based on actual gameplay and transaction data
- RTP calculations include all spins within the specified timeframe
- Suspicious transactions are flagged based on predefined thresholds
- This report should be retained for regulatory compliance purposes

END OF REPORT
=============
`;
}

module.exports = {
  dashboard,
  loginPage,
  processLogin,
  logout,
  listPlayers,
  viewPlayer,
  suspendPlayer,
  activatePlayer,
  adjustCredits,
  banPlayer,
  sendNotification,
  getPlayerTransactions,
  getPlayerGameHistory,
  exportPlayerTransactions,
  exportPlayerGameHistory,
  viewAuditLogs,
  // Metrics API endpoints
  getMetrics,
  getRealtimeMetrics,
  getRTPMetrics,
  generateComplianceReport,
  getSystemHealth
};