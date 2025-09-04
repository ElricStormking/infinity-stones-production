/**
 * AdminLog.js - Sequelize Model for Admin Logs Table
 *
 * Complete audit trail for all administrative actions with detailed
 * logging, IP tracking, and comprehensive search capabilities.
 *
 * Features:
 * - Complete audit trail for all admin actions
 * - IP address and user agent tracking
 * - JSON storage for detailed action parameters
 * - Admin action categorization and validation
 * - Target player tracking for player-specific actions
 * - Comprehensive search and filtering capabilities
 * - Security event logging for compliance
 */

const { DataTypes, Model } = require('sequelize');

class AdminLog extends Model {
  /**
     * Initialize the AdminLog model with database connection
     */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique admin log entry identifier'
      },

      admin_id: {
        type: DataTypes.UUID,
        allowNull: true, // Allow null for system-generated actions
        references: {
          model: 'players',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'Admin user who performed the action (null for system actions)'
      },

      action_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          isIn: {
            args: [[
              'credit_adjustment', 'account_suspension', 'account_activation',
              'account_ban', 'password_reset', 'balance_inquiry',
              'session_termination', 'account_deletion', 'permission_change',
              'jackpot_reset', 'jackpot_award', 'system_maintenance',
              'database_backup', 'security_event', 'login_attempt',
              'data_export', 'configuration_change', 'spin_replay',
              'transaction_review', 'player_verification'
            ]],
            msg: 'Invalid action type'
          }
        },
        comment: 'Type of administrative action performed'
      },

      target_player_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'players',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'Player who was the target of the action (if applicable)'
      },

      details: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        validate: {
          isValidJSON(value) {
            if (value !== null && typeof value !== 'object') {
              throw new Error('Details must be a valid JSON object or null');
            }
          }
        },
        comment: 'Detailed information about the action in JSON format'
      },

      ip_address: {
        type: DataTypes.INET,
        allowNull: true,
        validate: {
          isIP: {
            msg: 'Must be a valid IP address'
          }
        },
        comment: 'IP address from which the action was performed'
      },

      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent string of the admin client'
      },

      severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium',
        validate: {
          isIn: {
            args: [['low', 'medium', 'high', 'critical']],
            msg: 'Severity must be low, medium, high, or critical'
          }
        },
        comment: 'Severity level of the administrative action'
      },

      result: {
        type: DataTypes.ENUM('success', 'failure', 'partial', 'pending'),
        allowNull: false,
        defaultValue: 'success',
        validate: {
          isIn: {
            args: [['success', 'failure', 'partial', 'pending']],
            msg: 'Result must be success, failure, partial, or pending'
          }
        },
        comment: 'Result of the administrative action'
      },

      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if action failed'
      }
    }, {
      sequelize,
      modelName: 'AdminLog',
      tableName: 'admin_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false, // Admin logs are immutable once created

      indexes: [
        {
          fields: ['admin_id', 'created_at'],
          name: 'idx_admin_logs_admin_time'
        },
        {
          fields: ['target_player_id'],
          name: 'idx_admin_logs_target'
        },
        {
          fields: ['action_type'],
          name: 'idx_admin_logs_action_type'
        },
        {
          fields: ['created_at'],
          name: 'idx_admin_logs_time'
        },
        {
          fields: ['severity'],
          name: 'idx_admin_logs_severity'
        },
        {
          fields: ['result'],
          name: 'idx_admin_logs_result'
        },
        {
          fields: ['ip_address'],
          name: 'idx_admin_logs_ip'
        },
        {
          fields: ['action_type', 'created_at'],
          name: 'idx_admin_logs_action_time'
        }
      ],

      hooks: {
        beforeCreate: (adminLog) => {
          // Auto-assign severity based on action type
          if (!adminLog.severity || adminLog.severity === 'medium') {
            adminLog.severity = AdminLog.getDefaultSeverity(adminLog.action_type);
          }
        },

        afterCreate: (adminLog) => {
          // Log high-severity or failed actions to console
          if (adminLog.severity === 'critical' || adminLog.severity === 'high' || adminLog.result === 'failure') {
            console.log(`ADMIN ACTION [${adminLog.severity.toUpperCase()}]: ${adminLog.action_type} by ${adminLog.admin_id || 'SYSTEM'} - ${adminLog.result}`);

            if (adminLog.error_message) {
              console.log(`Error: ${adminLog.error_message}`);
            }
          }
        }
      },

      scopes: {
        byAdmin: (adminId) => ({
          where: {
            admin_id: adminId
          }
        }),

        byTarget: (targetPlayerId) => ({
          where: {
            target_player_id: targetPlayerId
          }
        }),

        byAction: (actionType) => ({
          where: {
            action_type: actionType
          }
        }),

        bySeverity: (severity) => ({
          where: {
            severity: severity
          }
        }),

        failed: {
          where: {
            result: 'failure'
          }
        },

        successful: {
          where: {
            result: 'success'
          }
        },

        recent: (hours = 24) => ({
          where: {
            created_at: {
              [sequelize.Sequelize.Op.gte]: new Date(Date.now() - (hours * 60 * 60 * 1000))
            }
          }
        }),

        critical: {
          where: {
            severity: 'critical'
          }
        },

        security: {
          where: {
            action_type: {
              [sequelize.Sequelize.Op.in]: [
                'security_event', 'login_attempt', 'session_termination',
                'account_suspension', 'account_ban', 'permission_change'
              ]
            }
          }
        },

        byIP: (ipAddress) => ({
          where: {
            ip_address: ipAddress
          }
        })
      }
    });
  }

  /**
     * Define associations with other models
     */
  static associate(models) {
    // AdminLog belongs to an admin (player with admin privileges)
    AdminLog.belongsTo(models.Player, {
      foreignKey: 'admin_id',
      as: 'admin',
      onDelete: 'SET NULL'
    });

    // AdminLog may target a specific player
    AdminLog.belongsTo(models.Player, {
      foreignKey: 'target_player_id',
      as: 'targetPlayer',
      onDelete: 'SET NULL'
    });
  }

  /**
     * Instance Methods
     */

  /**
     * Check if this is a system-generated log entry
     * @returns {boolean} True if generated by system
     */
  isSystemGenerated() {
    return this.admin_id === null;
  }

  /**
     * Check if action was successful
     * @returns {boolean} True if action was successful
     */
  wasSuccessful() {
    return this.result === 'success';
  }

  /**
     * Check if action failed
     * @returns {boolean} True if action failed
     */
  hasFailed() {
    return this.result === 'failure';
  }

  /**
     * Check if action is high severity or above
     * @returns {boolean} True if high or critical severity
     */
  isHighSeverity() {
    return this.severity === 'high' || this.severity === 'critical';
  }

  /**
     * Get human-readable action description
     * @returns {string} Formatted action description
     */
  getActionDescription() {
    const actionDescriptions = {
      'credit_adjustment': 'Credit Balance Adjustment',
      'account_suspension': 'Account Suspension',
      'account_activation': 'Account Activation',
      'account_ban': 'Account Ban',
      'password_reset': 'Password Reset',
      'balance_inquiry': 'Balance Inquiry',
      'session_termination': 'Session Termination',
      'account_deletion': 'Account Deletion',
      'permission_change': 'Permission Change',
      'jackpot_reset': 'Jackpot Reset',
      'jackpot_award': 'Jackpot Award',
      'system_maintenance': 'System Maintenance',
      'database_backup': 'Database Backup',
      'security_event': 'Security Event',
      'login_attempt': 'Login Attempt',
      'data_export': 'Data Export',
      'configuration_change': 'Configuration Change',
      'spin_replay': 'Spin Replay',
      'transaction_review': 'Transaction Review',
      'player_verification': 'Player Verification'
    };

    return actionDescriptions[this.action_type] || this.action_type;
  }

  /**
     * Get formatted time since action
     * @returns {string} Human-readable time since action
     */
  getTimeSince() {
    const now = new Date();
    const actionTime = new Date(this.created_at);
    const diffMs = now - actionTime;

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {return `${days} day${days > 1 ? 's' : ''} ago`;}
    if (hours > 0) {return `${hours} hour${hours > 1 ? 's' : ''} ago`;}
    if (minutes > 0) {return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;}
    return 'Just now';
  }

  /**
     * Get safe admin log data for client
     * @returns {Object} Safe admin log data
     */
  getSafeData() {
    return {
      id: this.id,
      admin_id: this.admin_id,
      action_type: this.action_type,
      target_player_id: this.target_player_id,
      details: this.details,
      ip_address: this.ip_address,
      severity: this.severity,
      result: this.result,
      error_message: this.error_message,
      created_at: this.created_at,

      // Calculated fields
      is_system_generated: this.isSystemGenerated(),
      was_successful: this.wasSuccessful(),
      has_failed: this.hasFailed(),
      is_high_severity: this.isHighSeverity(),
      action_description: this.getActionDescription(),
      time_since: this.getTimeSince()
    };
  }

  /**
     * Static Methods
     */

  /**
     * Get default severity for action type
     * @param {string} actionType - Action type
     * @returns {string} Default severity level
     */
  static getDefaultSeverity(actionType) {
    const severityMap = {
      // Critical actions
      'account_ban': 'critical',
      'account_deletion': 'critical',
      'permission_change': 'critical',
      'database_backup': 'critical',
      'system_maintenance': 'critical',

      // High severity actions
      'credit_adjustment': 'high',
      'account_suspension': 'high',
      'jackpot_reset': 'high',
      'jackpot_award': 'high',
      'security_event': 'high',
      'configuration_change': 'high',

      // Medium severity actions
      'password_reset': 'medium',
      'session_termination': 'medium',
      'account_activation': 'medium',
      'transaction_review': 'medium',
      'player_verification': 'medium',
      'data_export': 'medium',

      // Low severity actions
      'balance_inquiry': 'low',
      'login_attempt': 'low',
      'spin_replay': 'low'
    };

    return severityMap[actionType] || 'medium';
  }

  /**
     * Log an administrative action
     * @param {Object} logData - Log entry data
     * @returns {AdminLog} Created log entry
     */
  static async logAction({
    admin_id = null,
    action_type,
    target_player_id = null,
    details = null,
    ip_address = null,
    user_agent = null,
    severity = null,
    result = 'success',
    error_message = null
  }) {
    return await AdminLog.create({
      admin_id,
      action_type,
      target_player_id,
      details,
      ip_address,
      user_agent,
      severity: severity || AdminLog.getDefaultSeverity(action_type),
      result,
      error_message
    });
  }

  /**
     * Log a successful admin action
     * @param {Object} logData - Log entry data
     * @returns {AdminLog} Created log entry
     */
  static async logSuccess(logData) {
    return await AdminLog.logAction({
      ...logData,
      result: 'success'
    });
  }

  /**
     * Log a failed admin action
     * @param {Object} logData - Log entry data
     * @returns {AdminLog} Created log entry
     */
  static async logFailure(logData) {
    return await AdminLog.logAction({
      ...logData,
      result: 'failure'
    });
  }

  /**
     * Get admin activity logs with pagination
     * @param {Object} options - Query options
     * @returns {Object} Admin logs and metadata
     */
  static async getAdminLogs({
    page = 1,
    limit = 50,
    admin_id = null,
    target_player_id = null,
    action_type = null,
    severity = null,
    result = null,
    date_from = null,
    date_to = null,
    ip_address = null
  }) {
    const offset = (page - 1) * limit;
    const where = {};

    if (admin_id) {where.admin_id = admin_id;}
    if (target_player_id) {where.target_player_id = target_player_id;}
    if (action_type) {where.action_type = action_type;}
    if (severity) {where.severity = severity;}
    if (result) {where.result = result;}
    if (ip_address) {where.ip_address = ip_address;}

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) {where.created_at[AdminLog.sequelize.Sequelize.Op.gte] = new Date(date_from);}
      if (date_to) {where.created_at[AdminLog.sequelize.Sequelize.Op.lte] = new Date(date_to);}
    }

    const { count, rows } = await AdminLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: AdminLog.sequelize.models.Player,
          as: 'admin',
          attributes: ['id', 'username']
        },
        {
          model: AdminLog.sequelize.models.Player,
          as: 'targetPlayer',
          attributes: ['id', 'username']
        }
      ]
    });

    return {
      logs: rows,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      hasMore: offset + limit < count
    };
  }

  /**
     * Get admin activity statistics
     * @param {Object} options - Query options
     * @returns {Object} Admin activity statistics
     */
  static async getAdminStats({
    admin_id = null,
    days = 30
  }) {
    const where = {};
    if (admin_id) {where.admin_id = admin_id;}

    if (days > 0) {
      where.created_at = {
        [AdminLog.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
      };
    }

    const totalActions = await AdminLog.count({ where });
    const successfulActions = await AdminLog.count({ where: { ...where, result: 'success' } });
    const failedActions = await AdminLog.count({ where: { ...where, result: 'failure' } });
    const criticalActions = await AdminLog.count({ where: { ...where, severity: 'critical' } });

    // Get action breakdown by type
    const actionsByType = await AdminLog.findAll({
      attributes: [
        'action_type',
        [AdminLog.sequelize.fn('COUNT', AdminLog.sequelize.col('id')), 'count']
      ],
      where,
      group: ['action_type'],
      order: [[AdminLog.sequelize.fn('COUNT', AdminLog.sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Get daily activity
    const dailyActivity = await AdminLog.findAll({
      attributes: [
        [AdminLog.sequelize.fn('DATE', AdminLog.sequelize.col('created_at')), 'date'],
        [AdminLog.sequelize.fn('COUNT', AdminLog.sequelize.col('id')), 'count']
      ],
      where,
      group: [AdminLog.sequelize.fn('DATE', AdminLog.sequelize.col('created_at'))],
      order: [[AdminLog.sequelize.fn('DATE', AdminLog.sequelize.col('created_at')), 'DESC']],
      limit: Math.min(days, 30), // Limit to 30 days max
      raw: true
    });

    return {
      admin_id: admin_id,
      period_days: days,
      total_actions: totalActions,
      successful_actions: successfulActions,
      failed_actions: failedActions,
      critical_actions: criticalActions,
      success_rate: totalActions > 0 ? parseFloat(((successfulActions / totalActions) * 100).toFixed(2)) : 0,
      actions_by_type: actionsByType.map(a => ({
        action_type: a.action_type,
        count: parseInt(a.count),
        description: AdminLog.prototype.getActionDescription.call({ action_type: a.action_type })
      })),
      daily_activity: dailyActivity.map(d => ({
        date: d.date,
        count: parseInt(d.count)
      }))
    };
  }

  /**
     * Get security events and alerts
     * @param {number} hours - Hours to look back
     * @returns {Array<AdminLog>} Security-related log entries
     */
  static async getSecurityEvents(hours = 24) {
    return await AdminLog.findAll({
      where: {
        [AdminLog.sequelize.Sequelize.Op.or]: [
          { severity: 'critical' },
          { result: 'failure' },
          {
            action_type: {
              [AdminLog.sequelize.Sequelize.Op.in]: [
                'security_event', 'login_attempt', 'account_ban',
                'permission_change', 'session_termination'
              ]
            }
          }
        ],
        created_at: {
          [AdminLog.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (hours * 60 * 60 * 1000))
        }
      },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: AdminLog.sequelize.models.Player,
          as: 'admin',
          attributes: ['id', 'username']
        },
        {
          model: AdminLog.sequelize.models.Player,
          as: 'targetPlayer',
          attributes: ['id', 'username']
        }
      ]
    });
  }

  /**
     * Search admin logs by keyword
     * @param {string} keyword - Search keyword
     * @param {Object} options - Additional search options
     * @returns {Object} Search results and metadata
     */
  static async searchLogs(keyword, {
    page = 1,
    limit = 50,
    days = 30
  } = {}) {
    const offset = (page - 1) * limit;
    const where = {
      [AdminLog.sequelize.Sequelize.Op.or]: [
        { action_type: { [AdminLog.sequelize.Sequelize.Op.iLike]: `%${keyword}%` } },
        { error_message: { [AdminLog.sequelize.Sequelize.Op.iLike]: `%${keyword}%` } },
        { 'details': { [AdminLog.sequelize.Sequelize.Op.contains]: { keyword } } }
      ]
    };

    if (days > 0) {
      where.created_at = {
        [AdminLog.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
      };
    }

    const { count, rows } = await AdminLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: AdminLog.sequelize.models.Player,
          as: 'admin',
          attributes: ['id', 'username']
        },
        {
          model: AdminLog.sequelize.models.Player,
          as: 'targetPlayer',
          attributes: ['id', 'username']
        }
      ]
    });

    return {
      keyword,
      logs: rows,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      hasMore: offset + limit < count
    };
  }
}

module.exports = AdminLog;