/**
 * wallet.js - Wallet Controller
 * 
 * Handles HTTP requests for wallet operations including balance inquiries,
 * transaction processing, history retrieval, and admin adjustments.
 * 
 * Features:
 * - RESTful wallet API endpoints
 * - Request validation and sanitization
 * - Error handling with proper HTTP status codes
 * - Authentication and authorization integration
 * - Audit logging for all operations
 * - Rate limiting protection
 */

const { getPlayer, getPlayerBalance, updatePlayerBalance, createTransaction, processBet, processWin } = require('../db/supabaseClient');
const { auditLogger } = require('../utils/logger');
const { createResponse } = require('../utils/responseHelper');

class WalletController {
    /**
     * Get current wallet balance
     * GET /api/wallet/balance
     */
    static async getBalance(req, res) {
        try {
            const playerId = req.user?.id;
            
            if (!playerId) {
                return res.status(401).json({
                    success: false,
                    message: 'Player ID not found in session'
                });
            }

            console.log('Getting balance for player:', playerId);
            const balanceResult = await getPlayerBalance(playerId);
            console.log('Balance result:', balanceResult);
            
            if (!balanceResult) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to retrieve balance - no result'
                });
            }
            
            if (balanceResult.error) {
                const statusCode = balanceResult.error.includes('not found') ? 404 : 400;
                return res.status(statusCode).json({
                    success: false,
                    message: balanceResult.error
                });
            }

            console.log('Balance inquiry successful for player:', playerId);

            return res.status(200).json({
                success: true,
                message: 'Balance retrieved successfully',
                data: {
                    balance: balanceResult.balance || 0,
                    playerId: balanceResult.playerId || playerId,
                    username: balanceResult.username || 'Unknown'
                }
            });

        } catch (error) {
            console.error('Balance API error:', error);

            return res.status(500).json({
                success: false,
                message: 'Internal server error: ' + (error?.message || 'Unknown error')
            });
        }
    }

    /**
     * Get wallet status with real-time information
     * GET /api/wallet/status
     */
    static async getWalletStatus(req, res) {
        try {
            const playerId = req.user.id;

            const status = await WalletService.getWalletStatus(playerId);

            return createResponse(res, 200, 'Wallet status retrieved successfully', {
                status
            });

        } catch (error) {
            auditLogger.error('Wallet status API error', {
                player_id: req.user?.id,
                error: error.message,
                ip_address: req.ip
            });

            return createResponse(res, 400, error.message);
        }
    }

    /**
     * Get transaction history with pagination
     * GET /api/wallet/transactions
     */
    static async getTransactionHistory(req, res) {
        try {
            const playerId = req.user.id;
            const {
                page = 1,
                limit = 50,
                type,
                date_from,
                date_to,
                include_admin = false
            } = req.query;

            // Validate pagination parameters
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

            // Validate date parameters
            let dateFrom = null;
            let dateTo = null;

            if (date_from) {
                dateFrom = new Date(date_from);
                if (isNaN(dateFrom.getTime())) {
                    return createResponse(res, 400, 'Invalid date_from format');
                }
            }

            if (date_to) {
                dateTo = new Date(date_to);
                if (isNaN(dateTo.getTime())) {
                    return createResponse(res, 400, 'Invalid date_to format');
                }
            }

            // Validate transaction type
            const validTypes = ['bet', 'win', 'adjustment', 'purchase', 'deposit', 'withdrawal', 'bonus', 'refund'];
            if (type && !validTypes.includes(type)) {
                return createResponse(res, 400, `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
            }

            const history = await WalletService.getTransactionHistory({
                player_id: playerId,
                page: pageNum,
                limit: limitNum,
                type,
                date_from: dateFrom,
                date_to: dateTo,
                include_admin: include_admin === 'true'
            });

            return createResponse(res, 200, 'Transaction history retrieved successfully', history);

        } catch (error) {
            auditLogger.error('Transaction history API error', {
                player_id: req.user?.id,
                error: error.message,
                ip_address: req.ip
            });

            return createResponse(res, 400, error.message);
        }
    }

    /**
     * Get wallet statistics
     * GET /api/wallet/stats
     */
    static async getWalletStats(req, res) {
        try {
            const playerId = req.user.id;
            const {
                days = 30,
                include_admin_adjustments = false
            } = req.query;

            // Validate days parameter
            const daysNum = Math.min(365, Math.max(1, parseInt(days) || 30));

            const stats = await WalletService.getWalletStats({
                player_id: playerId,
                days: daysNum,
                include_admin_adjustments: include_admin_adjustments === 'true'
            });

            return createResponse(res, 200, 'Wallet statistics retrieved successfully', {
                stats
            });

        } catch (error) {
            auditLogger.error('Wallet stats API error', {
                player_id: req.user?.id,
                error: error.message,
                ip_address: req.ip
            });

            return createResponse(res, 400, error.message);
        }
    }

    /**
     * Validate balance consistency
     * GET /api/wallet/validate
     */
    static async validateBalance(req, res) {
        try {
            const playerId = req.user.id;

            const validation = await WalletService.validateBalanceConsistency(playerId);

            const statusCode = validation.valid ? 200 : 422;
            const message = validation.valid 
                ? 'Balance is consistent' 
                : 'Balance inconsistencies detected';

            return createResponse(res, statusCode, message, {
                validation
            });

        } catch (error) {
            auditLogger.error('Balance validation API error', {
                player_id: req.user?.id,
                error: error.message,
                ip_address: req.ip
            });

            return createResponse(res, 400, error.message);
        }
    }

    /**
     * Process admin balance adjustment (Admin only)
     * POST /api/wallet/admin/adjust
     */
    static async adminAdjustBalance(req, res) {
        try {
            const adminId = req.user.id;
            const {
                player_id,
                amount,
                reason,
                metadata
            } = req.body;

            // Validate required fields
            if (!player_id) {
                return createResponse(res, 400, 'player_id is required');
            }

            if (amount === undefined || amount === null) {
                return createResponse(res, 400, 'amount is required');
            }

            if (!reason || reason.trim().length < 5) {
                return createResponse(res, 400, 'reason is required and must be at least 5 characters');
            }

            // Validate amount
            const adjustmentAmount = parseFloat(amount);
            if (isNaN(adjustmentAmount) || adjustmentAmount === 0) {
                return createResponse(res, 400, 'amount must be a non-zero number');
            }

            // Check if adjustment amount is reasonable
            if (Math.abs(adjustmentAmount) > 50000) {
                return createResponse(res, 400, 'Adjustment amount exceeds maximum allowed limit');
            }

            const result = await WalletService.processAdminAdjustment({
                player_id,
                amount: adjustmentAmount,
                reason: reason.trim(),
                admin_id: adminId,
                metadata: metadata || {}
            });

            auditLogger.info('Admin balance adjustment completed', {
                admin_id: adminId,
                player_id,
                amount: adjustmentAmount,
                reason,
                transaction_id: result.transaction.id
            });

            return createResponse(res, 200, 'Balance adjustment completed successfully', {
                adjustment: result
            });

        } catch (error) {
            auditLogger.error('Admin adjustment API error', {
                admin_id: req.user?.id,
                error: error.message,
                ip_address: req.ip
            });

            const statusCode = error.message.includes('permissions') ? 403 : 400;
            return createResponse(res, statusCode, error.message);
        }
    }

    /**
     * Get player balance by admin (Admin only)
     * GET /api/wallet/admin/balance/:playerId
     */
    static async adminGetBalance(req, res) {
        try {
            const { playerId } = req.params;
            const adminId = req.user.id;

            if (!playerId) {
                return createResponse(res, 400, 'Player ID is required');
            }

            const balance = await WalletService.getBalance(playerId);

            auditLogger.info('Admin balance inquiry', {
                admin_id: adminId,
                target_player_id: playerId,
                balance: balance.balance
            });

            return createResponse(res, 200, 'Player balance retrieved successfully', {
                balance
            });

        } catch (error) {
            auditLogger.error('Admin balance inquiry error', {
                admin_id: req.user?.id,
                target_player_id: req.params?.playerId,
                error: error.message
            });

            const statusCode = error.message.includes('not found') ? 404 : 400;
            return createResponse(res, statusCode, error.message);
        }
    }

    /**
     * Get player transaction history by admin (Admin only)
     * GET /api/wallet/admin/transactions/:playerId
     */
    static async adminGetTransactionHistory(req, res) {
        try {
            const { playerId } = req.params;
            const adminId = req.user.id;
            const {
                page = 1,
                limit = 50,
                type,
                date_from,
                date_to
            } = req.query;

            if (!playerId) {
                return createResponse(res, 400, 'Player ID is required');
            }

            // Validate parameters
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

            let dateFrom = null;
            let dateTo = null;

            if (date_from) {
                dateFrom = new Date(date_from);
                if (isNaN(dateFrom.getTime())) {
                    return createResponse(res, 400, 'Invalid date_from format');
                }
            }

            if (date_to) {
                dateTo = new Date(date_to);
                if (isNaN(dateTo.getTime())) {
                    return createResponse(res, 400, 'Invalid date_to format');
                }
            }

            const history = await WalletService.getTransactionHistory({
                player_id: playerId,
                page: pageNum,
                limit: limitNum,
                type,
                date_from: dateFrom,
                date_to: dateTo,
                include_admin: true // Admins can see all transactions
            });

            auditLogger.info('Admin transaction history inquiry', {
                admin_id: adminId,
                target_player_id: playerId,
                transaction_count: history.transactions.length
            });

            return createResponse(res, 200, 'Player transaction history retrieved successfully', history);

        } catch (error) {
            auditLogger.error('Admin transaction history error', {
                admin_id: req.user?.id,
                target_player_id: req.params?.playerId,
                error: error.message
            });

            return createResponse(res, 400, error.message);
        }
    }

    /**
     * Validate player balance by admin (Admin only)
     * GET /api/wallet/admin/validate/:playerId
     */
    static async adminValidateBalance(req, res) {
        try {
            const { playerId } = req.params;
            const adminId = req.user.id;

            if (!playerId) {
                return createResponse(res, 400, 'Player ID is required');
            }

            const validation = await WalletService.validateBalanceConsistency(playerId);

            auditLogger.info('Admin balance validation', {
                admin_id: adminId,
                target_player_id: playerId,
                is_valid: validation.valid,
                errors_found: validation.errors?.length || 0
            });

            const statusCode = validation.valid ? 200 : 422;
            const message = validation.valid 
                ? 'Player balance is consistent' 
                : 'Player balance inconsistencies detected';

            return createResponse(res, statusCode, message, {
                validation
            });

        } catch (error) {
            auditLogger.error('Admin balance validation error', {
                admin_id: req.user?.id,
                target_player_id: req.params?.playerId,
                error: error.message
            });

            return createResponse(res, 400, error.message);
        }
    }

    /**
     * Internal method: Process bet transaction (used by game controller)
     * @param {Object} betData - Bet transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processBet(betData) {
        return await processBet(betData.playerId, betData.amount);
    }

    /**
     * Internal method: Process win transaction (used by game controller)
     * @param {Object} winData - Win transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processWin(winData) {
        return await processWin(winData.playerId, winData.amount);
    }

    /**
     * Internal method: Process free spins purchase (used by game controller)
     * @param {Object} purchaseData - Purchase transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processFreeSpinsPurchase(purchaseData) {
        return await WalletService.processFreeSpinsPurchase(purchaseData);
    }
}

module.exports = WalletController;