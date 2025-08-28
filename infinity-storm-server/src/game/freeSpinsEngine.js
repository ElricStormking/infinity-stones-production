/**
 * Server-Side Free Spins Engine
 * 
 * Task 4.2: Port Free Spins Logic
 * 
 * Manages all free spins functionality including trigger detection, 
 * multiplier accumulation, retrigger handling, and completion logic.
 * Ports complete logic from client FreeSpinsManager.js.
 * 
 * CRITICAL: Must maintain identical free spins behavior and RTP contribution.
 */

const { getRNG } = require('./rng');

class FreeSpinsEngine {
    constructor(gameConfig, rng = null) {
        this.gameConfig = gameConfig;
        this.rng = rng || getRNG();
        
        // Free spins configuration (identical to client)
        this.config = {
            scatterTrigger: gameConfig.FREE_SPINS.SCATTER_4_PLUS,
            retriggerSpins: gameConfig.FREE_SPINS.RETRIGGER_SPINS,
            buyFeatureCost: gameConfig.FREE_SPINS.BUY_FEATURE_COST,
            buyFeatureSpins: gameConfig.FREE_SPINS.BUY_FEATURE_SPINS,
            baseMultiplier: gameConfig.FREE_SPINS.BASE_MULTIPLIER,
            accumTriggerChance: gameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE,
            minScatterCount: 4 // Minimum scatter count to trigger free spins
        };
        
        // Statistics tracking
        this.statistics = {
            freeSpinsTriggered: 0,
            freeSpinsRetriggered: 0,
            totalFreeSpinsAwarded: 0,
            totalFreeSpinsCompleted: 0,
            averageMultiplierAccumulated: 1,
            largestAccumulatedMultiplier: 1,
            buyFeatureUsed: 0,
            scatterDistribution: {}, // Track scatter count frequency
            initialized: Date.now()
        };
        
        // Active free spins sessions (for multi-player support)
        this.activeSessions = new Map();
        
        this.logAuditEvent('FREE_SPINS_ENGINE_INITIALIZED', {
            scatter_trigger_spins: this.config.scatterTrigger,
            retrigger_spins: this.config.retriggerSpins,
            base_multiplier: this.config.baseMultiplier,
            accum_trigger_chance: this.config.accumTriggerChance
        });
    }
    
    /**
     * Check if free spins should be triggered by scatter count
     * @param {number} scatterCount - Number of scatter symbols
     * @param {boolean} currentlyInFreeSpins - Whether currently in free spins mode
     * @returns {Object} Free spins trigger result
     */
    checkFreeSpinsTrigger(scatterCount, currentlyInFreeSpins = false) {
        // Track scatter distribution for statistics
        this.statistics.scatterDistribution[scatterCount] = 
            (this.statistics.scatterDistribution[scatterCount] || 0) + 1;
        
        if (scatterCount < this.config.minScatterCount) {
            return {
                triggered: false,
                reason: 'insufficient_scatters',
                scatterCount,
                requiredCount: this.config.minScatterCount
            };
        }
        
        if (currentlyInFreeSpins) {
            // Retrigger during free spins
            this.statistics.freeSpinsRetriggered++;
            this.statistics.totalFreeSpinsAwarded += this.config.retriggerSpins;
            
            const result = {
                triggered: true,
                type: 'retrigger',
                spinsAwarded: this.config.retriggerSpins,
                scatterCount,
                message: `+${this.config.retriggerSpins} Free Spins!`
            };
            
            this.logAuditEvent('FREE_SPINS_RETRIGGER', {
                scatter_count: scatterCount,
                spins_awarded: this.config.retriggerSpins,
                retrigger_count: this.statistics.freeSpinsRetriggered
            });
            
            return result;
        } else {
            // Initial free spins trigger
            this.statistics.freeSpinsTriggered++;
            this.statistics.totalFreeSpinsAwarded += this.config.scatterTrigger;
            
            const result = {
                triggered: true,
                type: 'initial',
                spinsAwarded: this.config.scatterTrigger,
                scatterCount,
                message: `${this.config.scatterTrigger} FREE SPINS AWARDED!`
            };
            
            this.logAuditEvent('FREE_SPINS_TRIGGERED', {
                scatter_count: scatterCount,
                spins_awarded: this.config.scatterTrigger,
                trigger_count: this.statistics.freeSpinsTriggered
            });
            
            return result;
        }
    }
    
    /**
     * Start a new free spins session
     * @param {Object} sessionData - Session initialization data
     * @returns {Object} Free spins session state
     */
    startFreeSpinsSession(sessionData) {
        const {
            sessionId,
            playerId,
            spinsAwarded,
            triggerType = 'scatter',
            betAmount,
            initialMultiplier = this.config.baseMultiplier
        } = sessionData;
        
        const session = {
            sessionId,
            playerId,
            totalSpins: spinsAwarded,
            remainingSpins: spinsAwarded,
            accumulatedMultiplier: initialMultiplier,
            totalWin: 0,
            triggerType,
            betAmount,
            started: Date.now(),
            completed: false,
            spinHistory: []
        };
        
        this.activeSessions.set(sessionId, session);
        
        this.logAuditEvent('FREE_SPINS_SESSION_STARTED', {
            session_id: sessionId,
            player_id: playerId,
            spins_awarded: spinsAwarded,
            trigger_type: triggerType,
            bet_amount: betAmount,
            initial_multiplier: initialMultiplier
        });
        
        return session;
    }
    
    /**
     * Process a single free spin within a session
     * @param {string} sessionId - Free spins session ID
     * @param {Object} spinResult - Result from spin processing
     * @returns {Object} Updated session state
     */
    processFreeSpinResult(sessionId, spinResult) {
        const session = this.activeSessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Free spins session ${sessionId} not found`);
        }
        
        // Apply accumulated multiplier to win
        const multipliedWin = spinResult.totalWin * session.accumulatedMultiplier;
        
        // Update session state
        session.remainingSpins = Math.max(0, session.remainingSpins - 1);
        session.totalWin += multipliedWin;
        session.spinHistory.push({
            spinNumber: session.totalSpins - session.remainingSpins,
            baseWin: spinResult.totalWin,
            multiplier: session.accumulatedMultiplier,
            multipliedWin,
            timestamp: Date.now()
        });
        
        // Handle retriggers if scatter symbols present
        if (spinResult.bonusFeatures?.freeSpinsTriggered) {
            session.remainingSpins += spinResult.bonusFeatures.freeSpinsAwarded;
            session.totalSpins += spinResult.bonusFeatures.freeSpinsAwarded;
            
            this.logAuditEvent('FREE_SPINS_RETRIGGERED_IN_SESSION', {
                session_id: sessionId,
                spins_added: spinResult.bonusFeatures.freeSpinsAwarded,
                new_remaining: session.remainingSpins,
                new_total: session.totalSpins
            });
        }
        
        // Update accumulated multiplier if new multipliers were awarded
        if (spinResult.bonusFeatures?.randomMultipliers?.length > 0) {
            const additionalMultiplier = spinResult.bonusFeatures.randomMultipliers
                .reduce((sum, mult) => sum + mult.multiplier, 0);
            session.accumulatedMultiplier += additionalMultiplier;
            
            // Track largest accumulated multiplier
            this.statistics.largestAccumulatedMultiplier = Math.max(
                this.statistics.largestAccumulatedMultiplier,
                session.accumulatedMultiplier
            );
        }
        
        // Check if session is complete
        if (session.remainingSpins === 0) {
            session.completed = true;
            session.completedAt = Date.now();
            
            this.completeFreeSpinsSession(sessionId);
        }
        
        this.logAuditEvent('FREE_SPIN_PROCESSED', {
            session_id: sessionId,
            spin_number: session.totalSpins - session.remainingSpins,
            base_win: spinResult.totalWin,
            multiplied_win: multipliedWin,
            accumulated_multiplier: session.accumulatedMultiplier,
            remaining_spins: session.remainingSpins
        });
        
        return {
            ...session,
            currentSpinResult: {
                ...spinResult,
                multipliedWin,
                accumulatedMultiplier: session.accumulatedMultiplier
            }
        };
    }
    
    /**
     * Complete and finalize a free spins session
     * @param {string} sessionId - Session to complete
     * @returns {Object} Final session result
     */
    completeFreeSpinsSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Free spins session ${sessionId} not found`);
        }
        
        // Update statistics
        this.statistics.totalFreeSpinsCompleted++;
        
        // Calculate session statistics
        const sessionDuration = Date.now() - session.started;
        const averageWinPerSpin = session.totalSpins > 0 ? session.totalWin / session.totalSpins : 0;
        const finalMultiplier = session.accumulatedMultiplier;
        
        // Update average accumulated multiplier
        const totalSessions = this.statistics.totalFreeSpinsCompleted;
        this.statistics.averageMultiplierAccumulated = 
            ((this.statistics.averageMultiplierAccumulated * (totalSessions - 1)) + finalMultiplier) / totalSessions;
        
        const finalResult = {
            ...session,
            sessionStatistics: {
                duration: sessionDuration,
                averageWinPerSpin,
                finalMultiplier,
                totalWinMultiplier: session.totalWin / session.betAmount,
                efficiency: session.totalWin / (session.totalSpins * session.betAmount) // Win per spin per bet
            }
        };
        
        this.logAuditEvent('FREE_SPINS_SESSION_COMPLETED', {
            session_id: sessionId,
            player_id: session.playerId,
            total_spins: session.totalSpins,
            total_win: session.totalWin,
            final_multiplier: finalMultiplier,
            session_duration: sessionDuration,
            average_win_per_spin: averageWinPerSpin,
            win_multiplier: finalResult.sessionStatistics.totalWinMultiplier
        });
        
        // Remove from active sessions
        this.activeSessions.delete(sessionId);
        
        return finalResult;
    }
    
    /**
     * Handle free spins buy feature purchase
     * @param {Object} purchaseData - Purchase request data
     * @returns {Object} Purchase result and session start
     */
    processBuyFeature(purchaseData) {
        const {
            sessionId,
            playerId,
            betAmount,
            playerBalance
        } = purchaseData;
        
        const cost = betAmount * this.config.buyFeatureCost;
        
        if (playerBalance < cost) {
            return {
                success: false,
                reason: 'insufficient_balance',
                cost,
                balance: playerBalance
            };
        }
        
        // Update statistics
        this.statistics.buyFeatureUsed++;
        this.statistics.totalFreeSpinsAwarded += this.config.buyFeatureSpins;
        
        // Start free spins session
        const session = this.startFreeSpinsSession({
            sessionId,
            playerId,
            spinsAwarded: this.config.buyFeatureSpins,
            triggerType: 'purchase',
            betAmount,
            initialMultiplier: this.config.baseMultiplier
        });
        
        this.logAuditEvent('BUY_FEATURE_PURCHASED', {
            session_id: sessionId,
            player_id: playerId,
            cost,
            spins_awarded: this.config.buyFeatureSpins,
            buy_feature_count: this.statistics.buyFeatureUsed
        });
        
        return {
            success: true,
            cost,
            session,
            spinsAwarded: this.config.buyFeatureSpins,
            message: `${this.config.buyFeatureSpins} FREE SPINS PURCHASED!`
        };
    }
    
    /**
     * Process cascade multiplier trigger during free spins
     * @param {number} cascadeCount - Current cascade number
     * @param {number} cascadeWin - Win from current cascade
     * @param {number} betAmount - Current bet amount
     * @returns {Object} Cascade multiplier result
     */
    async processCascadeMultiplier(cascadeCount, cascadeWin, betAmount) {
        // Only trigger in cascades after the first one
        if (cascadeCount <= 1) {
            return {
                triggered: false,
                reason: 'first_cascade_exempt'
            };
        }
        
        // Check trigger probability
        const triggerRoll = this.rng.random();
        if (triggerRoll > this.config.accumTriggerChance) {
            return {
                triggered: false,
                reason: 'probability_not_met',
                triggerRoll,
                triggerChance: this.config.accumTriggerChance,
                cascadeCount
            };
        }
        
        // Use the same multiplier table as regular random multipliers
        const multiplierTable = this.gameConfig.RANDOM_MULTIPLIER.TABLE;
        const randomMultiplier = multiplierTable[
            this.rng.randomInt(0, multiplierTable.length - 1)
        ];
        
        // Select random position for effect
        const position = {
            col: this.rng.randomInt(0, this.gameConfig.GRID_COLS - 1),
            row: this.rng.randomInt(0, this.gameConfig.GRID_ROWS - 1)
        };
        
        // Select character for animation (80% Thanos, 20% Scarlet Witch)
        const character = this.rng.random() < 0.8 ? 'thanos' : 'scarlet_witch';
        
        const result = {
            triggered: true,
            multiplier: randomMultiplier,
            position,
            character,
            cascadeCount,
            cascadeWin,
            type: 'free_spins_cascade_multiplier',
            animationDuration: this.gameConfig.RANDOM_MULTIPLIER.ANIMATION_DURATION,
            metadata: {
                triggerRoll,
                triggerChance: this.config.accumTriggerChance
            }
        };
        
        this.logAuditEvent('FREE_SPINS_CASCADE_MULTIPLIER', {
            cascade_count: cascadeCount,
            multiplier: randomMultiplier,
            position: `${position.col},${position.row}`,
            character,
            cascade_win: cascadeWin,
            trigger_roll: triggerRoll
        });
        
        return result;
    }
    
    /**
     * Get active session data
     * @param {string} sessionId - Session ID to retrieve
     * @returns {Object|null} Session data or null if not found
     */
    getActiveSession(sessionId) {
        return this.activeSessions.get(sessionId) || null;
    }
    
    /**
     * Get all active sessions (for admin monitoring)
     * @returns {Array<Object>} Array of active sessions
     */
    getAllActiveSessions() {
        return Array.from(this.activeSessions.values());
    }
    
    /**
     * Calculate free spins RTP contribution
     * @returns {Object} RTP analysis
     */
    calculateRTPContribution() {
        const totalSpinsTriggered = this.statistics.freeSpinsTriggered + this.statistics.buyFeatureUsed;
        
        if (totalSpinsTriggered === 0) {
            return {
                triggered: 0,
                averageSpinsPerTrigger: 0,
                expectedFrequency: 0,
                rtpContribution: 0
            };
        }
        
        const averageSpinsPerTrigger = this.statistics.totalFreeSpinsAwarded / totalSpinsTriggered;
        const averageMultiplier = this.statistics.averageMultiplierAccumulated;
        
        // Estimate based on 4+ scatter probability (approximately 1 in 400 spins)
        const estimatedTriggerFrequency = 1 / 400;
        const rtpContribution = estimatedTriggerFrequency * averageSpinsPerTrigger * averageMultiplier;
        
        return {
            triggered: totalSpinsTriggered,
            averageSpinsPerTrigger,
            averageMultiplier,
            estimatedTriggerFrequency,
            rtpContribution,
            rtpContributionPercent: (rtpContribution * 100).toFixed(2) + '%'
        };
    }
    
    /**
     * Get comprehensive free spins statistics
     * @returns {Object} Detailed statistics
     */
    getStatistics() {
        const rtpContribution = this.calculateRTPContribution();
        const activeSessions = this.getAllActiveSessions();
        
        return {
            ...this.statistics,
            uptime: Date.now() - this.statistics.initialized,
            activeSessions: activeSessions.length,
            activeSessionIds: activeSessions.map(s => s.sessionId),
            rtpAnalysis: rtpContribution,
            triggerRates: {
                scatterTriggerChance: 'Variable (scatter-based)',
                cascadeMultiplierChance: (this.config.accumTriggerChance * 100).toFixed(1) + '%',
                retriggerRate: this.statistics.freeSpinsTriggered > 0 ? 
                    (this.statistics.freeSpinsRetriggered / this.statistics.freeSpinsTriggered * 100).toFixed(1) + '%' : '0%'
            },
            efficiency: {
                averageSpinsPerSession: this.statistics.totalFreeSpinsCompleted > 0 ? 
                    this.statistics.totalFreeSpinsAwarded / this.statistics.totalFreeSpinsCompleted : 0,
                buyFeatureUsageRate: this.statistics.buyFeatureUsed > 0 ? 
                    (this.statistics.buyFeatureUsed / (this.statistics.freeSpinsTriggered + this.statistics.buyFeatureUsed) * 100).toFixed(1) + '%' : '0%'
            }
        };
    }
    
    /**
     * Validate free spins engine integrity
     * @returns {Object} Validation result
     */
    validateIntegrity() {
        const hasValidConfig = this.config.scatterTrigger > 0 && this.config.retriggerSpins > 0;
        const hasValidTriggerChance = this.config.accumTriggerChance >= 0 && this.config.accumTriggerChance <= 1;
        const hasValidMultipliers = this.config.baseMultiplier > 0;
        const hasValidBuyFeature = this.config.buyFeatureCost > 0 && this.config.buyFeatureSpins > 0;
        
        return {
            valid: hasValidConfig && hasValidTriggerChance && hasValidMultipliers && hasValidBuyFeature,
            checks: {
                validConfig: hasValidConfig,
                validTriggerChance: hasValidTriggerChance,
                validMultipliers: hasValidMultipliers,
                validBuyFeature: hasValidBuyFeature,
                activeSessionsCount: this.activeSessions.size
            }
        };
    }
    
    /**
     * Reset statistics and clear active sessions (for testing/maintenance)
     */
    resetStatistics() {
        this.statistics = {
            freeSpinsTriggered: 0,
            freeSpinsRetriggered: 0,
            totalFreeSpinsAwarded: 0,
            totalFreeSpinsCompleted: 0,
            averageMultiplierAccumulated: 1,
            largestAccumulatedMultiplier: 1,
            buyFeatureUsed: 0,
            scatterDistribution: {},
            initialized: Date.now()
        };
        
        // Clear active sessions (with warning)
        const activeCount = this.activeSessions.size;
        this.activeSessions.clear();
        
        this.logAuditEvent('STATISTICS_RESET', {
            cleared_active_sessions: activeCount
        });
    }
    
    /**
     * Force complete all active sessions (emergency cleanup)
     * @returns {Array<Object>} Results from completed sessions
     */
    forceCompleteAllSessions() {
        const results = [];
        
        for (const [sessionId, session] of this.activeSessions) {
            session.completed = true;
            session.completedAt = Date.now();
            session.forceCompleted = true;
            
            results.push(this.completeFreeSpinsSession(sessionId));
        }
        
        this.logAuditEvent('ALL_SESSIONS_FORCE_COMPLETED', {
            sessions_completed: results.length
        });
        
        return results;
    }
    
    /**
     * Log audit event for compliance
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @private
     */
    logAuditEvent(event, data = {}) {
        this.rng.emit('audit_event', {
            timestamp: Date.now(),
            component: 'FreeSpinsEngine',
            event,
            data
        });
    }
}

module.exports = FreeSpinsEngine;