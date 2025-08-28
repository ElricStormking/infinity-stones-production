/**
 * Game Controller - Core Game API Logic
 * 
 * Handles all game-related operations with complete integration:
 * - Spin processing with full game engine integration
 * - Credit management with atomic transactions
 * - State management and persistence
 * - Anti-cheat validation
 * - Comprehensive audit logging
 * 
 * Features:
 * - Production-ready error handling
 * - Transaction rollback on failures
 * - Session state updates
 * - Performance monitoring
 * - Casino-grade security validation
 */

const GameEngine = require('../game/gameEngine');
const StateManager = require('../game/stateManager');
const AntiCheat = require('../game/antiCheat');
const AuditLogger = require('../game/auditLogger');
const WalletService = require('../services/walletService');
const { Player, Transaction, SpinResult } = require('../models');
const pool = require('../db/pool');
const { logger } = require("../utils/logger.js");

class GameController {
    constructor() {
        this.gameEngine = new GameEngine();
        this.stateManager = new StateManager();
        this.antiCheat = new AntiCheat();
        this.auditLogger = new AuditLogger();
        
        // Performance monitoring
        this.spinMetrics = {
            totalSpins: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            lastResetTime: Date.now()
        };
    }
    
    /**
     * Process spin request - main game endpoint
     * POST /api/spin
     */
    async processSpin(req, res) {
        const startTime = Date.now();
        const spinId = this.generateSpinId();
        
        try {
            const { 
                betAmount = 1.00,
                quickSpinMode = false,
                freeSpinsActive = false,
                accumulatedMultiplier = 1,
                bonusMode = false 
            } = req.body;
            
            const playerId = req.user.id;
            const sessionId = req.session_info.id;
            
            // Input validation
            const validation = this.validateSpinRequest(req.body, req.user);
            if (!validation.valid) {
                await this.auditLogger.logSpinError(playerId, spinId, 'validation_failed', validation.errors);
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_FAILED',
                    message: 'Invalid spin request',
                    details: validation.errors
                });
            }
            
            // Anti-cheat validation
            const antiCheatResult = await this.antiCheat.validateSpinRequest(
                playerId, 
                req.body, 
                req.user, 
                req.session_info
            );
            
            if (!antiCheatResult.valid) {
                await this.auditLogger.logAntiCheatViolation(playerId, 'spin_request', antiCheatResult.violations);
                return res.status(403).json({
                    success: false,
                    error: 'ANTI_CHEAT_VIOLATION',
                    message: 'Spin request failed security validation',
                    code: 'SECURITY_VIOLATION'
                });
            }
            
            // Start database transaction for atomic operations
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // Get current player state with lock
                const player = await Player.findByPk(playerId, {
                    lock: Transaction.LOCK.UPDATE,
                    transaction: client
                });
                
                if (!player) {
                    throw new Error('Player not found');
                }
                
                // Process bet transaction using wallet service (if not demo mode)
                let betTransaction = null;
                if (!player.is_demo) {
                    try {
                        betTransaction = await WalletService.processBet({
                            player_id: playerId,
                            amount: betAmount,
                            reference_id: spinId,
                            metadata: {
                                session_id: sessionId,
                                quick_spin_mode: quickSpinMode,
                                free_spins_active: freeSpinsActive
                            }
                        });
                    } catch (walletError) {
                        await client.query('ROLLBACK');
                        
                        if (walletError.message.includes('Insufficient funds')) {
                            return res.status(400).json({
                                success: false,
                                error: 'INSUFFICIENT_CREDITS',
                                message: walletError.message,
                                availableCredits: player.credits
                            });
                        }
                        
                        throw walletError;
                    }
                }
                
                // Get current game state
                const gameState = await this.stateManager.getPlayerState(playerId);
                
                // Process spin with game engine
                const spinRequest = {
                    betAmount: parseFloat(betAmount),
                    playerId,
                    sessionId,
                    freeSpinsActive: Boolean(freeSpinsActive),
                    freeSpinsRemaining: gameState ? gameState.free_spins_remaining : 0,
                    accumulatedMultiplier: parseFloat(accumulatedMultiplier),
                    quickSpinMode: Boolean(quickSpinMode),
                    bonusMode: Boolean(bonusMode),
                    spinId
                };
                
                const spinResult = await this.gameEngine.processCompleteSpin(spinRequest);
                
                // Validate spin result
                const resultValidation = this.gameEngine.validateGameResult(spinResult);
                if (!resultValidation.valid) {
                    await client.query('ROLLBACK');
                    await this.auditLogger.logSpinError(playerId, spinId, 'result_validation_failed', resultValidation);
                    
                    return res.status(500).json({
                        success: false,
                        error: 'SPIN_VALIDATION_FAILED',
                        message: 'Spin result failed validation',
                        code: 'RESULT_INVALID'
                    });
                }
                
                // Credit winnings using wallet service (if any)
                let winTransaction = null;
                if (spinResult.totalWin > 0 && !player.is_demo) {
                    try {
                        winTransaction = await WalletService.processWin({
                            player_id: playerId,
                            amount: spinResult.totalWin,
                            reference_id: spinId,
                            metadata: {
                                session_id: sessionId,
                                base_win: spinResult.baseWin,
                                bonus_win: spinResult.totalWin - spinResult.baseWin,
                                cascade_count: spinResult.cascadeSteps ? spinResult.cascadeSteps.length : 0,
                                multiplier_applied: accumulatedMultiplier
                            }
                        });
                    } catch (walletError) {
                        await client.query('ROLLBACK');
                        throw walletError;
                    }
                }
                
                // Update game state based on spin result
                const stateResult = await this.stateManager.processSpinResult(playerId, spinResult);
                
                // Persist spin result to database
                await SpinResult.create({
                    spin_id: spinId,
                    player_id: playerId,
                    session_id: sessionId,
                    bet_amount: betAmount,
                    total_win: spinResult.totalWin,
                    spin_data: {
                        ...spinResult,
                        processingTime: Date.now() - startTime,
                        antiCheatScore: antiCheatResult.confidenceScore,
                        validationChecks: resultValidation
                    },
                    rng_seed: spinResult.rngSeed,
                    free_spins_active: freeSpinsActive,
                    game_mode: gameState ? gameState.game_mode : 'base'
                }, { transaction: client });
                
                // Commit transaction
                await client.query('COMMIT');
                
                // Get current balance for response
                let currentBalance = null;
                if (!player.is_demo) {
                    try {
                        const balanceInfo = await WalletService.getBalance(playerId);
                        currentBalance = balanceInfo.balance;
                    } catch (balanceError) {
                        logger.warn('Failed to get current balance for response', {
                            player_id: playerId,
                            spin_id: spinId,
                            error: balanceError.message
                        });
                        currentBalance = 'unavailable';
                    }
                }
                
                // Update performance metrics
                this.updateSpinMetrics(Date.now() - startTime, true);
                
                // Log successful spin
                await this.auditLogger.logSpinCompleted(playerId, spinId, spinResult, {
                    processingTime: Date.now() - startTime,
                    creditsAfter: currentBalance,
                    transactionIds: {
                        debit: betTransaction ? betTransaction.transaction.id : null,
                        credit: winTransaction ? winTransaction.transaction.id : null
                    }
                });
                
                // Prepare response
                const response = {
                    success: true,
                    spinId: spinResult.spinId,
                    betAmount: spinResult.betAmount,
                    totalWin: spinResult.totalWin,
                    baseWin: spinResult.baseWin,
                    initialGrid: spinResult.initialGrid,
                    finalGrid: spinResult.finalGrid,
                    cascadeSteps: spinResult.cascadeSteps,
                    bonusFeatures: spinResult.bonusFeatures,
                    timing: spinResult.timing,
                    freeSpinsRemaining: stateResult.gameState.free_spins_remaining,
                    gameMode: stateResult.gameState.game_mode,
                    accumulatedMultiplier: stateResult.gameState.accumulated_multiplier,
                    playerCredits: player.is_demo ? null : currentBalance,
                    sessionData: {
                        totalSpins: this.spinMetrics.totalSpins,
                        sessionRTP: this.gameEngine.calculateSessionRTP(
                            this.gameEngine.sessionStats.totalBet,
                            this.gameEngine.sessionStats.totalWon
                        )
                    },
                    metadata: {
                        processingTime: Date.now() - startTime,
                        rngAuditId: spinResult.rngSeed,
                        antiCheatPassed: true,
                        validationScore: resultValidation.sessionRTP
                    }
                };
                
                res.json(response);
                
            } catch (transactionError) {
                // Rollback transaction on any error
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }
            
        } catch (error) {
            // Update error metrics
            this.updateSpinMetrics(Date.now() - startTime, false);
            
            await this.auditLogger.logSpinError(req.user.id, spinId, 'processing_error', {
                error: error.message,
                stack: error.stack,
                processingTime: Date.now() - startTime
            });
            
            logger.error('Spin processing error', {
                playerId: req.user.id,
                spinId,
                error: error.message,
                stack: error.stack,
                processingTime: Date.now() - startTime
            });
            
            res.status(500).json({
                success: false,
                error: 'SPIN_PROCESSING_ERROR',
                message: 'Failed to process spin request',
                code: 'PROCESSING_FAILED',
                spinId
            });
        }
    }
    
    /**
     * Get current game state
     * GET /api/game-state
     */
    async getGameState(req, res) {
        try {
            const playerId = req.user.id;
            
            // Get game state from state manager
            const gameState = await this.stateManager.getPlayerState(playerId);
            const sessionInfo = this.stateManager.getActiveSession(req.session_info.id);
            
            if (!gameState) {
                return res.status(404).json({
                    success: false,
                    error: 'STATE_NOT_FOUND',
                    message: 'No game state found for player'
                });
            }
            
            // Get game engine statistics
            const gameStats = this.gameEngine.getGameStatistics();
            
            const response = {
                success: true,
                gameState: gameState.getSafeData(),
                sessionInfo: sessionInfo,
                gameMode: gameState.game_mode,
                freeSpinsRemaining: gameState.free_spins_remaining,
                accumulatedMultiplier: gameState.accumulated_multiplier,
                lastActivity: gameState.updated_at,
                gameStatistics: {
                    sessionRTP: gameStats.session.currentRTP,
                    totalSpins: gameStats.session.totalSpins,
                    winRate: gameStats.session.winRate,
                    biggestWin: gameStats.session.biggestWin
                },
                serverTime: new Date().toISOString()
            };
            
            res.json(response);
            
        } catch (error) {
            logger.error('Get game state error', {
                playerId: req.user.id,
                error: error.message,
                stack: error.stack
            });
            
            res.status(500).json({
                success: false,
                error: 'STATE_RETRIEVAL_ERROR',
                message: 'Failed to retrieve game state'
            });
        }
    }
    
    /**
     * Update game state manually (admin/debugging)
     * PUT /api/game-state
     */
    async updateGameState(req, res) {
        try {
            const playerId = req.user.id;
            const { stateUpdates, reason = 'manual_update' } = req.body;
            
            if (!stateUpdates || typeof stateUpdates !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_UPDATES',
                    message: 'State updates must be provided as an object'
                });
            }
            
            // Update state through state manager
            const updatedState = await this.stateManager.updateState(playerId, stateUpdates, reason);
            
            await this.auditLogger.logManualStateUpdate(playerId, stateUpdates, reason, req.user);
            
            res.json({
                success: true,
                message: 'Game state updated successfully',
                gameState: updatedState.getSafeData(),
                updatedFields: Object.keys(stateUpdates),
                reason
            });
            
        } catch (error) {
            logger.error('Update game state error', {
                playerId: req.user.id,
                error: error.message,
                stack: error.stack
            });
            
            res.status(500).json({
                success: false,
                error: 'STATE_UPDATE_ERROR',
                message: 'Failed to update game state'
            });
        }
    }
    
    /**
     * Get player statistics
     * GET /api/player-stats
     */
    async getPlayerStats(req, res) {
        try {
            const playerId = req.user.id;
            
            // Get player data
            const player = await Player.findByPk(playerId, {
                include: ['transactions', 'spinResults']
            });
            
            if (!player) {
                return res.status(404).json({
                    success: false,
                    error: 'PLAYER_NOT_FOUND',
                    message: 'Player not found'
                });
            }
            
            // Calculate statistics
            const stats = await this.calculatePlayerStatistics(player);
            const gameState = await this.stateManager.getPlayerState(playerId);
            const gameEngineStats = this.gameEngine.getGameStatistics();
            
            const response = {
                success: true,
                playerId: player.id,
                username: player.username,
                accountType: player.is_demo ? 'demo' : 'real',
                status: player.status,
                credits: player.is_demo ? null : player.credits,
                statistics: {
                    ...stats,
                    currentSession: {
                        ...gameEngineStats.session,
                        gameMode: gameState ? gameState.game_mode : 'base',
                        freeSpinsRemaining: gameState ? gameState.free_spins_remaining : 0,
                        accumulatedMultiplier: gameState ? gameState.accumulated_multiplier : 1
                    }
                },
                lastActivity: player.updated_at,
                memberSince: player.created_at
            };
            
            res.json(response);
            
        } catch (error) {
            logger.error('Get player stats error', {
                playerId: req.user.id,
                error: error.message,
                stack: error.stack
            });
            
            res.status(500).json({
                success: false,
                error: 'STATS_RETRIEVAL_ERROR',
                message: 'Failed to retrieve player statistics'
            });
        }
    }
    
    /**
     * Get game health and status
     * GET /api/game-status
     */
    async getGameStatus(req, res) {
        try {
            const gameStats = this.gameEngine.getGameStatistics();
            const stateManagerStats = await this.stateManager.getStats();
            const antiCheatStats = this.antiCheat.getStatistics();
            
            const response = {
                success: true,
                status: 'operational',
                uptime: process.uptime(),
                version: process.env.GAME_VERSION || '1.0.0',
                gameEngine: {
                    status: 'healthy',
                    rtp: gameStats.compliance.targetRTP,
                    totalSpins: gameStats.session.totalSpins,
                    rngCompliance: gameStats.rng.compliance_status
                },
                stateManager: {
                    status: 'healthy',
                    activeSessions: stateManagerStats.active_sessions,
                    cachedStates: stateManagerStats.cached_states,
                    redisConnected: stateManagerStats.redis_connected
                },
                antiCheat: {
                    status: 'active',
                    detectionsToday: antiCheatStats.detectionsToday,
                    overallThreatLevel: antiCheatStats.overallThreatLevel
                },
                performance: {
                    averageSpinTime: this.spinMetrics.averageProcessingTime,
                    errorRate: this.spinMetrics.errorRate,
                    totalSpinsProcessed: this.spinMetrics.totalSpins
                },
                timestamp: new Date().toISOString()
            };
            
            res.json(response);
            
        } catch (error) {
            logger.error('Get game status error', {
                error: error.message,
                stack: error.stack
            });
            
            res.status(500).json({
                success: false,
                error: 'STATUS_ERROR',
                message: 'Failed to retrieve game status'
            });
        }
    }
    
    /**
     * Validate spin request data
     * @param {Object} requestData - Spin request data
     * @param {Object} user - User object
     * @returns {Object} Validation result
     */
    validateSpinRequest(requestData, user) {
        const errors = [];
        
        // Validate bet amount
        const betAmount = parseFloat(requestData.betAmount);
        if (isNaN(betAmount) || betAmount <= 0) {
            errors.push('Invalid bet amount: must be a positive number');
        }
        
        if (betAmount > 1000) {
            errors.push('Bet amount exceeds maximum limit');
        }
        
        // Validate multiplier
        const multiplier = parseFloat(requestData.accumulatedMultiplier || 1);
        if (isNaN(multiplier) || multiplier < 1 || multiplier > 5000) {
            errors.push('Invalid accumulated multiplier: must be between 1 and 5000');
        }
        
        // Validate user status
        if (user.status !== 'active') {
            errors.push('Player account is not active');
        }
        
        // Additional demo mode validations
        if (user.is_demo && betAmount > 10) {
            errors.push('Demo mode bet amount cannot exceed 10');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Calculate comprehensive player statistics
     * @param {Player} player - Player model instance
     * @returns {Promise<Object>} Player statistics
     */
    async calculatePlayerStatistics(player) {
        const spinResults = await SpinResult.findAll({
            where: { player_id: player.id },
            order: [['created_at', 'DESC']],
            limit: 1000 // Last 1000 spins
        });
        
        const transactions = await Transaction.findAll({
            where: { player_id: player.id },
            order: [['created_at', 'DESC']]
        });
        
        // Calculate statistics
        const totalSpins = spinResults.length;
        const totalBet = spinResults.reduce((sum, spin) => sum + parseFloat(spin.bet_amount), 0);
        const totalWon = spinResults.reduce((sum, spin) => sum + parseFloat(spin.total_win), 0);
        const winningSpins = spinResults.filter(spin => parseFloat(spin.total_win) > 0).length;
        const biggestWin = Math.max(...spinResults.map(spin => parseFloat(spin.total_win)), 0);
        
        const rtp = totalBet > 0 ? (totalWon / totalBet * 100) : 0;
        const winRate = totalSpins > 0 ? (winningSpins / totalSpins * 100) : 0;
        
        // Free spins statistics
        const freeSpinsResults = spinResults.filter(spin => spin.free_spins_active);
        const freeSpinsTotalWon = freeSpinsResults.reduce((sum, spin) => sum + parseFloat(spin.total_win), 0);
        
        return {
            totalSpins,
            totalBet: Math.round(totalBet * 100) / 100,
            totalWon: Math.round(totalWon * 100) / 100,
            winRate: Math.round(winRate * 100) / 100,
            rtp: Math.round(rtp * 100) / 100,
            biggestWin: Math.round(biggestWin * 100) / 100,
            averageBet: totalSpins > 0 ? Math.round((totalBet / totalSpins) * 100) / 100 : 0,
            averageWin: winningSpins > 0 ? Math.round((totalWon / winningSpins) * 100) / 100 : 0,
            freeSpinsStats: {
                totalFreeSpins: freeSpinsResults.length,
                freeSpinsTotalWon: Math.round(freeSpinsTotalWon * 100) / 100,
                averageFreeSpinWin: freeSpinsResults.length > 0 ? 
                    Math.round((freeSpinsTotalWon / freeSpinsResults.length) * 100) / 100 : 0
            },
            transactionStats: {
                totalTransactions: transactions.length,
                totalDeposits: transactions
                    .filter(t => t.transaction_type === 'credit' && t.description.includes('deposit'))
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0),
                totalWithdrawals: transactions
                    .filter(t => t.transaction_type === 'debit' && t.description.includes('withdrawal'))
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
            }
        };
    }
    
    /**
     * Update spin processing metrics
     * @param {number} processingTime - Processing time in milliseconds
     * @param {boolean} success - Whether the spin was successful
     */
    updateSpinMetrics(processingTime, success) {
        this.spinMetrics.totalSpins++;
        
        // Update rolling average processing time
        const weight = Math.min(this.spinMetrics.totalSpins, 100);
        this.spinMetrics.averageProcessingTime = 
            (this.spinMetrics.averageProcessingTime * (weight - 1) + processingTime) / weight;
        
        // Update error rate
        if (!success) {
            this.spinMetrics.errorRate = 
                (this.spinMetrics.errorRate * (this.spinMetrics.totalSpins - 1) + 1) / this.spinMetrics.totalSpins;
        } else {
            this.spinMetrics.errorRate = 
                (this.spinMetrics.errorRate * (this.spinMetrics.totalSpins - 1)) / this.spinMetrics.totalSpins;
        }
        
        // Reset metrics every hour
        if (Date.now() - this.spinMetrics.lastResetTime > 60 * 60 * 1000) {
            this.resetSpinMetrics();
        }
    }
    
    /**
     * Reset spin metrics for fresh hourly calculations
     */
    resetSpinMetrics() {
        this.spinMetrics = {
            totalSpins: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            lastResetTime: Date.now()
        };
    }
    
    /**
     * Generate unique spin ID
     * @returns {string} Unique spin identifier
     */
    generateSpinId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `spin_${timestamp}_${random}`;
    }
}

module.exports = new GameController();