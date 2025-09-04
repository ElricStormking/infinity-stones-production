/**
 * CascadeStep.js - Server-side Cascade Step Model
 *
 * Represents a single cascade step in the game's cascade sequence.
 * Each step contains the complete state transition from one grid state to another,
 * including matched clusters, drop patterns, animations, and timing data.
 *
 * This is the server-side Node.js module version.
 */

const crypto = require('crypto');

class CascadeStep {
  constructor(data = {}) {
    // Task 1.2.1: Define step number, grid state before/after
    this.stepNumber = data.stepNumber || 0;
    this.gridStateBefore = data.gridStateBefore || this.createEmptyGrid();
    this.gridStateAfter = data.gridStateAfter || this.createEmptyGrid();

    // Task 1.2.2: Add matched clusters data structure
    this.matchedClusters = data.matchedClusters || [];
    // Each cluster contains:
    // {
    //   symbolType: 'time_gem',
    //   positions: [{col: 0, row: 0}, {col: 1, row: 0}, ...],
    //   clusterSize: 8,
    //   payout: 0.5,
    //   multiplier: 1
    // }

    // Task 1.2.3: Include drop patterns and animations
    this.dropPatterns = data.dropPatterns || [];
    // Each drop pattern contains:
    // {
    //   column: 0,
    //   droppedSymbols: [{from: -1, to: 4, symbol: 'time_gem'}, ...],
    //   newSymbols: [{position: 0, symbol: 'space_gem'}, ...],
    //   dropDistance: 5
    // }

    this.animationSequence = data.animationSequence || [];
    // Animation sequence contains ordered animation events:
    // {
    //   type: 'match_burst',
    //   startTime: 0,
    //   duration: 500,
    //   positions: [{col: 0, row: 0}, ...],
    //   effects: ['particle_burst', 'symbol_glow']
    // }

    // Task 1.2.4: Add step timing and synchronization data
    this.timing = {
      startTime: data.timing?.startTime || 0,
      endTime: data.timing?.endTime || 0,
      duration: data.timing?.duration || 0,
      matchDetectionTime: data.timing?.matchDetectionTime || 50,
      removalAnimationTime: data.timing?.removalAnimationTime || 300,
      dropAnimationTime: data.timing?.dropAnimationTime || 400,
      settleDuration: data.timing?.settleDuration || 100
    };

    this.synchronization = {
      serverTimestamp: data.synchronization?.serverTimestamp || Date.now(),
      clientAckRequired: data.synchronization?.clientAckRequired || true,
      validationCheckpoint: data.synchronization?.validationCheckpoint || null,
      syncHash: data.synchronization?.syncHash || null
    };

    // Win and payout data for this cascade step
    this.winData = {
      stepWin: data.winData?.stepWin || 0,
      stepMultiplier: data.winData?.stepMultiplier || 1,
      accumulatedMultiplier: data.winData?.accumulatedMultiplier || 1,
      totalStepPayout: data.winData?.totalStepPayout || 0,
      triggeredFeatures: data.winData?.triggeredFeatures || []
    };

    // Metadata
    this.metadata = {
      cascadeType: data.metadata?.cascadeType || 'normal', // 'normal', 'free_spin', 'bonus'
      isTerminal: data.metadata?.isTerminal || false,
      hasWins: data.metadata?.hasWins || false,
      symbolsRemoved: data.metadata?.symbolsRemoved || 0,
      symbolsAdded: data.metadata?.symbolsAdded || 0,
      rngSeed: data.metadata?.rngSeed || null
    };

    // Validation
    this.validation = {
      gridHashBefore: data.validation?.gridHashBefore || null,
      gridHashAfter: data.validation?.gridHashAfter || null,
      stepHash: data.validation?.stepHash || null,
      validated: data.validation?.validated || false,
      validationErrors: data.validation?.validationErrors || []
    };
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
     * Generates a hash for a grid state
     * @param {Array<Array<string|null>>} grid - Grid to hash
     * @returns {string} SHA-256 hash of the grid
     */
  generateGridHash(grid) {
    const gridString = JSON.stringify(grid);
    const hash = crypto.createHash('sha256');
    hash.update(gridString);
    return hash.digest('hex');
  }

  /**
     * Updates grid hashes for validation
     */
  updateGridHashes() {
    this.validation.gridHashBefore = this.generateGridHash(this.gridStateBefore);
    this.validation.gridHashAfter = this.generateGridHash(this.gridStateAfter);
  }

  /**
     * Generates validation hash for this step
     * @returns {string} SHA-256 hash of the step
     */
  generateStepHash() {
    const dataToHash = {
      stepNumber: this.stepNumber,
      gridHashBefore: this.validation.gridHashBefore,
      gridHashAfter: this.validation.gridHashAfter,
      matchedClusters: this.matchedClusters,
      winData: this.winData,
      serverTimestamp: this.synchronization.serverTimestamp
    };

    const jsonString = JSON.stringify(dataToHash);
    const hash = crypto.createHash('sha256');
    hash.update(jsonString);
    return hash.digest('hex');
  }

  /**
     * Updates the step validation hash
     */
  updateStepHash() {
    this.updateGridHashes();
    this.validation.stepHash = this.generateStepHash();
    this.synchronization.syncHash = this.validation.stepHash;
  }

  /**
     * Adds a matched cluster to this step
     * @param {Object} cluster - Cluster data
     */
  addMatchedCluster(cluster) {
    this.matchedClusters.push({
      symbolType: cluster.symbolType,
      positions: cluster.positions || [],
      clusterSize: cluster.clusterSize || cluster.positions?.length || 0,
      payout: cluster.payout || 0,
      multiplier: cluster.multiplier || 1
    });

    // Update win data
    this.winData.stepWin += cluster.payout || 0;
    this.metadata.hasWins = true;
    this.metadata.symbolsRemoved += cluster.positions?.length || 0;
  }

  /**
     * Adds a drop pattern for a column
     * @param {number} column - Column index
     * @param {Object} pattern - Drop pattern data
     */
  addDropPattern(column, pattern) {
    this.dropPatterns.push({
      column: column,
      droppedSymbols: pattern.droppedSymbols || [],
      newSymbols: pattern.newSymbols || [],
      dropDistance: pattern.dropDistance || 0
    });

    this.metadata.symbolsAdded += pattern.newSymbols?.length || 0;
  }

  /**
     * Adds an animation event to the sequence
     * @param {Object} animation - Animation event data
     */
  addAnimationEvent(animation) {
    this.animationSequence.push({
      type: animation.type,
      startTime: animation.startTime || 0,
      duration: animation.duration || 500,
      positions: animation.positions || [],
      effects: animation.effects || []
    });
  }

  /**
     * Calculates the total duration of this cascade step
     * @returns {number} Total duration in milliseconds
     */
  calculateTotalDuration() {
    const timingDuration =
            this.timing.matchDetectionTime +
            this.timing.removalAnimationTime +
            this.timing.dropAnimationTime +
            this.timing.settleDuration;

    this.timing.duration = timingDuration;
    this.timing.endTime = this.timing.startTime + timingDuration;

    return timingDuration;
  }

  /**
     * Validates the cascade step structure
     * @returns {boolean} True if valid
     */
  validate() {
    const errors = [];

    // Validate step number
    if (typeof this.stepNumber !== 'number' || this.stepNumber < 0) {
      errors.push('Invalid step number');
    }

    // Validate grid structures
    if (!this.isValidGrid(this.gridStateBefore)) {
      errors.push('Invalid gridStateBefore structure');
    }

    if (!this.isValidGrid(this.gridStateAfter)) {
      errors.push('Invalid gridStateAfter structure');
    }

    // Validate matched clusters
    if (!Array.isArray(this.matchedClusters)) {
      errors.push('matchedClusters must be an array');
    }

    for (const cluster of this.matchedClusters) {
      if (!cluster.symbolType || !Array.isArray(cluster.positions)) {
        errors.push('Invalid cluster structure');
        break;
      }
    }

    // Validate timing
    if (this.timing.duration < 0 || this.timing.startTime < 0) {
      errors.push('Invalid timing values');
    }

    // Validate win data
    if (this.winData.stepWin < 0 || this.winData.stepMultiplier < 1) {
      errors.push('Invalid win data');
    }

    this.validation.validationErrors = errors;
    this.validation.validated = errors.length === 0;

    return this.validation.validated;
  }

  /**
     * Checks if a grid structure is valid (6x5)
     * @param {Array} grid - Grid to validate
     * @returns {boolean} True if valid
     */
  isValidGrid(grid) {
    if (!Array.isArray(grid) || grid.length !== 6) {
      return false;
    }

    for (const column of grid) {
      if (!Array.isArray(column) || column.length !== 5) {
        return false;
      }
    }

    return true;
  }

  /**
     * Checks if this is a terminal cascade (no more cascades after this)
     * @returns {boolean} True if terminal
     */
  isTerminal() {
    return this.metadata.isTerminal;
  }

  /**
     * Sets this cascade as terminal
     */
  setTerminal() {
    this.metadata.isTerminal = true;
  }

  /**
     * Gets the total payout for this step
     * @returns {number} Total payout amount
     */
  getTotalPayout() {
    return this.winData.totalStepPayout;
  }

  /**
     * Calculates and updates the total step payout
     */
  calculateTotalPayout() {
    this.winData.totalStepPayout =
            this.winData.stepWin *
            this.winData.stepMultiplier *
            this.winData.accumulatedMultiplier;

    return this.winData.totalStepPayout;
  }

  /**
     * Creates a summary of matched symbols
     * @returns {Object} Summary of matches by symbol type
     */
  getMatchSummary() {
    const summary = {};

    for (const cluster of this.matchedClusters) {
      if (!summary[cluster.symbolType]) {
        summary[cluster.symbolType] = {
          totalMatches: 0,
          totalPayout: 0,
          clusters: []
        };
      }

      summary[cluster.symbolType].totalMatches += cluster.clusterSize;
      summary[cluster.symbolType].totalPayout += cluster.payout;
      summary[cluster.symbolType].clusters.push({
        size: cluster.clusterSize,
        payout: cluster.payout
      });
    }

    return summary;
  }

  /**
     * Converts to JSON for network transmission
     * @returns {Object} JSON representation
     */
  toJSON() {
    return {
      stepNumber: this.stepNumber,
      gridStateBefore: this.gridStateBefore,
      gridStateAfter: this.gridStateAfter,
      matchedClusters: this.matchedClusters,
      dropPatterns: this.dropPatterns,
      animationSequence: this.animationSequence,
      timing: this.timing,
      synchronization: this.synchronization,
      winData: this.winData,
      metadata: this.metadata,
      validation: this.validation
    };
  }

  /**
     * Creates a CascadeStep from JSON data
     * @param {Object} json - JSON data
     * @returns {CascadeStep} New CascadeStep instance
     */
  static fromJSON(json) {
    return new CascadeStep(json);
  }

  /**
     * Creates a test cascade step for development
     * @param {number} stepNumber - Step number
     * @param {Array} gridBefore - Grid state before
     * @returns {CascadeStep} Test cascade step
     */
  static createTestStep(stepNumber = 0, gridBefore = null) {
    const symbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'];

    // Generate or use provided grid
    const beforeGrid = gridBefore || [];
    if (beforeGrid.length === 0) {
      for (let col = 0; col < 6; col++) {
        beforeGrid[col] = [];
        for (let row = 0; row < 5; row++) {
          beforeGrid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
        }
      }
    }

    // Create a modified after grid (simulate some matches removed)
    const afterGrid = JSON.parse(JSON.stringify(beforeGrid));

    // Remove some symbols to simulate matches
    const matchPositions = [];
    for (let i = 0; i < 8; i++) {
      const col = Math.floor(Math.random() * 6);
      const row = Math.floor(Math.random() * 5);
      if (afterGrid[col][row]) {
        matchPositions.push({ col, row });
        afterGrid[col][row] = null;
      }
    }

    // Fill nulls with new symbols (simulate drop)
    for (let col = 0; col < 6; col++) {
      for (let row = 4; row >= 0; row--) {
        if (afterGrid[col][row] === null) {
          afterGrid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
        }
      }
    }

    const step = new CascadeStep({
      stepNumber: stepNumber,
      gridStateBefore: beforeGrid,
      gridStateAfter: afterGrid,
      timing: {
        startTime: stepNumber * 1000,
        duration: 850
      },
      winData: {
        stepWin: Math.random() * 10,
        stepMultiplier: 1
      }
    });

    // Add a test cluster
    if (matchPositions.length > 0) {
      step.addMatchedCluster({
        symbolType: beforeGrid[matchPositions[0].col][matchPositions[0].row],
        positions: matchPositions,
        payout: 0.5
      });
    }

    step.calculateTotalDuration();
    step.calculateTotalPayout();
    step.updateStepHash();

    return step;
  }
}

module.exports = CascadeStep;