/**
 * Simplified SpinResult Model for Testing
 * 
 * Standalone SpinResult implementation that doesn't require database
 * connections for RTP validation testing.
 */

const crypto = require('crypto');

class SpinResult {
    constructor(options = {}) {
        this.spinId = options.spinId || this.generateSpinId();
        this.betAmount = options.betAmount || 1.00;
        this.quickSpinMode = options.quickSpinMode || false;
        this.freeSpinsActive = options.freeSpinsActive || false;
        this.accumulatedMultiplier = options.accumulatedMultiplier || 1;
        this.initialGrid = options.initialGrid || [];
        this.rngSeed = options.rngSeed || this.generateRNGSeed();
        
        // Results data
        this.cascadeSteps = [];
        this.totalWin = 0;
        this.baseWin = 0;
        this.totalMultiplier = 1;
        this.balance = 1000.00;
        this.freeSpinsTriggered = false;
        this.freeSpinsRemaining = 0;
        this.freeSpinsTotal = 0;
        this.randomMultipliers = [];
        this.winPresentation = null;
        this.totalSpinDuration = 0;
        
        // Validation and metadata
        this.validationHash = '';
        this.timestamp = Date.now();
        this.gameMode = options.freeSpinsActive ? 'free_spins' : 'base';
        this.error = null;
    }

    /**
     * Generate a unique spin ID
     */
    generateSpinId() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `spin_${timestamp}_${random}`;
    }

    /**
     * Generate RNG seed
     */
    generateRNGSeed() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Update validation hash for integrity checking
     */
    updateValidationHash() {
        const dataToHash = {
            spinId: this.spinId,
            betAmount: this.betAmount,
            initialGrid: this.initialGrid,
            cascadeSteps: this.cascadeSteps.map(step => step.validation?.stepHash),
            totalWin: this.totalWin,
            rngSeed: this.rngSeed,
            timestamp: this.timestamp
        };
        
        const jsonString = JSON.stringify(dataToHash);
        this.validationHash = crypto.createHash('sha256').update(jsonString).digest('hex');
        return this.validationHash;
    }

    /**
     * Generate complete validation hash
     */
    generateValidationHash() {
        return this.updateValidationHash();
    }

    /**
     * Check if this spin resulted in a win
     */
    isWin() {
        return this.totalWin > 0;
    }

    /**
     * Calculate net result (win minus bet)
     */
    getNetResult() {
        return this.totalWin - this.betAmount;
    }

    /**
     * Calculate win multiplier
     */
    getWinMultiplier() {
        if (this.betAmount === 0) return 0;
        return this.totalWin / this.betAmount;
    }

    /**
     * Check if this is a big win
     */
    isBigWin(threshold = 10) {
        return this.getWinMultiplier() >= threshold;
    }

    /**
     * Get cascade count
     */
    getCascadeCount() {
        return this.cascadeSteps.length;
    }

    /**
     * Get safe data for serialization
     */
    getSafeData() {
        return {
            spinId: this.spinId,
            betAmount: this.betAmount,
            quickSpinMode: this.quickSpinMode,
            freeSpinsActive: this.freeSpinsActive,
            accumulatedMultiplier: this.accumulatedMultiplier,
            initialGrid: this.initialGrid,
            cascadeSteps: this.cascadeSteps,
            totalWin: this.totalWin,
            baseWin: this.baseWin,
            totalMultiplier: this.totalMultiplier,
            freeSpinsTriggered: this.freeSpinsTriggered,
            freeSpinsRemaining: this.freeSpinsRemaining,
            freeSpinsTotal: this.freeSpinsTotal,
            randomMultipliers: this.randomMultipliers,
            winPresentation: this.winPresentation,
            totalSpinDuration: this.totalSpinDuration,
            validationHash: this.validationHash,
            timestamp: this.timestamp,
            gameMode: this.gameMode,
            
            // Calculated fields
            netResult: this.getNetResult(),
            winMultiplier: this.getWinMultiplier(),
            isWin: this.isWin(),
            isBigWin: this.isBigWin(),
            cascadeCount: this.getCascadeCount()
        };
    }

    /**
     * Create an error result
     */
    static createError(spinId, errorCode, errorMessage) {
        const errorResult = new SpinResult({ spinId });
        errorResult.error = {
            code: errorCode,
            message: errorMessage,
            timestamp: Date.now()
        };
        return errorResult;
    }

    /**
     * Create a basic SpinResult for testing
     */
    static create(options = {}) {
        return new SpinResult(options);
    }
}

module.exports = SpinResult;