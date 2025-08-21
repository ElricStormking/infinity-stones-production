/**
 * SpinResult.js - Server-side Spin Result Model
 * 
 * Defines the complete spin result data structure with cascade information.
 * Includes validation hashes for client-server synchronization verification.
 * 
 * This is the server-side Node.js module version.
 */

const crypto = require('crypto');

class SpinResult {
    constructor(data = {}) {
        // Task 1.1.1: Define spin ID, timestamp, initial grid state
        this.spinId = data.spinId || this.generateSpinId();
        this.timestamp = data.timestamp || Date.now();
        this.initialGrid = data.initialGrid || this.createEmptyGrid();
        
        // Task 1.1.2: Add cascade steps array structure
        this.cascadeSteps = data.cascadeSteps || [];
        
        // Task 1.1.3: Include total win amounts and multipliers
        this.totalWin = data.totalWin || 0;
        this.baseWin = data.baseWin || 0;
        this.totalMultiplier = data.totalMultiplier || 1;
        this.accumulatedMultiplier = data.accumulatedMultiplier || 1;
        
        // Task 1.1.4: Add client validation hash field
        this.validationHash = data.validationHash || null;
        this.hashSalt = data.hashSalt || this.generateSalt();
        
        // Additional fields for complete spin result
        this.success = data.success !== undefined ? data.success : true;
        this.betAmount = data.betAmount || 1.00;
        this.quickSpinMode = data.quickSpinMode || false;
        this.balance = data.balance || 0;
        
        // Free spins data
        this.freeSpinsActive = data.freeSpinsActive || false;
        this.freeSpinsTriggered = data.freeSpinsTriggered || false;
        this.freeSpinsRemaining = data.freeSpinsRemaining || 0;
        this.freeSpinsTotal = data.freeSpinsTotal || 0;
        
        // Random multiplier data
        this.randomMultipliers = data.randomMultipliers || [];
        
        // Win presentation configuration
        this.winPresentation = data.winPresentation || null;
        
        // Total timing data for client synchronization
        this.totalSpinDuration = data.totalSpinDuration || 0;
        
        // Error handling
        this.error = data.error || null;
        this.errorMessage = data.errorMessage || null;
        
        // Server metadata
        this.serverVersion = '1.0.0';
        this.rngSeed = data.rngSeed || null;
    }
    
    /**
     * Generates a unique spin ID
     * @returns {string} Unique spin identifier
     */
    generateSpinId() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `spin_${timestamp}_${random}`;
    }
    
    /**
     * Generates a salt for hash validation
     * @returns {string} Random salt string
     */
    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    /**
     * Creates an empty 6x5 grid
     * @returns {Array<Array<string|null>>} Empty grid
     */
    createEmptyGrid() {
        const grid = [];
        for (let col = 0; col < 6; col++) {
            grid[col] = [];
            for (let row = 0; row < 5; row++) {
                grid[col][row] = null;
            }
        }
        return grid;
    }
    
    /**
     * Adds a cascade step to the result
     * @param {Object} cascadeStep - Cascade step data
     */
    addCascadeStep(cascadeStep) {
        this.cascadeSteps.push(cascadeStep);
        this.updateValidationHash();
    }
    
    /**
     * Generates validation hash for the current state
     * @returns {string} SHA-256 hash of the spin result
     */
    generateValidationHash() {
        const dataToHash = {
            spinId: this.spinId,
            timestamp: this.timestamp,
            initialGrid: this.initialGrid,
            cascadeSteps: this.cascadeSteps.map(step => ({
                stepNumber: step.stepNumber,
                gridStateAfter: step.gridStateAfter,
                matchedClusters: step.matchedClusters,
                totalStepWin: step.totalStepWin
            })),
            totalWin: this.totalWin,
            totalMultiplier: this.totalMultiplier,
            salt: this.hashSalt
        };
        
        const jsonString = JSON.stringify(dataToHash);
        const hash = crypto.createHash('sha256');
        hash.update(jsonString);
        return hash.digest('hex');
    }
    
    /**
     * Updates the validation hash
     */
    updateValidationHash() {
        this.validationHash = this.generateValidationHash();
    }
    
    /**
     * Validates the spin result structure
     * @returns {boolean} True if valid
     */
    validate() {
        // Check basic structure
        if (!this.spinId || !this.timestamp) {
            return false;
        }
        
        // Validate grid structure (6x5)
        if (!Array.isArray(this.initialGrid) || this.initialGrid.length !== 6) {
            return false;
        }
        
        for (const column of this.initialGrid) {
            if (!Array.isArray(column) || column.length !== 5) {
                return false;
            }
        }
        
        // Validate cascade steps
        if (!Array.isArray(this.cascadeSteps)) {
            return false;
        }
        
        // Validate win amounts
        if (typeof this.totalWin !== 'number' || this.totalWin < 0) {
            return false;
        }
        
        // Validate multipliers
        if (typeof this.totalMultiplier !== 'number' || this.totalMultiplier < 1) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Calculates total cascade count
     * @returns {number} Number of cascade steps
     */
    getCascadeCount() {
        return this.cascadeSteps.length;
    }
    
    /**
     * Gets the final grid state after all cascades
     * @returns {Array<Array<string|null>>} Final grid state
     */
    getFinalGrid() {
        if (this.cascadeSteps.length === 0) {
            return this.initialGrid;
        }
        
        const lastStep = this.cascadeSteps[this.cascadeSteps.length - 1];
        return lastStep.gridStateAfter || this.initialGrid;
    }
    
    /**
     * Calculates net result (win - bet)
     * @returns {number} Net result
     */
    getNetResult() {
        return this.totalWin - this.betAmount;
    }
    
    /**
     * Checks if this spin has any wins
     * @returns {boolean} True if there are wins
     */
    hasWins() {
        return this.totalWin > 0;
    }
    
    /**
     * Checks if this spin triggered free spins
     * @returns {boolean} True if free spins were triggered
     */
    triggeredFreeSpins() {
        return this.freeSpinsTriggered === true;
    }
    
    /**
     * Converts to JSON for network transmission
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            spinId: this.spinId,
            timestamp: this.timestamp,
            success: this.success,
            
            // Grid data
            initialGrid: this.initialGrid,
            cascadeSteps: this.cascadeSteps,
            
            // Win data
            totalWin: this.totalWin,
            baseWin: this.baseWin,
            totalMultiplier: this.totalMultiplier,
            accumulatedMultiplier: this.accumulatedMultiplier,
            
            // Validation
            validationHash: this.validationHash,
            hashSalt: this.hashSalt,
            
            // Spin configuration
            betAmount: this.betAmount,
            quickSpinMode: this.quickSpinMode,
            balance: this.balance,
            
            // Free spins
            freeSpinsActive: this.freeSpinsActive,
            freeSpinsTriggered: this.freeSpinsTriggered,
            freeSpinsRemaining: this.freeSpinsRemaining,
            freeSpinsTotal: this.freeSpinsTotal,
            
            // Additional features
            randomMultipliers: this.randomMultipliers,
            winPresentation: this.winPresentation,
            totalSpinDuration: this.totalSpinDuration,
            
            // Error info
            error: this.error,
            errorMessage: this.errorMessage,
            
            // Metadata
            serverVersion: this.serverVersion,
            rngSeed: this.rngSeed
        };
    }
    
    /**
     * Creates a SpinResult from JSON data
     * @param {Object} json - JSON data
     * @returns {SpinResult} New SpinResult instance
     */
    static fromJSON(json) {
        return new SpinResult(json);
    }
    
    /**
     * Creates an error result
     * @param {string} spinId - Spin ID
     * @param {string} error - Error code
     * @param {string} message - Error message
     * @returns {SpinResult} Error result
     */
    static createError(spinId, error, message) {
        return new SpinResult({
            spinId: spinId || 'error_' + Date.now(),
            success: false,
            error: error,
            errorMessage: message,
            timestamp: Date.now()
        });
    }
    
    /**
     * Creates a test result for development
     * @param {number} betAmount - Bet amount
     * @returns {SpinResult} Test result
     */
    static createTestResult(betAmount = 1.00) {
        const testGrid = [];
        const symbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'];
        
        // Generate random test grid
        for (let col = 0; col < 6; col++) {
            testGrid[col] = [];
            for (let row = 0; row < 5; row++) {
                testGrid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
            }
        }
        
        const result = new SpinResult({
            betAmount: betAmount,
            initialGrid: testGrid,
            totalWin: Math.random() * 100,
            balance: 1000,
            quickSpinMode: false
        });
        
        result.updateValidationHash();
        return result;
    }
}

module.exports = SpinResult;