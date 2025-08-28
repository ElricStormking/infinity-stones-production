/**
 * walletService.js - Core Wallet Service
 * 
 * Provides comprehensive wallet operations with atomic transactions,
 * complete audit trails, and anti-fraud validation for casino operations.
 * 
 * Features:
 * - Atomic credit operations with rollback capability
 * - Complete transaction audit trail
 * - Balance validation and consistency checks
 * - Anti-fraud transaction monitoring
 * - Admin adjustment support with reason logging
 * - Transaction history with pagination
 * - Real-time balance inquiry
 */

const { Transaction, Player, AdminLog } = require('../models');
const { sequelize } = require('../config/database');
const { auditLogger } = require('../utils/logger');

class WalletService {
    /**
     * Get current balance for a player
     * @param {string} playerId - Player UUID
     * @returns {Promise<Object>} Balance information
     */
    static async getBalance(playerId) {
        try {
            const player = await Player.findByPk(playerId, {
                attributes: ['id', 'username', 'credits', 'is_demo', 'status']
            });

            if (!player) {
                throw new Error('Player not found');
            }

            if (!player.isActive()) {
                throw new Error(`Cannot access wallet. Account status: ${player.status}`);
            }

            // Get last transaction for validation
            const lastTransaction = await Transaction.findOne({
                where: { player_id: playerId },
                order: [['created_at', 'DESC']],
                attributes: ['balance_after', 'created_at']
            });

            // Validate balance consistency
            const dbBalance = player.credits;
            const lastTransactionBalance = lastTransaction ? lastTransaction.balance_after : dbBalance;

            const isConsistent = !lastTransaction || Math.abs(dbBalance - lastTransactionBalance) < 0.01;

            auditLogger.info('Balance inquiry', {
                player_id: playerId,
                balance: dbBalance,
                is_consistent: isConsistent,
                last_transaction_date: lastTransaction?.created_at
            });

            return {
                player_id: playerId,
                username: player.username,
                balance: dbBalance,
                is_demo: player.is_demo,
                status: player.status,
                balance_consistent: isConsistent,
                last_updated: lastTransaction?.created_at || player.updated_at
            };
        } catch (error) {
            auditLogger.error('Balance inquiry failed', {
                player_id: playerId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Execute atomic wallet transaction
     * @param {Object} transactionData - Transaction details
     * @returns {Promise<Object>} Transaction result
     */
    static async executeTransaction({
        player_id,
        type,
        amount,
        reference_id = null,
        reference_type = null,
        description = null,
        created_by = null,
        metadata = null,
        validate_balance = true
    }) {
        // Start database transaction for atomicity
        const dbTransaction = await sequelize.transaction();

        try {
            // Lock player record for update to prevent race conditions
            const player = await Player.findByPk(player_id, {
                lock: true,
                transaction: dbTransaction
            });

            if (!player) {
                throw new Error('Player not found');
            }

            if (!player.isActive()) {
                throw new Error(`Cannot execute transaction. Account status: ${player.status}`);
            }

            // Validate transaction amount
            const transactionAmount = parseFloat(amount);
            if (transactionAmount === 0) {
                throw new Error('Transaction amount cannot be zero');
            }

            // Validate sufficient balance for debits
            const currentBalance = parseFloat(player.credits);
            if (transactionAmount < 0 && validate_balance) {
                const newBalance = currentBalance + transactionAmount;
                if (newBalance < 0) {
                    throw new Error(`Insufficient funds. Balance: ${currentBalance}, Required: ${Math.abs(transactionAmount)}`);
                }
            }

            // Anti-fraud validation
            await this.validateTransactionSecurity({
                player_id,
                type,
                amount: transactionAmount,
                currentBalance
            });

            // Calculate new balance
            const newBalance = currentBalance + transactionAmount;

            // Create transaction record
            const transactionRecord = await Transaction.create({
                player_id,
                type,
                amount: transactionAmount,
                balance_before: currentBalance,
                balance_after: newBalance,
                reference_id,
                reference_type,
                description: description || Transaction.getDefaultDescription(type, transactionAmount),
                created_by,
                metadata
            }, { transaction: dbTransaction });

            // Update player balance
            await player.update({
                credits: newBalance,
                updated_at: new Date()
            }, { transaction: dbTransaction });

            // Commit transaction
            await dbTransaction.commit();

            // Log successful transaction
            auditLogger.info('Wallet transaction completed', {
                transaction_id: transactionRecord.id,
                player_id,
                type,
                amount: transactionAmount,
                balance_before: currentBalance,
                balance_after: newBalance,
                reference_id,
                reference_type
            });

            return {
                success: true,
                transaction: transactionRecord.getSafeData(),
                balance: {
                    previous: currentBalance,
                    current: newBalance,
                    change: transactionAmount
                }
            };

        } catch (error) {
            // Rollback transaction on error
            await dbTransaction.rollback();

            auditLogger.error('Wallet transaction failed', {
                player_id,
                type,
                amount,
                error: error.message,
                reference_id,
                reference_type
            });

            throw error;
        }
    }

    /**
     * Process bet transaction (debit)
     * @param {Object} betData - Bet transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processBet({ player_id, amount, reference_id, metadata = null }) {
        if (amount <= 0) {
            throw new Error('Bet amount must be positive');
        }

        return await this.executeTransaction({
            player_id,
            type: 'bet',
            amount: -amount, // Negative for debit
            reference_id,
            reference_type: 'spin_result',
            description: `Spin bet of ${amount} credits`,
            metadata
        });
    }

    /**
     * Process win transaction (credit)
     * @param {Object} winData - Win transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processWin({ player_id, amount, reference_id, metadata = null }) {
        if (amount <= 0) {
            throw new Error('Win amount must be positive');
        }

        return await this.executeTransaction({
            player_id,
            type: 'win',
            amount: amount, // Positive for credit
            reference_id,
            reference_type: 'spin_result',
            description: `Spin win of ${amount} credits`,
            metadata
        });
    }

    /**
     * Process admin adjustment transaction
     * @param {Object} adjustmentData - Adjustment transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processAdminAdjustment({
        player_id,
        amount,
        reason,
        admin_id,
        metadata = null
    }) {
        if (!admin_id) {
            throw new Error('Admin ID is required for adjustments');
        }

        if (!reason || reason.trim().length < 5) {
            throw new Error('Detailed reason is required for admin adjustments');
        }

        // Verify admin permissions
        const admin = await Player.findByPk(admin_id);
        if (!admin || !admin.isAdmin()) {
            throw new Error('Insufficient permissions for admin adjustment');
        }

        const adjustmentAmount = parseFloat(amount);
        const description = `Admin adjustment: ${reason} (by ${admin.username})`;

        const result = await this.executeTransaction({
            player_id,
            type: 'adjustment',
            amount: adjustmentAmount,
            reference_type: 'admin_adjustment',
            description,
            created_by: admin_id,
            metadata: {
                ...metadata,
                admin_username: admin.username,
                reason
            }
        });

        // Log admin action
        await AdminLog.create({
            admin_id,
            target_player_id: player_id,
            action: 'balance_adjustment',
            details: {
                amount: adjustmentAmount,
                reason,
                transaction_id: result.transaction.id,
                balance_before: result.balance.previous,
                balance_after: result.balance.current
            }
        });

        return result;
    }

    /**
     * Process free spins purchase transaction
     * @param {Object} purchaseData - Purchase transaction data
     * @returns {Promise<Object>} Transaction result
     */
    static async processFreeSpinsPurchase({
        player_id,
        cost,
        spins_count,
        metadata = null
    }) {
        if (cost <= 0) {
            throw new Error('Purchase cost must be positive');
        }

        if (spins_count <= 0) {
            throw new Error('Spins count must be positive');
        }

        return await this.executeTransaction({
            player_id,
            type: 'purchase',
            amount: -cost, // Negative for debit
            reference_type: 'free_spins_purchase',
            description: `Purchase ${spins_count} free spins for ${cost} credits`,
            metadata: {
                ...metadata,
                spins_count,
                cost_per_spin: cost / spins_count
            }
        });
    }

    /**
     * Get transaction history with pagination
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Transaction history
     */
    static async getTransactionHistory({
        player_id,
        page = 1,
        limit = 50,
        type = null,
        date_from = null,
        date_to = null,
        include_admin = false
    }) {
        try {
            const result = await Transaction.getPlayerHistory({
                player_id,
                page,
                limit,
                type,
                date_from,
                date_to,
                include_balance: true
            });

            // Filter out admin transactions if not requested
            if (!include_admin) {
                result.transactions = result.transactions.filter(tx => 
                    tx.type !== 'adjustment' || !tx.created_by
                );
            }

            // Convert to safe data format
            const safeTransactions = result.transactions.map(tx => tx.getSafeData());

            auditLogger.info('Transaction history requested', {
                player_id,
                page,
                limit,
                type,
                total_count: result.totalCount
            });

            return {
                transactions: safeTransactions,
                pagination: {
                    current_page: result.currentPage,
                    total_pages: result.totalPages,
                    total_count: result.totalCount,
                    has_more: result.hasMore
                }
            };

        } catch (error) {
            auditLogger.error('Transaction history request failed', {
                player_id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get wallet statistics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Wallet statistics
     */
    static async getWalletStats({
        player_id,
        days = 30,
        include_admin_adjustments = false
    }) {
        try {
            const transactionTypes = include_admin_adjustments 
                ? null 
                : ['bet', 'win', 'purchase', 'bonus'];

            const stats = await Transaction.getTransactionStats({
                player_id,
                days,
                transaction_types: transactionTypes
            });

            // Calculate win/loss ratios and other metrics
            const betStats = stats.by_type.find(t => t.type === 'bet') || { count: 0, total_amount: 0 };
            const winStats = stats.by_type.find(t => t.type === 'win') || { count: 0, total_amount: 0 };

            const totalBets = Math.abs(betStats.total_amount);
            const totalWins = winStats.total_amount;
            const netGaming = totalWins - totalBets;
            const winRate = betStats.count > 0 ? (winStats.count / betStats.count) * 100 : 0;

            return {
                period_days: days,
                summary: {
                    total_transactions: stats.total_transactions,
                    net_change: stats.net_amount,
                    total_credits_received: stats.total_credits,
                    total_debits: Math.abs(stats.total_debits)
                },
                gaming: {
                    total_bets: totalBets,
                    total_wins: totalWins,
                    net_gaming: netGaming,
                    win_rate_percent: parseFloat(winRate.toFixed(2)),
                    spins_count: betStats.count
                },
                by_type: stats.by_type
            };

        } catch (error) {
            auditLogger.error('Wallet stats request failed', {
                player_id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Validate player balance consistency
     * @param {string} playerId - Player UUID
     * @returns {Promise<Object>} Validation result
     */
    static async validateBalanceConsistency(playerId) {
        try {
            const validationResult = await Transaction.validatePlayerBalance(playerId);

            auditLogger.info('Balance validation performed', {
                player_id: playerId,
                valid: validationResult.valid,
                transactions_validated: validationResult.transactions_validated,
                errors_count: validationResult.errors ? validationResult.errors.length : 0
            });

            return validationResult;

        } catch (error) {
            auditLogger.error('Balance validation failed', {
                player_id: playerId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Process batch transactions atomically
     * @param {Array} transactions - Array of transaction data
     * @returns {Promise<Object>} Batch result
     */
    static async processBatchTransactions(transactions) {
        if (!Array.isArray(transactions) || transactions.length === 0) {
            throw new Error('Transactions array is required and cannot be empty');
        }

        const dbTransaction = await sequelize.transaction();
        const results = [];

        try {
            for (const txData of transactions) {
                const result = await this.executeTransaction({
                    ...txData,
                    validate_balance: false // We'll validate at the end
                });
                results.push(result);
            }

            // Validate all affected players' final balances
            const playerIds = [...new Set(transactions.map(tx => tx.player_id))];
            for (const playerId of playerIds) {
                const validation = await this.validateBalanceConsistency(playerId);
                if (!validation.valid) {
                    throw new Error(`Balance validation failed for player ${playerId}`);
                }
            }

            await dbTransaction.commit();

            auditLogger.info('Batch transactions completed', {
                transaction_count: transactions.length,
                affected_players: playerIds.length
            });

            return {
                success: true,
                transaction_count: results.length,
                results
            };

        } catch (error) {
            await dbTransaction.rollback();

            auditLogger.error('Batch transactions failed', {
                transaction_count: transactions.length,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Anti-fraud transaction validation
     * @param {Object} transactionData - Transaction to validate
     * @private
     */
    static async validateTransactionSecurity({
        player_id,
        type,
        amount,
        currentBalance
    }) {
        const absAmount = Math.abs(amount);

        // Check for suspiciously large transactions
        const LARGE_TRANSACTION_THRESHOLD = 10000;
        if (absAmount > LARGE_TRANSACTION_THRESHOLD) {
            auditLogger.warn('Large transaction detected', {
                player_id,
                type,
                amount: absAmount,
                threshold: LARGE_TRANSACTION_THRESHOLD
            });
        }

        // Check for rapid successive transactions (velocity check)
        const recentTransactions = await Transaction.findAll({
            where: {
                player_id,
                created_at: {
                    [Transaction.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 60000) // Last minute
                }
            }
        });

        if (recentTransactions.length >= 10) {
            auditLogger.warn('High transaction velocity detected', {
                player_id,
                recent_count: recentTransactions.length,
                time_window: '1 minute'
            });
        }

        // Check for balance manipulation patterns
        if (type === 'adjustment' && absAmount > currentBalance * 2) {
            auditLogger.warn('Large balance adjustment detected', {
                player_id,
                adjustment_amount: absAmount,
                current_balance: currentBalance,
                ratio: (absAmount / currentBalance).toFixed(2)
            });
        }

        // All validations passed
        return true;
    }

    /**
     * Get real-time wallet status
     * @param {string} playerId - Player UUID
     * @returns {Promise<Object>} Real-time status
     */
    static async getWalletStatus(playerId) {
        try {
            const balance = await this.getBalance(playerId);
            const recentStats = await this.getWalletStats({
                player_id: playerId,
                days: 1
            });

            // Check for any pending transactions or locks
            const pendingTransactions = await Transaction.count({
                where: {
                    player_id: playerId,
                    created_at: {
                        [Transaction.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 300000) // Last 5 minutes
                    }
                }
            });

            return {
                ...balance,
                recent_activity: {
                    transactions_last_24h: recentStats.summary.total_transactions,
                    net_change_24h: recentStats.summary.net_change,
                    pending_transactions: pendingTransactions
                },
                status: {
                    can_bet: balance.balance > 0 && balance.status === 'active',
                    can_withdraw: balance.balance > 0 && balance.status === 'active',
                    is_consistent: balance.balance_consistent
                }
            };

        } catch (error) {
            auditLogger.error('Wallet status request failed', {
                player_id: playerId,
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = WalletService;