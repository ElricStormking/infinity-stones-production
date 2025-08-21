/**
 * SpinResult.js - Server Response Model for Infinity Storm Spins
 * 
 * Defines the complete server response structure for spins with detailed timing data.
 * This model ensures perfect cascade synchronization between server logic and client animations.
 * 
 * IMPORTANT: This follows the global window pattern for Phaser compatibility.
 * All timing values preserve animation timings from GameConfig.js.
 */
window.SpinResult = class SpinResult {
    constructor(data = {}) {
        // Basic spin information
        this.success = data.success || false;
        this.spinId = data.spinId || null;
        this.quickSpinMode = data.quickSpinMode || false;
        
        // Grid data - 6 columns × 5 rows of symbol IDs
        this.initialGrid = data.initialGrid || [];
        
        // Cascade sequence with detailed timing data
        this.cascades = (data.cascades || []).map(cascade => new CascadeResult(cascade));
        
        // Win presentation configuration
        this.winPresentation = data.winPresentation ? {
            category: data.winPresentation.category || 'SMALL', // SMALL, MEDIUM, BIG, MEGA, EPIC, LEGENDARY
            animationKey: data.winPresentation.animationKey || 'win_01',
            displayDuration: data.winPresentation.displayDuration || 2500,
            scaleInDuration: data.winPresentation.scaleInDuration || 500,
            pulseEffect: data.winPresentation.pulseEffect || false,
            moneyParticles: data.winPresentation.moneyParticles || false
        } : null;
        
        // Final results
        this.totalWin = data.totalWin || 0;
        this.balance = data.balance || 0;
        
        // Free spins state
        this.freeSpinsTriggered = data.freeSpinsTriggered || false;
        this.freeSpinsRemaining = data.freeSpinsRemaining || 0;
        this.freeSpinsTotal = data.freeSpinsTotal || 0;
        this.accumulatedMultiplier = data.accumulatedMultiplier || 1;
        
        // Random multipliers with timing
        this.randomMultipliers = (data.randomMultipliers || []).map(mult => ({
            position: mult.position || [0, 0],
            value: mult.value || 2,
            appearTiming: mult.appearTiming || 500, // When to show multiplier (ms)
            animationDuration: mult.animationDuration || 2000 // Thanos grip animation (ms)
        }));
        
        // Total spin duration for client synchronization
        this.totalSpinDuration = data.totalSpinDuration || 0;
        
        // Error handling
        this.error = data.error || null;
        this.errorMessage = data.errorMessage || null;
    }
    
    /**
     * Validates the spin result data structure
     * @returns {boolean} True if valid, false otherwise
     */
    isValid() {
        if (!this.success) {
            return false;
        }
        
        // Validate grid structure (6 columns × 5 rows)
        if (!Array.isArray(this.initialGrid) || this.initialGrid.length !== 6) {
            return false;
        }
        
        for (const column of this.initialGrid) {
            if (!Array.isArray(column) || column.length !== 5) {
                return false;
            }
        }
        
        // Validate cascades have proper timing data
        for (const cascade of this.cascades) {
            if (!cascade.isValid()) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Gets the total number of cascades in this spin
     * @returns {number} Number of cascades
     */
    getCascadeCount() {
        return this.cascades.length;
    }
    
    /**
     * Gets cascade by index
     * @param {number} index - Cascade index
     * @returns {CascadeResult|null} Cascade or null if not found
     */
    getCascade(index) {
        return this.cascades[index] || null;
    }
    
    /**
     * Checks if this spin has any wins
     * @returns {boolean} True if there are wins
     */
    hasWins() {
        return this.totalWin > 0;
    }
    
    /**
     * Checks if random multipliers were triggered
     * @returns {boolean} True if random multipliers exist
     */
    hasRandomMultipliers() {
        return this.randomMultipliers.length > 0;
    }
    
    /**
     * Gets timing data for a specific cascade
     * @param {number} cascadeIndex - Index of cascade
     * @returns {TimingData|null} Timing data or null
     */
    getCascadeTiming(cascadeIndex) {
        const cascade = this.getCascade(cascadeIndex);
        return cascade ? cascade.timing : null;
    }
    
    /**
     * Calculates quick spin timing adjustments
     * @returns {object} Adjusted timing values for quick spin mode
     */
    getQuickSpinTimings() {
        if (!this.quickSpinMode) {
            return null;
        }
        
        const QUICK_SPIN_FACTOR = 0.6;
        const MIN_DURATION = 150;
        
        return {
            cascadeSpeed: Math.max(MIN_DURATION, 300 * QUICK_SPIN_FACTOR), // 180ms or 150ms min
            symbolDropTime: Math.max(120, 200 * QUICK_SPIN_FACTOR), // 120ms
            symbolDestroyTime: Math.max(180, 300 * QUICK_SPIN_FACTOR), // 180ms
            winCelebrationTime: Math.max(1200, 2000 * QUICK_SPIN_FACTOR), // 1200ms
            multiplierAppearTime: Math.max(300, 500 * QUICK_SPIN_FACTOR) // 300ms
        };
    }
    
    /**
     * Gets all symbol positions that will be destroyed across all cascades
     * @returns {Array<Array<number>>} Array of [col, row] positions
     */
    getAllDestroyedPositions() {
        const positions = [];
        for (const cascade of this.cascades) {
            positions.push(...cascade.removedPositions);
        }
        return positions;
    }
    
    /**
     * Gets all new symbols that will be added across all cascades
     * @returns {Array<object>} Array of new symbol data
     */
    getAllNewSymbols() {
        const symbols = [];
        for (const cascade of this.cascades) {
            symbols.push(...cascade.newSymbols);
        }
        return symbols;
    }
    
    /**
     * Gets total payout from all cascades
     * @returns {number} Total payout amount
     */
    getTotalPayout() {
        let total = 0;
        for (const cascade of this.cascades) {
            for (const match of cascade.matches) {
                total += match.payout * match.multiplier;
            }
        }
        return total;
    }
    
    /**
     * Serializes to JSON for network transmission
     * @returns {object} JSON-serializable object
     */
    toJSON() {
        return {
            success: this.success,
            spinId: this.spinId,
            quickSpinMode: this.quickSpinMode,
            initialGrid: this.initialGrid,
            cascades: this.cascades.map(cascade => cascade.toJSON()),
            winPresentation: this.winPresentation,
            totalWin: this.totalWin,
            balance: this.balance,
            freeSpinsTriggered: this.freeSpinsTriggered,
            freeSpinsRemaining: this.freeSpinsRemaining,
            freeSpinsTotal: this.freeSpinsTotal,
            accumulatedMultiplier: this.accumulatedMultiplier,
            randomMultipliers: this.randomMultipliers,
            totalSpinDuration: this.totalSpinDuration,
            error: this.error,
            errorMessage: this.errorMessage
        };
    }
    
    /**
     * Creates SpinResult from server JSON response
     * @param {object} json - JSON data from server
     * @returns {SpinResult} New SpinResult instance
     */
    static fromJSON(json) {
        return new SpinResult(json);
    }
    
    /**
     * Creates an error result
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @returns {SpinResult} Error result
     */
    static createError(message, code = 'UNKNOWN') {
        return new SpinResult({
            success: false,
            error: code,
            errorMessage: message
        });
    }
};

/**
 * CascadeResult - Represents a single cascade within a spin
 * Contains timing data for perfect animation synchronization
 */
window.CascadeResult = class CascadeResult {
    constructor(data = {}) {
        this.cascadeNumber = data.cascadeNumber || 1;
        
        // Timing data for this cascade
        this.timing = new TimingData(data.timing || {});
        
        // Match information
        this.matches = (data.matches || []).map(match => ({
            symbol: match.symbol || '',
            positions: match.positions || [],
            payout: match.payout || 0,
            multiplier: match.multiplier || 1,
            animationKey: match.animationKey || 'gem_explode',
            effectTiming: match.effectTiming || 300
        }));
        
        // Positions removed in this cascade
        this.removedPositions = data.removedPositions || [];
        
        // New symbols dropping down
        this.newSymbols = (data.newSymbols || []).map(symbol => ({
            position: symbol.position || [0, 0],
            symbol: symbol.symbol || '',
            dropFromRow: symbol.dropFromRow || -1,
            emptyRowsBelow: symbol.emptyRowsBelow || 0,
            dropTiming: symbol.dropTiming || 300
        }));
        
        // Grid state after this cascade completes
        this.gridAfterCascade = data.gridAfterCascade || [];
    }
    
    /**
     * Validates cascade data structure
     * @returns {boolean} True if valid
     */
    isValid() {
        return this.timing.isValid() && 
               Array.isArray(this.matches) && 
               Array.isArray(this.removedPositions) && 
               Array.isArray(this.newSymbols);
    }
    
    /**
     * Gets total win amount for this cascade
     * @returns {number} Total win amount
     */
    getTotalWin() {
        return this.matches.reduce((total, match) => {
            return total + (match.payout * match.multiplier);
        }, 0);
    }
    
    /**
     * Checks if this cascade has any matches
     * @returns {boolean} True if there are matches
     */
    hasMatches() {
        return this.matches.length > 0;
    }
    
    /**
     * Serializes to JSON
     * @returns {object} JSON-serializable object
     */
    toJSON() {
        return {
            cascadeNumber: this.cascadeNumber,
            timing: this.timing.toJSON(),
            matches: this.matches,
            removedPositions: this.removedPositions,
            newSymbols: this.newSymbols,
            gridAfterCascade: this.gridAfterCascade
        };
    }
};

/**
 * TimingData - Precise timing information for cascade animations
 * Preserves all animation timing values from GameConfig.js
 */
window.TimingData = class TimingData {
    constructor(data = {}) {
        // When to start this cascade (ms from spin start)
        this.startDelay = data.startDelay || 0;
        
        // Symbol destruction animation duration (ms)
        this.destroyDuration = data.destroyDuration || 300; // SYMBOL_DESTROY_TIME
        
        // Base drop duration before gravity calculation (ms)
        this.dropDuration = data.dropDuration || 300; // CASCADE_SPEED
        
        // Additional drop time per empty row (ms)
        this.dropDelayPerRow = data.dropDelayPerRow || 100;
        
        // Delay before showing win presentation (ms)
        this.winPresentationDelay = data.winPresentationDelay || 300;
        
        // Total duration of this cascade (ms)
        this.totalDuration = data.totalDuration || 
            this.destroyDuration + this.dropDuration + this.winPresentationDelay;
    }
    
    /**
     * Validates timing data
     * @returns {boolean} True if valid
     */
    isValid() {
        return this.destroyDuration >= 0 && 
               this.dropDuration >= 0 && 
               this.totalDuration >= 0;
    }
    
    /**
     * Calculates drop timing for a symbol based on empty rows
     * @param {number} emptyRowsBelow - Number of empty rows below symbol
     * @returns {number} Calculated drop timing in ms
     */
    calculateDropTiming(emptyRowsBelow) {
        return this.dropDuration + (emptyRowsBelow * this.dropDelayPerRow);
    }
    
    /**
     * Applies quick spin adjustments to timing
     * @param {number} factor - Quick spin factor (default 0.6)
     * @param {number} minDuration - Minimum duration (default 150ms)
     * @returns {TimingData} New TimingData with adjusted values
     */
    applyQuickSpin(factor = 0.6, minDuration = 150) {
        return new TimingData({
            startDelay: Math.max(minDuration * 0.5, this.startDelay * factor),
            destroyDuration: Math.max(minDuration * 0.8, this.destroyDuration * factor),
            dropDuration: Math.max(minDuration, this.dropDuration * factor),
            dropDelayPerRow: Math.max(60, this.dropDelayPerRow * factor),
            winPresentationDelay: Math.max(180, this.winPresentationDelay * factor),
            totalDuration: Math.max(minDuration * 2, this.totalDuration * factor)
        });
    }
    
    /**
     * Serializes to JSON
     * @returns {object} JSON-serializable object
     */
    toJSON() {
        return {
            startDelay: this.startDelay,
            destroyDuration: this.destroyDuration,
            dropDuration: this.dropDuration,
            dropDelayPerRow: this.dropDelayPerRow,
            winPresentationDelay: this.winPresentationDelay,
            totalDuration: this.totalDuration
        };
    }
};