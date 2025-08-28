/**
 * Server-Side Multiplier Engine
 * 
 * Task 4.2: Port Multiplier Logic
 * 
 * Handles all multiplier logic including random multipliers (2x-500x) and 
 * accumulated multipliers during free spins. Ports logic from client
 * multiplier systems and bonus managers.
 * 
 * CRITICAL: Must maintain identical multiplier generation and application as client.
 */

const { getRNG } = require('./rng');

class MultiplierEngine {
    constructor(gameConfig, rng = null) {
        this.gameConfig = gameConfig;
        this.rng = rng || getRNG();
        
        // Multiplier configuration (identical to client)
        this.config = {
            randomMultiplier: {
                triggerChance: gameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE,
                minWinRequired: gameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED,
                animationDuration: gameConfig.RANDOM_MULTIPLIER.ANIMATION_DURATION,
                table: gameConfig.RANDOM_MULTIPLIER.TABLE
            },
            freeSpinsMultiplier: {
                baseMultiplier: gameConfig.FREE_SPINS.BASE_MULTIPLIER,
                accumTriggerChance: gameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE
            }
        };
        
        // Statistics tracking
        this.statistics = {
            randomMultipliersTriggered: 0,
            totalRandomMultiplierValue: 0,
            largestRandomMultiplier: 0,
            freeSpinsMultipliersApplied: 0,
            totalFreeSpinsMultiplierValue: 0,
            largestAccumulatedMultiplier: 1,
            averageRandomMultiplier: 0,
            initialized: Date.now()
        };
        
        // Character selection for animations (Thanos vs Scarlet Witch)
        this.characterWeights = {
            thanos: 0.8,      // 80% chance for Thanos (testing power grip animation)
            scarlet_witch: 0.2 // 20% chance for Scarlet Witch
        };
        
        this.logAuditEvent('MULTIPLIER_ENGINE_INITIALIZED', {
            random_multiplier_trigger_chance: this.config.randomMultiplier.triggerChance,
            multiplier_table_size: this.config.randomMultiplier.table.length,
            max_multiplier: Math.max(...this.config.randomMultiplier.table),
            min_multiplier: Math.min(...this.config.randomMultiplier.table)
        });
    }
    
    /**
     * Process random multiplier for base game wins
     * @param {number} totalWin - Current total win amount
     * @param {number} betAmount - Current bet amount
     * @returns {Object} Random multiplier result
     */
    async processRandomMultiplier(totalWin, betAmount) {
        // Check minimum win requirement
        if (totalWin < this.config.randomMultiplier.minWinRequired) {
            return {
                triggered: false,
                reason: 'win_too_small',
                minWinRequired: this.config.randomMultiplier.minWinRequired
            };
        }
        
        // Check trigger probability
        const triggerRoll = this.rng.random();
        if (triggerRoll > this.config.randomMultiplier.triggerChance) {
            return {
                triggered: false,
                reason: 'probability_not_met',
                triggerRoll,
                triggerChance: this.config.randomMultiplier.triggerChance
            };
        }
        
        // Select random multiplier from weighted table
        const multiplier = this.selectRandomMultiplier();
        
        // Select random position for effect
        const position = {
            col: this.rng.randomInt(0, this.gameConfig.GRID_COLS - 1),
            row: this.rng.randomInt(0, this.gameConfig.GRID_ROWS - 1)
        };
        
        // Select character for animation (weighted selection)
        const character = this.selectCharacterForMultiplier();
        
        // Update statistics
        this.updateRandomMultiplierStatistics(multiplier);
        
        const result = {
            triggered: true,
            multiplier,
            position,
            character,
            animationDuration: this.config.randomMultiplier.animationDuration,
            originalWin: totalWin,
            multipliedWin: totalWin * multiplier,
            metadata: {
                triggerRoll,
                triggerChance: this.config.randomMultiplier.triggerChance,
                tableIndex: this.config.randomMultiplier.table.indexOf(multiplier)
            }
        };
        
        this.logAuditEvent('RANDOM_MULTIPLIER_TRIGGERED', {
            multiplier,
            position: `${position.col},${position.row}`,
            character,
            original_win: totalWin,
            multiplied_win: result.multipliedWin,
            trigger_roll: triggerRoll
        });
        
        return result;
    }
    
    /**
     * Process cascade multiplier during free spins
     * @param {number} cascadeCount - Current cascade number
     * @param {number} cascadeWin - Win amount from current cascade
     * @param {number} betAmount - Current bet amount
     * @returns {Object} Cascade multiplier result
     */
    async processCascadeMultiplier(cascadeCount, cascadeWin, betAmount) {
        // Only trigger in free spins and after first cascade
        if (cascadeCount <= 1) {
            return {
                triggered: false,
                reason: 'first_cascade_exempt'
            };
        }
        
        // Check trigger probability (per cascade chance)
        const triggerRoll = this.rng.random();
        if (triggerRoll > this.config.freeSpinsMultiplier.accumTriggerChance) {
            return {
                triggered: false,
                reason: 'probability_not_met',
                triggerRoll,
                triggerChance: this.config.freeSpinsMultiplier.accumTriggerChance,
                cascadeCount
            };
        }
        
        // Select random multiplier from table (same table as regular random multipliers)
        const multiplier = this.selectRandomMultiplier();
        
        // Select random position and character
        const position = {
            col: this.rng.randomInt(0, this.gameConfig.GRID_COLS - 1),
            row: this.rng.randomInt(0, this.gameConfig.GRID_ROWS - 1)
        };
        
        const character = this.selectCharacterForMultiplier();
        
        // Update statistics
        this.updateFreeSpinsMultiplierStatistics(multiplier);
        
        const result = {
            triggered: true,
            multiplier,
            position,
            character,
            cascadeCount,
            animationDuration: this.config.randomMultiplier.animationDuration,
            cascadeWin,
            multipliedCascadeWin: cascadeWin * multiplier,
            type: 'cascade_multiplier',
            metadata: {
                triggerRoll,
                triggerChance: this.config.freeSpinsMultiplier.accumTriggerChance
            }
        };
        
        this.logAuditEvent('CASCADE_MULTIPLIER_TRIGGERED', {
            multiplier,
            cascade_count: cascadeCount,
            position: `${position.col},${position.row}`,
            character,
            cascade_win: cascadeWin,
            multiplied_win: result.multipliedCascadeWin,
            trigger_roll: triggerRoll
        });
        
        return result;
    }
    
    /**
     * Update accumulated multiplier during free spins
     * @param {number} currentAccumulated - Current accumulated multiplier
     * @param {Array<Object>} newMultipliers - New multipliers to accumulate
     * @returns {number} Updated accumulated multiplier
     */
    updateAccumulatedMultiplier(currentAccumulated, newMultipliers) {
        let updatedMultiplier = currentAccumulated;
        
        // Add all new multiplier values to accumulated total
        // Note: ADD multipliers together (not multiply) as per client logic
        for (const multiplierData of newMultipliers) {
            if (multiplierData.multiplier) {
                updatedMultiplier += multiplierData.multiplier;
            }
        }
        
        // Track largest accumulated multiplier for statistics
        this.statistics.largestAccumulatedMultiplier = Math.max(
            this.statistics.largestAccumulatedMultiplier,
            updatedMultiplier
        );
        
        if (newMultipliers.length > 0) {
            this.logAuditEvent('ACCUMULATED_MULTIPLIER_UPDATED', {
                previous_multiplier: currentAccumulated,
                new_multiplier: updatedMultiplier,
                multipliers_added: newMultipliers.length,
                total_added: newMultipliers.reduce((sum, m) => sum + (m.multiplier || 0), 0)
            });
        }
        
        return updatedMultiplier;
    }
    
    /**
     * Apply multiplier to win amount with validation
     * @param {number} winAmount - Base win amount
     * @param {number} multiplier - Multiplier to apply
     * @param {number} betAmount - Bet amount for validation
     * @returns {Object} Multiplied win result
     */
    applyMultiplier(winAmount, multiplier, betAmount) {
        const multipliedWin = winAmount * multiplier;
        
        // Apply win limits (same as client validation)
        const maxWin = betAmount * this.gameConfig.MAX_WIN_MULTIPLIER;
        const cappedWin = Math.min(multipliedWin, maxWin);
        const roundedWin = Math.round(cappedWin * 100) / 100;
        
        const wasCapped = multipliedWin > maxWin;
        
        if (wasCapped) {
            this.logAuditEvent('MULTIPLIER_WIN_CAPPED', {
                original_win: winAmount,
                multiplier,
                multiplied_win: multipliedWin,
                capped_win: cappedWin,
                max_win: maxWin
            });
        }
        
        return {
            originalWin: winAmount,
            multiplier,
            multipliedWin: roundedWin,
            wasCapped,
            maxWin
        };
    }
    
    /**
     * Select random multiplier from weighted table
     * @returns {number} Selected multiplier value
     * @private
     */
    selectRandomMultiplier() {
        const table = this.config.randomMultiplier.table;
        const randomIndex = this.rng.randomInt(0, table.length - 1);
        return table[randomIndex];
    }
    
    /**
     * Select character for multiplier animation (Thanos vs Scarlet Witch)
     * @returns {string} Selected character
     * @private
     */
    selectCharacterForMultiplier() {
        const roll = this.rng.random();
        return roll < this.characterWeights.thanos ? 'thanos' : 'scarlet_witch';
    }
    
    /**
     * Calculate expected multiplier value from table
     * @returns {number} Expected multiplier value
     */
    calculateExpectedMultiplier() {
        const table = this.config.randomMultiplier.table;
        const total = table.reduce((sum, multiplier) => sum + multiplier, 0);
        return total / table.length;
    }
    
    /**
     * Get multiplier distribution statistics
     * @returns {Object} Distribution statistics
     */
    getMultiplierDistribution() {
        const table = this.config.randomMultiplier.table;
        const distribution = {};
        
        // Count frequency of each multiplier value
        for (const multiplier of table) {
            distribution[multiplier] = (distribution[multiplier] || 0) + 1;
        }
        
        // Convert to percentages
        const totalEntries = table.length;
        const percentageDistribution = {};
        for (const [multiplier, count] of Object.entries(distribution)) {
            percentageDistribution[multiplier] = ((count / totalEntries) * 100).toFixed(2) + '%';
        }
        
        return {
            rawCounts: distribution,
            percentages: percentageDistribution,
            totalEntries,
            uniqueMultipliers: Object.keys(distribution).length,
            expectedValue: this.calculateExpectedMultiplier()
        };
    }
    
    /**
     * Update random multiplier statistics
     * @param {number} multiplier - Multiplier value applied
     * @private
     */
    updateRandomMultiplierStatistics(multiplier) {
        this.statistics.randomMultipliersTriggered++;
        this.statistics.totalRandomMultiplierValue += multiplier;
        this.statistics.largestRandomMultiplier = Math.max(this.statistics.largestRandomMultiplier, multiplier);
        
        // Calculate average
        this.statistics.averageRandomMultiplier = 
            this.statistics.totalRandomMultiplierValue / this.statistics.randomMultipliersTriggered;
    }
    
    /**
     * Update free spins multiplier statistics
     * @param {number} multiplier - Multiplier value applied
     * @private
     */
    updateFreeSpinsMultiplierStatistics(multiplier) {
        this.statistics.freeSpinsMultipliersApplied++;
        this.statistics.totalFreeSpinsMultiplierValue += multiplier;
    }
    
    /**
     * Get multiplier engine statistics
     * @returns {Object} Comprehensive statistics
     */
    getStatistics() {
        const distribution = this.getMultiplierDistribution();
        
        return {
            ...this.statistics,
            uptime: Date.now() - this.statistics.initialized,
            totalMultipliersTriggered: this.statistics.randomMultipliersTriggered + this.statistics.freeSpinsMultipliersApplied,
            randomMultiplierTriggerRate: this.config.randomMultiplier.triggerChance * 100,
            freeSpinsCascadeTriggerRate: this.config.freeSpinsMultiplier.accumTriggerChance * 100,
            expectedMultiplierValue: distribution.expectedValue,
            multiplierDistribution: distribution,
            characterSelectionWeights: this.characterWeights
        };
    }
    
    /**
     * Validate multiplier engine integrity
     * @returns {Object} Validation result
     */
    validateIntegrity() {
        const hasValidTable = this.config.randomMultiplier.table.length > 0;
        const hasPositiveMultipliers = this.config.randomMultiplier.table.every(m => m > 0);
        const hasValidTriggerChance = this.config.randomMultiplier.triggerChance >= 0 && 
                                      this.config.randomMultiplier.triggerChance <= 1;
        const hasValidCharacterWeights = Math.abs(
            Object.values(this.characterWeights).reduce((sum, weight) => sum + weight, 0) - 1
        ) < 0.01;
        
        return {
            valid: hasValidTable && hasPositiveMultipliers && hasValidTriggerChance && hasValidCharacterWeights,
            checks: {
                validTable: hasValidTable,
                positiveMultipliers: hasPositiveMultipliers,
                validTriggerChance: hasValidTriggerChance,
                validCharacterWeights: hasValidCharacterWeights,
                tableSize: this.config.randomMultiplier.table.length
            }
        };
    }
    
    /**
     * Reset statistics (for testing/maintenance)
     */
    resetStatistics() {
        this.statistics = {
            randomMultipliersTriggered: 0,
            totalRandomMultiplierValue: 0,
            largestRandomMultiplier: 0,
            freeSpinsMultipliersApplied: 0,
            totalFreeSpinsMultiplierValue: 0,
            largestAccumulatedMultiplier: 1,
            averageRandomMultiplier: 0,
            initialized: Date.now()
        };
        
        this.logAuditEvent('STATISTICS_RESET', {});
    }
    
    /**
     * Update character selection weights (for testing different distributions)
     * @param {Object} newWeights - New character weights
     */
    updateCharacterWeights(newWeights) {
        const totalWeight = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
        
        if (Math.abs(totalWeight - 1) > 0.01) {
            throw new Error('Character weights must sum to 1.0');
        }
        
        this.characterWeights = { ...newWeights };
        
        this.logAuditEvent('CHARACTER_WEIGHTS_UPDATED', {
            old_weights: this.characterWeights,
            new_weights: newWeights
        });
    }
    
    /**
     * Simulate multiplier outcomes for RTP calculation
     * @param {number} iterations - Number of simulations to run
     * @returns {Object} Simulation results
     */
    simulateMultiplierOutcomes(iterations = 10000) {
        let totalMultiplierValue = 0;
        let triggeredCount = 0;
        const multiplierFrequency = {};
        
        for (let i = 0; i < iterations; i++) {
            // Simulate trigger check
            if (this.rng.random() <= this.config.randomMultiplier.triggerChance) {
                triggeredCount++;
                const multiplier = this.selectRandomMultiplier();
                totalMultiplierValue += multiplier;
                
                multiplierFrequency[multiplier] = (multiplierFrequency[multiplier] || 0) + 1;
            }
        }
        
        return {
            iterations,
            triggeredCount,
            triggerRate: (triggeredCount / iterations * 100).toFixed(2) + '%',
            expectedTriggerRate: (this.config.randomMultiplier.triggerChance * 100).toFixed(2) + '%',
            averageMultiplierWhenTriggered: triggeredCount > 0 ? (totalMultiplierValue / triggeredCount).toFixed(2) : 0,
            overallMultiplierContribution: (totalMultiplierValue / iterations).toFixed(4),
            multiplierFrequency
        };
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
            component: 'MultiplierEngine',
            event,
            data
        });
    }
}

module.exports = MultiplierEngine;