/**
 * walletValidation.js - Wallet Validation Middleware
 * 
 * Provides comprehensive validation for wallet operations including
 * transaction validation, admin permission checks, and security measures.
 * 
 * Features:
 * - Transaction amount validation
 * - Admin permission verification
 * - Rate limiting protection
 * - Input sanitization
 * - Security checks for suspicious activities
 */

const { body, param, query, validationResult } = require('express-validator');
const { getPlayer } = require('../db/supabaseClient');
const { logger } = require('../utils/logger');
const ResponseHelper = require('../utils/responseHelper');

/**
 * Rate limiting store for wallet operations
 */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30;

class WalletValidation {
    /**
     * Check validation results and return errors if any
     */
    static checkValidationResult(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }));

            logger.warn('Wallet validation failed', {
                player_id: req.user?.id,
                errors: errorMessages,
                endpoint: req.originalUrl
            });

            return ResponseHelper.badRequest(res, 'Validation failed', {
                errors: errorMessages
            });
        }
        next();
    }

    /**
     * Rate limiting middleware for wallet operations
     */
    static rateLimitWalletOperations(req, res, next) {
        const playerId = req.user?.id;
        if (!playerId) {
            return next();
        }

        const now = Date.now();
        const key = `wallet_${playerId}`;
        
        // Clean up old entries
        for (const [k, data] of rateLimitStore.entries()) {
            if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
                rateLimitStore.delete(k);
            }
        }

        // Check current user's rate limit
        const userRequests = rateLimitStore.get(key);
        
        if (!userRequests) {
            rateLimitStore.set(key, {
                count: 1,
                firstRequest: now
            });
            return next();
        }

        if (now - userRequests.firstRequest < RATE_LIMIT_WINDOW) {
            if (userRequests.count >= MAX_REQUESTS_PER_MINUTE) {
                logger.warn('Wallet rate limit exceeded', {
                    player_id: playerId,
                    requests_count: userRequests.count,
                    time_window: RATE_LIMIT_WINDOW / 1000,
                    endpoint: req.originalUrl
                });

                return ResponseHelper.tooManyRequests(res, 'Too many wallet requests. Please try again later.');
            }
            userRequests.count++;
        } else {
            // Reset counter for new window
            rateLimitStore.set(key, {
                count: 1,
                firstRequest: now
            });
        }

        next();
    }

    /**
     * Validate admin permissions
     */
    static async validateAdminPermissions(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHelper.unauthorized(res, 'Authentication required');
            }

            const user = await getPlayer(userId);
            if (!user || !user.is_admin) {
                logger.warn('Unauthorized admin wallet access attempt', {
                    user_id: userId,
                    endpoint: req.originalUrl,
                    ip_address: req.ip
                });

                return ResponseHelper.forbidden(res, 'Admin permissions required');
            }

            next();
        } catch (error) {
            logger.error('Admin permission validation error', {
                user_id: req.user?.id,
                error: error.message
            });

            return ResponseHelper.serverError(res, 'Permission validation failed');
        }
    }

    /**
     * Validate UUID parameters
     */
    static validatePlayerIdParam = [
        param('playerId')
            .isUUID()
            .withMessage('Player ID must be a valid UUID'),
        WalletValidation.checkValidationResult
    ];

    /**
     * Validate balance inquiry parameters
     */
    static validateBalanceInquiry = [
        // No specific validation needed for balance inquiry
        WalletValidation.checkValidationResult
    ];

    /**
     * Validate transaction history query parameters
     */
    static validateTransactionHistoryQuery = [
        query('page')
            .optional()
            .isInt({ min: 1, max: 10000 })
            .withMessage('Page must be a positive integer between 1 and 10000'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be an integer between 1 and 100'),
        
        query('type')
            .optional()
            .isIn(['bet', 'win', 'adjustment', 'purchase', 'deposit', 'withdrawal', 'bonus', 'refund'])
            .withMessage('Invalid transaction type'),
        
        query('date_from')
            .optional()
            .isISO8601()
            .withMessage('date_from must be a valid ISO 8601 date'),
        
        query('date_to')
            .optional()
            .isISO8601()
            .withMessage('date_to must be a valid ISO 8601 date'),
        
        query('include_admin')
            .optional()
            .isBoolean()
            .withMessage('include_admin must be a boolean'),

        WalletValidation.checkValidationResult
    ];

    /**
     * Validate wallet statistics query parameters
     */
    static validateWalletStatsQuery = [
        query('days')
            .optional()
            .isInt({ min: 1, max: 365 })
            .withMessage('Days must be an integer between 1 and 365'),
        
        query('include_admin_adjustments')
            .optional()
            .isBoolean()
            .withMessage('include_admin_adjustments must be a boolean'),

        WalletValidation.checkValidationResult
    ];

    /**
     * Validate admin balance adjustment request
     */
    static validateAdminAdjustment = [
        body('player_id')
            .isUUID()
            .withMessage('player_id must be a valid UUID'),
        
        body('amount')
            .isFloat({ min: -50000, max: 50000 })
            .withMessage('Amount must be a number between -50000 and 50000')
            .not()
            .equals('0')
            .withMessage('Amount cannot be zero'),
        
        body('reason')
            .isString()
            .isLength({ min: 5, max: 500 })
            .withMessage('Reason must be a string between 5 and 500 characters')
            .trim()
            .escape(),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object'),

        WalletValidation.checkValidationResult,
        
        // Additional validation: Check if target player exists
        async (req, res, next) => {
            try {
                const { player_id } = req.body;
                const targetPlayer = await getPlayer(player_id);
                
                if (!targetPlayer) {
                    return ResponseHelper.notFound(res, 'Target player not found');
                }

                if (targetPlayer.status === 'banned') {
                    return ResponseHelper.badRequest(res, 'Cannot adjust balance for banned player');
                }

                // Store target player info for later use
                req.targetPlayer = targetPlayer;
                next();
            } catch (error) {
                logger.error('Target player validation error', {
                    admin_id: req.user?.id,
                    target_player_id: req.body?.player_id,
                    error: error.message
                });

                return ResponseHelper.serverError(res, 'Player validation failed');
            }
        }
    ];

    /**
     * Validate transaction amounts for security
     */
    static validateTransactionSecurity(req, res, next) {
        const { amount } = req.body;
        
        if (amount !== undefined) {
            const numAmount = parseFloat(amount);
            
            // Check for suspicious amounts
            if (Math.abs(numAmount) > 10000) {
                logger.warn('Large transaction amount detected', {
                    player_id: req.user?.id,
                    amount: numAmount,
                    endpoint: req.originalUrl,
                    ip_address: req.ip
                });
            }
            
            // Check for decimal precision abuse
            const decimalPlaces = (amount.toString().split('.')[1] || '').length;
            if (decimalPlaces > 2) {
                return ResponseHelper.badRequest(res, 'Amount cannot have more than 2 decimal places');
            }
        }

        next();
    }

    /**
     * Log wallet operation for audit trail
     */
    static logWalletOperation(operation) {
        return (req, res, next) => {
            // Temporarily disabled logging to prevent errors
            // TODO: Fix logger implementation
            next();
        };
    }

    /**
     * Validate player account status for wallet operations
     */
    static async validatePlayerStatus(req, res, next) {
        try {
            const playerId = req.user?.id;
            if (!playerId) {
                return ResponseHelper.unauthorized(res, 'Authentication required');
            }

            const player = await getPlayer(playerId);
            if (!player) {
                return ResponseHelper.notFound(res, 'Player not found');
            }

            if (player.status !== 'active') {
                logger.warn('Wallet access attempt by inactive player', {
                    player_id: playerId,
                    status: player.status,
                    endpoint: req.originalUrl
                });

                return ResponseHelper.forbidden(res, `Wallet access denied. Account status: ${player.status}`);
            }

            // Store player info for later use
            req.player = player;
            next();
        } catch (error) {
            logger.error('Player status validation error', {
                player_id: req.user?.id,
                error: error.message
            });

            return ResponseHelper.serverError(res, 'Player status validation failed');
        }
    }

    /**
     * Validate date range parameters
     */
    static validateDateRange(req, res, next) {
        const { date_from, date_to } = req.query;
        
        if (date_from && date_to) {
            const fromDate = new Date(date_from);
            const toDate = new Date(date_to);
            
            if (fromDate >= toDate) {
                return ResponseHelper.badRequest(res, 'date_from must be earlier than date_to');
            }
            
            // Check for unreasonable date ranges
            const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 365) {
                return ResponseHelper.badRequest(res, 'Date range cannot exceed 365 days');
            }
        }

        next();
    }

    /**
     * Sanitize and normalize numeric inputs
     */
    static normalizeNumericInputs(req, res, next) {
        if (req.body.amount !== undefined) {
            req.body.amount = parseFloat(req.body.amount);
        }
        
        if (req.query.page !== undefined) {
            req.query.page = parseInt(req.query.page) || 1;
        }
        
        if (req.query.limit !== undefined) {
            req.query.limit = parseInt(req.query.limit) || 50;
        }
        
        if (req.query.days !== undefined) {
            req.query.days = parseInt(req.query.days) || 30;
        }

        next();
    }
}

module.exports = WalletValidation;