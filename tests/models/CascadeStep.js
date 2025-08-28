/**
 * Simplified CascadeStep Model for Testing
 * 
 * Standalone CascadeStep implementation for RTP validation testing.
 */

const crypto = require('crypto');

class CascadeStep {
    constructor(options = {}) {
        this.stepNumber = options.stepNumber || 0;
        this.gridStateBefore = options.gridStateBefore || [];
        this.gridStateAfter = options.gridStateAfter || [];
        
        // Matched clusters data
        this.matchedClusters = [];
        
        // Drop patterns for client synchronization
        this.dropPatterns = {};
        
        // Timing data
        this.timing = {
            startTime: 0,
            duration: 0,
            endTime: 0
        };
        
        // Synchronization data
        this.synchronization = {
            serverTimestamp: 0,
            expectedClientStartTime: 0,
            syncTolerance: 100,
            acknowledgmentRequired: true
        };
        
        // Win data
        this.winData = {
            stepWin: 0,
            accumulatedMultiplier: 1,
            totalStepPayout: 0
        };
        
        // Validation
        this.validation = {
            stepHash: '',
            gridHashBefore: '',
            gridHashAfter: '',
            timestamp: Date.now()
        };
        
        // Metadata
        this.metadata = {
            isTerminal: false,
            quickSpinMode: false,
            animationRequired: true
        };
    }

    /**
     * Add a matched cluster to this cascade step
     */
    addMatchedCluster(cluster) {
        this.matchedClusters.push({
            symbolType: cluster.symbolType,
            positions: cluster.positions || [],
            clusterSize: cluster.clusterSize || 0,
            payout: cluster.payout || 0,
            multiplier: cluster.multiplier || 1
        });
    }

    /**
     * Add a drop pattern for a column
     */
    addDropPattern(columnIndex, pattern) {
        this.dropPatterns[columnIndex] = pattern;
    }

    /**
     * Calculate total payout for this step
     */
    calculateTotalPayout() {
        this.winData.totalStepPayout = this.matchedClusters.reduce(
            (sum, cluster) => sum + (cluster.payout || 0), 0
        );
        return this.winData.totalStepPayout;
    }

    /**
     * Calculate total duration for this step
     */
    calculateTotalDuration() {
        // Default duration if not set
        if (!this.timing.duration) {
            this.timing.duration = 1000; // 1 second default
        }
        return this.timing.duration;
    }

    /**
     * Generate step hash for validation
     */
    generateStepHash() {
        const dataToHash = {
            stepNumber: this.stepNumber,
            gridStateBefore: this.gridStateBefore,
            gridStateAfter: this.gridStateAfter,
            matchedClusters: this.matchedClusters,
            timing: this.timing,
            winData: this.winData
        };
        
        const jsonString = JSON.stringify(dataToHash);
        this.validation.stepHash = crypto.createHash('sha256').update(jsonString).digest('hex');
        
        // Also generate grid hashes
        this.validation.gridHashBefore = this.generateGridHash(this.gridStateBefore);
        this.validation.gridHashAfter = this.generateGridHash(this.gridStateAfter);
        
        return this.validation.stepHash;
    }

    /**
     * Generate hash for grid state
     */
    generateGridHash(grid) {
        const gridString = JSON.stringify(grid);
        return crypto.createHash('sha256').update(gridString).digest('hex');
    }

    /**
     * Update step hash
     */
    updateStepHash() {
        return this.generateStepHash();
    }

    /**
     * Mark this step as terminal (last in cascade sequence)
     */
    setTerminal() {
        this.metadata.isTerminal = true;
    }

    /**
     * Check if this is the terminal step
     */
    isTerminal() {
        return this.metadata.isTerminal;
    }

    /**
     * Get safe data for serialization
     */
    getSafeData() {
        return {
            stepNumber: this.stepNumber,
            gridStateBefore: this.gridStateBefore,
            gridStateAfter: this.gridStateAfter,
            matchedClusters: this.matchedClusters,
            dropPatterns: this.dropPatterns,
            timing: this.timing,
            synchronization: this.synchronization,
            winData: this.winData,
            validation: this.validation,
            metadata: this.metadata
        };
    }

    /**
     * Create a basic CascadeStep for testing
     */
    static create(options = {}) {
        return new CascadeStep(options);
    }
}

module.exports = CascadeStep;