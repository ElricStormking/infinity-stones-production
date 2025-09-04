/**
 * Game Validation Middleware
 *
 * Provides comprehensive validation for game-specific operations:
 * - Spin request validation with business logic
 * - State update validation with transition rules
 * - Feature purchase validation
 * - Security and anti-cheat checks
 * - Rate limiting for game operations
 *
 * Features:
 * - Configurable validation rules
 * - Player-specific limits
 * - Demo mode restrictions
 * - Anti-fraud detection
 * - Performance monitoring
 */

const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/logger.js');
const responseHelper = require('../utils/responseHelper');

// Game configuration constants
const GAME_LIMITS = {
  MIN_BET: 0.01,
  MAX_BET: 1000,
  MAX_BET_DEMO: 10,
  MIN_MULTIPLIER: 1,
  MAX_MULTIPLIER: 5000,
  MAX_FREE_SPINS: 100,
  MAX_SPINS_PER_MINUTE: 30,
  MAX_SPINS_PER_HOUR: 1000,
  COOL_DOWN_PERIOD: 100 // milliseconds between spins
};

// Feature costs
const FEATURE_COSTS = {
  free_spins: 100, // 100x bet
  bonus_round: 50  // 50x bet
};

// Rate limiting storage (in production, use Redis)
const playerRateLimits = new Map();

class GameValidation {

  /**
     * Validate spin request with business logic
     */
  static validateSpinRequest = async (req, res, next) => {
    try {
      const playerId = req.user.id;
      const { betAmount, accumulatedMultiplier = 1 } = req.body;

      // Check rate limiting
      const rateLimitResult = GameValidation.checkRateLimit(playerId);
      if (!rateLimitResult.allowed) {
        return responseHelper.tooManyRequests(res, 'Spin rate limit exceeded', {
          nextAllowedTime: rateLimitResult.nextAllowedTime,
          cooldownRemaining: rateLimitResult.cooldownRemaining
        });
      }

      // Validate bet amount based on account type
      const maxBet = req.user.is_demo ? GAME_LIMITS.MAX_BET_DEMO : GAME_LIMITS.MAX_BET;
      if (betAmount > maxBet) {
        return responseHelper.badRequest(res,
          `Bet amount exceeds ${req.user.is_demo ? 'demo' : 'account'} limit`, {
            maxBet,
            accountType: req.user.is_demo ? 'demo' : 'real'
          });
      }

      // Validate multiplier limits
      if (accumulatedMultiplier > GAME_LIMITS.MAX_MULTIPLIER) {
        return responseHelper.badRequest(res, 'Accumulated multiplier exceeds maximum', {
          maxMultiplier: GAME_LIMITS.MAX_MULTIPLIER,
          providedMultiplier: accumulatedMultiplier
        });
      }

      // Check player credit sufficiency (for real accounts)
      if (!req.user.is_demo && req.user.credits < betAmount) {
        return responseHelper.badRequest(res, 'Insufficient credits', {
          availableCredits: req.user.credits,
          requiredCredits: betAmount
        });
      }

      // Check if player is in valid state for spinning
      const stateValidation = await GameValidation.validatePlayerState(req.user);
      if (!stateValidation.valid) {
        return responseHelper.forbidden(res, 'Player state invalid for spinning', {
          reason: stateValidation.reason,
          restrictions: stateValidation.restrictions
        });
      }

      // Update rate limit
      GameValidation.updateRateLimit(playerId);

      next();

    } catch (error) {
      logger.error('Spin validation error', {
        error: error.message,
        playerId: req.user?.id,
        stack: error.stack
      });
      responseHelper.serverError(res, 'Validation service error');
    }
  };

  /**
     * Validate state update requests
     */
  static validateStateUpdate = async (req, res, next) => {
    try {
      const { stateUpdates, reason } = req.body;

      // Validate allowed state fields
      const allowedFields = [
        'game_mode',
        'free_spins_remaining',
        'accumulated_multiplier',
        'state_data'
      ];

      const invalidFields = Object.keys(stateUpdates).filter(
        field => !allowedFields.includes(field)
      );

      if (invalidFields.length > 0) {
        return responseHelper.badRequest(res, 'Invalid state fields', {
          invalidFields,
          allowedFields
        });
      }

      // Validate field values
      const validationErrors = [];

      if ('free_spins_remaining' in stateUpdates) {
        const freeSpins = parseInt(stateUpdates.free_spins_remaining);
        if (isNaN(freeSpins) || freeSpins < 0 || freeSpins > GAME_LIMITS.MAX_FREE_SPINS) {
          validationErrors.push(`Free spins must be between 0 and ${GAME_LIMITS.MAX_FREE_SPINS}`);
        }
      }

      if ('accumulated_multiplier' in stateUpdates) {
        const multiplier = parseFloat(stateUpdates.accumulated_multiplier);
        if (isNaN(multiplier) || multiplier < 1 || multiplier > GAME_LIMITS.MAX_MULTIPLIER) {
          validationErrors.push(`Multiplier must be between 1 and ${GAME_LIMITS.MAX_MULTIPLIER}`);
        }
      }

      if ('game_mode' in stateUpdates) {
        const validModes = ['base', 'free_spins', 'bonus'];
        if (!validModes.includes(stateUpdates.game_mode)) {
          validationErrors.push(`Game mode must be one of: ${validModes.join(', ')}`);
        }
      }

      if (validationErrors.length > 0) {
        return responseHelper.badRequest(res, 'State validation failed', {
          errors: validationErrors
        });
      }

      // Check if user has permission for manual state updates
      if (!req.user.is_admin && reason === 'manual_update') {
        return responseHelper.forbidden(res, 'Manual state updates require admin privileges');
      }

      next();

    } catch (error) {
      logger.error('State update validation error', {
        error: error.message,
        playerId: req.user?.id,
        stack: error.stack
      });
      responseHelper.serverError(res, 'Validation service error');
    }
  };

  /**
     * Validate feature purchase requests
     */
  static validateFeaturePurchase = async (req, res, next) => {
    try {
      const { featureType, cost } = req.body;

      // Check if feature type is valid
      if (!FEATURE_COSTS[featureType]) {
        return responseHelper.badRequest(res, 'Invalid feature type', {
          validFeatures: Object.keys(FEATURE_COSTS)
        });
      }

      // Calculate expected cost (for validation)
      const expectedCost = FEATURE_COSTS[featureType] * (req.body.betAmount || 1);
      const costDifference = Math.abs(cost - expectedCost);

      // Allow small rounding differences
      if (costDifference > 0.01) {
        return responseHelper.badRequest(res, 'Feature cost mismatch', {
          expectedCost,
          providedCost: cost,
          featureType
        });
      }

      // Check credit sufficiency
      if (!req.user.is_demo && req.user.credits < cost) {
        return responseHelper.badRequest(res, 'Insufficient credits for feature purchase', {
          availableCredits: req.user.credits,
          requiredCredits: cost
        });
      }

      // Demo mode restrictions
      if (req.user.is_demo && cost > 100) {
        return responseHelper.badRequest(res, 'Demo mode feature purchase limit exceeded', {
          maxCost: 100
        });
      }

      next();

    } catch (error) {
      logger.error('Feature purchase validation error', {
        error: error.message,
        playerId: req.user?.id,
        stack: error.stack
      });
      responseHelper.serverError(res, 'Validation service error');
    }
  };

  /**
     * Check rate limiting for player actions
     * @param {string} playerId - Player ID
     * @returns {Object} Rate limit result
     */
  static checkRateLimit(playerId) {
    const now = Date.now();
    const playerLimits = playerRateLimits.get(playerId) || {
      lastSpin: 0,
      spinsThisMinute: [],
      spinsThisHour: []
    };

    // Check cooldown period
    const timeSinceLastSpin = now - playerLimits.lastSpin;
    if (timeSinceLastSpin < GAME_LIMITS.COOL_DOWN_PERIOD) {
      return {
        allowed: false,
        reason: 'cooldown',
        cooldownRemaining: GAME_LIMITS.COOL_DOWN_PERIOD - timeSinceLastSpin,
        nextAllowedTime: playerLimits.lastSpin + GAME_LIMITS.COOL_DOWN_PERIOD
      };
    }

    // Clean old entries
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    playerLimits.spinsThisMinute = playerLimits.spinsThisMinute.filter(time => time > minuteAgo);
    playerLimits.spinsThisHour = playerLimits.spinsThisHour.filter(time => time > hourAgo);

    // Check per-minute limit
    if (playerLimits.spinsThisMinute.length >= GAME_LIMITS.MAX_SPINS_PER_MINUTE) {
      return {
        allowed: false,
        reason: 'per_minute_limit',
        nextAllowedTime: playerLimits.spinsThisMinute[0] + 60000
      };
    }

    // Check per-hour limit
    if (playerLimits.spinsThisHour.length >= GAME_LIMITS.MAX_SPINS_PER_HOUR) {
      return {
        allowed: false,
        reason: 'per_hour_limit',
        nextAllowedTime: playerLimits.spinsThisHour[0] + 3600000
      };
    }

    return { allowed: true };
  }

  /**
     * Update rate limit tracking for player
     * @param {string} playerId - Player ID
     */
  static updateRateLimit(playerId) {
    const now = Date.now();
    const playerLimits = playerRateLimits.get(playerId) || {
      lastSpin: 0,
      spinsThisMinute: [],
      spinsThisHour: []
    };

    playerLimits.lastSpin = now;
    playerLimits.spinsThisMinute.push(now);
    playerLimits.spinsThisHour.push(now);

    playerRateLimits.set(playerId, playerLimits);
  }

  /**
     * Validate player state for game operations
     * @param {Object} user - User object
     * @returns {Promise<Object>} Validation result
     */
  static async validatePlayerState(user) {
    const restrictions = [];

    // Check account status
    if (user.status !== 'active') {
      return {
        valid: false,
        reason: 'account_inactive',
        restrictions: ['Account is not active']
      };
    }

    // Check if player is banned from gaming
    if (user.is_banned) {
      return {
        valid: false,
        reason: 'player_banned',
        restrictions: ['Player is banned from gaming']
      };
    }

    // Check session validity
    if (user.session_expired) {
      return {
        valid: false,
        reason: 'session_expired',
        restrictions: ['Session has expired']
      };
    }

    // Additional checks can be added here
    // - Daily loss limits
    // - Responsible gaming settings
    // - Jurisdiction restrictions
    // - Age verification

    return {
      valid: true,
      restrictions: []
    };
  }

  /**
     * Validate transaction amounts and limits
     * @param {Object} user - User object
     * @param {number} amount - Transaction amount
     * @param {string} type - Transaction type
     * @returns {Object} Validation result
     */
  static validateTransaction(user, amount, type) {
    const errors = [];

    if (amount <= 0) {
      errors.push('Transaction amount must be positive');
    }

    // Demo account restrictions
    if (user.is_demo) {
      if (type === 'debit' && amount > 1000) {
        errors.push('Demo account transaction limit exceeded');
      }
    }

    // Real account checks
    if (!user.is_demo) {
      if (type === 'debit' && user.credits < amount) {
        errors.push('Insufficient credits for transaction');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
     * Clean up expired rate limit entries
     * Should be called periodically
     */
  static cleanupRateLimits() {
    const now = Date.now();
    const hourAgo = now - 3600000;

    for (const [playerId, limits] of playerRateLimits) {
      // Remove entries older than 1 hour
      if (limits.lastSpin < hourAgo) {
        playerRateLimits.delete(playerId);
      } else {
        // Clean up arrays
        limits.spinsThisMinute = limits.spinsThisMinute.filter(time => time > now - 60000);
        limits.spinsThisHour = limits.spinsThisHour.filter(time => time > hourAgo);
      }
    }
  }

  /**
     * Get rate limit statistics for monitoring
     * @returns {Object} Rate limit statistics
     */
  static getRateLimitStats() {
    const stats = {
      totalPlayersTracked: playerRateLimits.size,
      playersWithRecentActivity: 0,
      totalSpinsLastHour: 0,
      averageSpinsPerPlayer: 0
    };

    const now = Date.now();
    const hourAgo = now - 3600000;

    for (const [playerId, limits] of playerRateLimits) {
      if (limits.lastSpin > hourAgo) {
        stats.playersWithRecentActivity++;
        stats.totalSpinsLastHour += limits.spinsThisHour.length;
      }
    }

    if (stats.playersWithRecentActivity > 0) {
      stats.averageSpinsPerPlayer = Math.round(stats.totalSpinsLastHour / stats.playersWithRecentActivity);
    }

    return stats;
  }
}

// Clean up rate limits every 5 minutes
setInterval(() => {
  GameValidation.cleanupRateLimits();
}, 5 * 60 * 1000);

module.exports = GameValidation;