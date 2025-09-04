/**
 * CascadeValidator.js - Server-side Cascade Validation Service
 *
 * Provides comprehensive validation capabilities for the Enhanced Cascade Synchronization system.
 * Implements grid state validation, cascade step integrity checking, timing validation,
 * and fraud detection mechanisms for secure and reliable casino-grade gaming.
 *
 * This is the server-side Node.js service integrating with our foundation models.
 */

const crypto = require('crypto');
const SpinResult = require('../models/SpinResult');
const CascadeStep = require('../models/CascadeStep');
const GameSession = require('../models/GameSession');

class CascadeValidator {
  constructor(options = {}) {
    this.options = {
      // Validation tolerances
      timingTolerance: options.timingTolerance || 1000, // 1 second
      hashValidationEnabled: options.hashValidationEnabled !== false,
      strictValidation: options.strictValidation || false,

      // Fraud detection thresholds
      maxValidationFailures: options.maxValidationFailures || 5,
      fraudDetectionEnabled: options.fraudDetectionEnabled !== false,
      suspiciousActivityThreshold: options.suspiciousActivityThreshold || 3,

      // Performance settings
      validationCacheSize: options.validationCacheSize || 100,
      enablePerformanceMetrics: options.enablePerformanceMetrics !== false,

      // Grid validation settings
      gridDimensionX: options.gridDimensionX || 6,
      gridDimensionY: options.gridDimensionY || 5,
      validSymbols: options.validSymbols || [
        'time_gem', 'space_gem', 'mind_gem', 'power_gem',
        'reality_gem', 'soul_gem', 'thanos_weapon', 'scarlet_witch',
        'thanos', 'infinity_glove'
      ]
    };

    // Internal state
    this.validationCache = new Map();
    this.fraudDetectionStats = new Map();
    this.performanceMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      lastValidationTime: null
    };

    // Validation error codes
    this.ERROR_CODES = {
      INVALID_GRID_STRUCTURE: 'INVALID_GRID_STRUCTURE',
      INVALID_GRID_DIMENSIONS: 'INVALID_GRID_DIMENSIONS',
      INVALID_SYMBOLS: 'INVALID_SYMBOLS',
      STEP_INTEGRITY_FAILURE: 'STEP_INTEGRITY_FAILURE',
      TIMING_VALIDATION_FAILURE: 'TIMING_VALIDATION_FAILURE',
      HASH_MISMATCH: 'HASH_MISMATCH',
      FRAUD_DETECTED: 'FRAUD_DETECTED',
      SESSION_DESYNC: 'SESSION_DESYNC',
      INVALID_SEQUENCE: 'INVALID_SEQUENCE',
      PAYOUT_MANIPULATION: 'PAYOUT_MANIPULATION'
    };
  }

  // ===========================================
  // Task 2.3.1: Grid State Validation Algorithms
  // ===========================================

  /**
     * Validates a grid state structure and contents
     * @param {Array<Array<string|null>>} gridState - Grid to validate
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
  validateGridState(gridState, options = {}) {
    const startTime = Date.now();
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      gridHash: null,
      validationTime: null
    };

    try {
      // Check grid structure
      if (!this.isValidGridStructure(gridState)) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.INVALID_GRID_STRUCTURE,
          message: 'Grid structure is invalid'
        });
        return result;
      }

      // Check grid dimensions
      if (!this.isValidGridDimensions(gridState)) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.INVALID_GRID_DIMENSIONS,
          message: `Grid must be ${this.options.gridDimensionX}x${this.options.gridDimensionY}`
        });
        return result;
      }

      // Validate symbols
      const symbolValidation = this.validateGridSymbols(gridState);
      if (!symbolValidation.isValid) {
        result.isValid = false;
        result.errors.push(...symbolValidation.errors);
      }

      // Check for impossible states
      const stateValidation = this.validateGridPhysics(gridState);
      if (!stateValidation.isValid) {
        result.isValid = false;
        result.errors.push(...stateValidation.errors);
      }

      // Generate hash for integrity
      if (this.options.hashValidationEnabled) {
        result.gridHash = this.generateGridHash(gridState, options.salt);
      }

      // Check for suspicious patterns
      if (this.options.fraudDetectionEnabled) {
        const fraudCheck = this.detectGridFraud(gridState);
        if (fraudCheck.suspicious) {
          result.warnings.push(...fraudCheck.warnings);
        }
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        code: 'VALIDATION_ERROR',
        message: `Grid validation failed: ${error.message}`
      });
    } finally {
      result.validationTime = Date.now() - startTime;
      this.updatePerformanceMetrics('gridValidation', result.validationTime, result.isValid);
    }

    return result;
  }

  /**
     * Checks if grid structure is valid
     * @param {Array} gridState - Grid to check
     * @returns {boolean} True if structure is valid
     */
  isValidGridStructure(gridState) {
    if (!Array.isArray(gridState)) {
      return false;
    }

    for (const column of gridState) {
      if (!Array.isArray(column)) {
        return false;
      }
    }

    return true;
  }

  /**
     * Checks if grid dimensions are correct
     * @param {Array<Array>} gridState - Grid to check
     * @returns {boolean} True if dimensions are correct
     */
  isValidGridDimensions(gridState) {
    if (gridState.length !== this.options.gridDimensionX) {
      return false;
    }

    for (const column of gridState) {
      if (column.length !== this.options.gridDimensionY) {
        return false;
      }
    }

    return true;
  }

  /**
     * Validates symbols in the grid
     * @param {Array<Array<string|null>>} gridState - Grid to validate
     * @returns {Object} Validation result
     */
  validateGridSymbols(gridState) {
    const result = {
      isValid: true,
      errors: [],
      invalidSymbols: []
    };

    for (let col = 0; col < gridState.length; col++) {
      for (let row = 0; row < gridState[col].length; row++) {
        const symbol = gridState[col][row];

        // Null is valid (empty space)
        if (symbol === null) {
          continue;
        }

        // Check if symbol is in valid list
        if (typeof symbol !== 'string' || !this.options.validSymbols.includes(symbol)) {
          result.isValid = false;
          result.invalidSymbols.push({
            position: { col, row },
            symbol: symbol
          });
        }
      }
    }

    if (result.invalidSymbols.length > 0) {
      result.errors.push({
        code: this.ERROR_CODES.INVALID_SYMBOLS,
        message: `Invalid symbols found: ${result.invalidSymbols.length} positions`,
        details: result.invalidSymbols
      });
    }

    return result;
  }

  /**
     * Validates grid physics (gravity, no floating symbols)
     * @param {Array<Array<string|null>>} gridState - Grid to validate
     * @returns {Object} Validation result
     */
  validateGridPhysics(gridState) {
    const result = {
      isValid: true,
      errors: [],
      floatingSymbols: []
    };

    // Check for floating symbols (symbols with empty spaces below them)
    for (let col = 0; col < gridState.length; col++) {
      for (let row = 0; row < gridState[col].length - 1; row++) {
        const currentSymbol = gridState[col][row];
        const belowSymbol = gridState[col][row + 1];

        // If there's a symbol above an empty space, it's floating
        if (currentSymbol !== null && belowSymbol === null) {
          result.isValid = false;
          result.floatingSymbols.push({
            position: { col, row },
            symbol: currentSymbol
          });
        }
      }
    }

    if (result.floatingSymbols.length > 0) {
      result.errors.push({
        code: 'INVALID_PHYSICS',
        message: `Floating symbols detected: ${result.floatingSymbols.length} positions`,
        details: result.floatingSymbols
      });
    }

    return result;
  }

  /**
     * Generates a hash for grid state validation
     * @param {Array<Array<string|null>>} gridState - Grid to hash
     * @param {string} salt - Optional salt for hashing
     * @returns {string} SHA-256 hash
     */
  generateGridHash(gridState, salt = '') {
    const gridString = JSON.stringify(gridState);
    const hash = crypto.createHash('sha256');
    hash.update(gridString + salt);
    return hash.digest('hex');
  }

  // ===========================================
  // Task 2.3.2: Cascade Step Integrity Checking
  // ===========================================

  /**
     * Validates cascade step integrity
     * @param {CascadeStep} cascadeStep - Step to validate
     * @param {CascadeStep} previousStep - Previous step for continuity
     * @returns {Object} Validation result
     */
  validateCascadeStepIntegrity(cascadeStep, previousStep = null) {
    const startTime = Date.now();
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      validationTime: null
    };

    try {
      // Validate step structure
      const structureValidation = this.validateStepStructure(cascadeStep);
      if (!structureValidation.isValid) {
        result.isValid = false;
        result.errors.push(...structureValidation.errors);
      }

      // Validate grid state continuity
      if (previousStep) {
        const continuityValidation = this.validateGridContinuity(cascadeStep, previousStep);
        if (!continuityValidation.isValid) {
          result.isValid = false;
          result.errors.push(...continuityValidation.errors);
        }
      }

      // Validate matches are legitimate
      const matchValidation = this.validateMatches(cascadeStep);
      if (!matchValidation.isValid) {
        result.isValid = false;
        result.errors.push(...matchValidation.errors);
      }

      // Validate drop patterns
      const dropValidation = this.validateDropPatterns(cascadeStep);
      if (!dropValidation.isValid) {
        result.isValid = false;
        result.errors.push(...dropValidation.errors);
      }

      // Validate payout calculations
      const payoutValidation = this.validatePayouts(cascadeStep);
      if (!payoutValidation.isValid) {
        result.isValid = false;
        result.errors.push(...payoutValidation.errors);
      }

      // Check for fraud indicators
      if (this.options.fraudDetectionEnabled) {
        const fraudCheck = this.detectCascadeStepFraud(cascadeStep);
        if (fraudCheck.suspicious) {
          result.warnings.push(...fraudCheck.warnings);
        }
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
        message: `Cascade step validation failed: ${error.message}`
      });
    } finally {
      result.validationTime = Date.now() - startTime;
      this.updatePerformanceMetrics('stepValidation', result.validationTime, result.isValid);
    }

    return result;
  }

  /**
     * Validates cascade step structure
     * @param {CascadeStep} cascadeStep - Step to validate
     * @returns {Object} Validation result
     */
  validateStepStructure(cascadeStep) {
    const result = {
      isValid: true,
      errors: []
    };

    // Check required fields
    if (typeof cascadeStep.stepNumber !== 'number' || cascadeStep.stepNumber < 0) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.INVALID_SEQUENCE,
        message: 'Invalid step number'
      });
    }

    // Validate grid states
    const beforeValidation = this.validateGridState(cascadeStep.gridStateBefore);
    if (!beforeValidation.isValid) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.INVALID_GRID_STRUCTURE,
        message: 'Invalid gridStateBefore',
        details: beforeValidation.errors
      });
    }

    const afterValidation = this.validateGridState(cascadeStep.gridStateAfter);
    if (!afterValidation.isValid) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.INVALID_GRID_STRUCTURE,
        message: 'Invalid gridStateAfter',
        details: afterValidation.errors
      });
    }

    // Validate matched clusters structure
    if (!Array.isArray(cascadeStep.matchedClusters)) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
        message: 'matchedClusters must be an array'
      });
    }

    return result;
  }

  /**
     * Validates grid continuity between steps
     * @param {CascadeStep} currentStep - Current step
     * @param {CascadeStep} previousStep - Previous step
     * @returns {Object} Validation result
     */
  validateGridContinuity(currentStep, previousStep) {
    const result = {
      isValid: true,
      errors: []
    };

    // Current step's before grid should match previous step's after grid
    const currentBefore = JSON.stringify(currentStep.gridStateBefore);
    const previousAfter = JSON.stringify(previousStep.gridStateAfter);

    if (currentBefore !== previousAfter) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
        message: 'Grid continuity broken between steps',
        details: {
          currentStepNumber: currentStep.stepNumber,
          previousStepNumber: previousStep.stepNumber
        }
      });
    }

    return result;
  }

  /**
     * Validates matched clusters are legitimate
     * @param {CascadeStep} cascadeStep - Step to validate
     * @returns {Object} Validation result
     */
  validateMatches(cascadeStep) {
    const result = {
      isValid: true,
      errors: []
    };

    for (const cluster of cascadeStep.matchedClusters) {
      // Check cluster size
      if (cluster.clusterSize < 8) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
          message: `Invalid cluster size: ${cluster.clusterSize} (minimum 8)`
        });
      }

      // Check positions exist in grid before state
      for (const position of cluster.positions) {
        const { col, row } = position;
        if (col < 0 || col >= this.options.gridDimensionX ||
                    row < 0 || row >= this.options.gridDimensionY) {
          result.isValid = false;
          result.errors.push({
            code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
            message: `Invalid position: ${col},${row}`
          });
          continue;
        }

        const symbolAtPosition = cascadeStep.gridStateBefore[col][row];
        if (symbolAtPosition !== cluster.symbolType) {
          result.isValid = false;
          result.errors.push({
            code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
            message: `Symbol mismatch at position ${col},${row}`
          });
        }
      }

      // Validate cluster connectivity (flood-fill algorithm)
      if (!this.isClusterConnected(cluster.positions)) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
          message: `Cluster is not connected: ${cluster.symbolType}`
        });
      }
    }

    return result;
  }

  /**
     * Validates drop patterns make sense
     * @param {CascadeStep} cascadeStep - Step to validate
     * @returns {Object} Validation result
     */
  validateDropPatterns(cascadeStep) {
    const result = {
      isValid: true,
      errors: []
    };

    // For each drop pattern, validate the physics
    for (const dropPattern of cascadeStep.dropPatterns) {
      const { column, droppedSymbols, newSymbols } = dropPattern;

      // Check column is valid
      if (column < 0 || column >= this.options.gridDimensionX) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
          message: `Invalid drop column: ${column}`
        });
        continue;
      }

      // Validate drop distances make sense
      for (const drop of droppedSymbols) {
        if (drop.from >= drop.to) {
          result.isValid = false;
          result.errors.push({
            code: this.ERROR_CODES.STEP_INTEGRITY_FAILURE,
            message: `Invalid drop: from ${drop.from} to ${drop.to}`
          });
        }
      }
    }

    return result;
  }

  /**
     * Validates payout calculations
     * @param {CascadeStep} cascadeStep - Step to validate
     * @returns {Object} Validation result
     */
  validatePayouts(cascadeStep) {
    const result = {
      isValid: true,
      errors: []
    };

    let calculatedWin = 0;

    // Calculate expected win from clusters
    for (const cluster of cascadeStep.matchedClusters) {
      // This would need to integrate with game configuration for actual payout tables
      // For now, just validate that payouts are non-negative
      if (cluster.payout < 0) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.PAYOUT_MANIPULATION,
          message: `Negative payout in cluster: ${cluster.payout}`
        });
      }

      calculatedWin += cluster.payout;
    }

    // Check if step win matches calculated win
    const stepWin = cascadeStep.winData.stepWin;
    if (Math.abs(stepWin - calculatedWin) > 0.01) { // Allow for small floating point differences
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.PAYOUT_MANIPULATION,
        message: `Step win mismatch: expected ${calculatedWin}, got ${stepWin}`
      });
    }

    return result;
  }

  /**
     * Checks if cluster positions are connected
     * @param {Array<Object>} positions - Array of {col, row} positions
     * @returns {boolean} True if all positions are connected
     */
  isClusterConnected(positions) {
    if (positions.length === 0) {return false;}
    if (positions.length === 1) {return true;}

    // Create adjacency map
    const positionMap = new Set();
    for (const pos of positions) {
      positionMap.add(`${pos.col},${pos.row}`);
    }

    // Flood fill from first position
    const visited = new Set();
    const queue = [positions[0]];
    visited.add(`${positions[0].col},${positions[0].row}`);

    while (queue.length > 0) {
      const current = queue.shift();

      // Check all adjacent positions
      const adjacents = [
        { col: current.col - 1, row: current.row },
        { col: current.col + 1, row: current.row },
        { col: current.col, row: current.row - 1 },
        { col: current.col, row: current.row + 1 }
      ];

      for (const adj of adjacents) {
        const adjKey = `${adj.col},${adj.row}`;
        if (positionMap.has(adjKey) && !visited.has(adjKey)) {
          visited.add(adjKey);
          queue.push(adj);
        }
      }
    }

    // All positions should be visited if connected
    return visited.size === positions.length;
  }

  // ===========================================
  // Task 2.3.3: Timing Validation Mechanisms
  // ===========================================

  /**
     * Validates timing for cascade steps and sequences
     * @param {Object} timingData - Timing data to validate
     * @param {Object} context - Validation context
     * @returns {Object} Validation result
     */
  validateTiming(timingData, context = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      timingAnalysis: {}
    };

    try {
      // Validate step timing
      if (timingData.stepTiming) {
        const stepValidation = this.validateStepTiming(timingData.stepTiming);
        if (!stepValidation.isValid) {
          result.isValid = false;
          result.errors.push(...stepValidation.errors);
        }
        result.timingAnalysis.stepTiming = stepValidation.analysis;
      }

      // Validate sequence timing
      if (timingData.sequenceTiming) {
        const sequenceValidation = this.validateSequenceTiming(timingData.sequenceTiming);
        if (!sequenceValidation.isValid) {
          result.isValid = false;
          result.errors.push(...sequenceValidation.errors);
        }
        result.timingAnalysis.sequenceTiming = sequenceValidation.analysis;
      }

      // Validate client-server synchronization timing
      if (timingData.syncTiming && context.serverTimestamp) {
        const syncValidation = this.validateSyncTiming(timingData.syncTiming, context.serverTimestamp);
        if (!syncValidation.isValid) {
          result.warnings.push(...syncValidation.warnings);
        }
        result.timingAnalysis.syncTiming = syncValidation.analysis;
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
        message: `Timing validation failed: ${error.message}`
      });
    }

    return result;
  }

  /**
     * Validates individual step timing
     * @param {Object} stepTiming - Step timing data
     * @returns {Object} Validation result
     */
  validateStepTiming(stepTiming) {
    const result = {
      isValid: true,
      errors: [],
      analysis: {}
    };

    // Check timing values are valid
    if (stepTiming.startTime < 0 || stepTiming.endTime < 0) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
        message: 'Negative timing values detected'
      });
    }

    if (stepTiming.endTime <= stepTiming.startTime) {
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
        message: 'Invalid timing sequence: end before start'
      });
    }

    // Calculate and validate duration
    const calculatedDuration = stepTiming.endTime - stepTiming.startTime;
    if (Math.abs(calculatedDuration - stepTiming.duration) > 10) { // 10ms tolerance
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
        message: `Duration mismatch: calculated ${calculatedDuration}, reported ${stepTiming.duration}`
      });
    }

    // Validate sub-timing components
    const subTimings = [
      stepTiming.matchDetectionTime,
      stepTiming.removalAnimationTime,
      stepTiming.dropAnimationTime,
      stepTiming.settleDuration
    ];

    const totalSubTimings = subTimings.reduce((sum, time) => sum + (time || 0), 0);
    if (Math.abs(totalSubTimings - stepTiming.duration) > 50) { // 50ms tolerance
      result.isValid = false;
      result.errors.push({
        code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
        message: `Sub-timing mismatch: total ${totalSubTimings}, duration ${stepTiming.duration}`
      });
    }

    result.analysis = {
      calculatedDuration,
      totalSubTimings,
      timingEfficiency: calculatedDuration > 0 ? (totalSubTimings / calculatedDuration) : 0
    };

    return result;
  }

  /**
     * Validates sequence timing across multiple steps
     * @param {Array} sequenceTiming - Array of step timings
     * @returns {Object} Validation result
     */
  validateSequenceTiming(sequenceTiming) {
    const result = {
      isValid: true,
      errors: [],
      analysis: {}
    };

    if (!Array.isArray(sequenceTiming) || sequenceTiming.length === 0) {
      return result;
    }

    let totalDuration = 0;
    let previousEndTime = 0;

    for (let i = 0; i < sequenceTiming.length; i++) {
      const stepTiming = sequenceTiming[i];

      // Check timing progression
      if (stepTiming.startTime < previousEndTime) {
        result.isValid = false;
        result.errors.push({
          code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
          message: `Overlapping steps detected at step ${i}`
        });
      }

      totalDuration += stepTiming.duration;
      previousEndTime = stepTiming.endTime;
    }

    result.analysis = {
      totalSteps: sequenceTiming.length,
      totalDuration,
      averageStepDuration: totalDuration / sequenceTiming.length,
      sequenceIntegrity: true
    };

    return result;
  }

  /**
     * Validates client-server synchronization timing
     * @param {Object} clientTiming - Client timing data
     * @param {number} serverTimestamp - Server timestamp
     * @returns {Object} Validation result
     */
  validateSyncTiming(clientTiming, serverTimestamp) {
    const result = {
      isValid: true,
      warnings: [],
      analysis: {}
    };

    const timeDifference = Math.abs(clientTiming.timestamp - serverTimestamp);

    if (timeDifference > this.options.timingTolerance) {
      result.isValid = false;
      result.warnings.push({
        code: this.ERROR_CODES.TIMING_VALIDATION_FAILURE,
        message: `Client-server time difference too large: ${timeDifference}ms`
      });
    }

    result.analysis = {
      timeDifference,
      withinTolerance: timeDifference <= this.options.timingTolerance,
      tolerance: this.options.timingTolerance
    };

    return result;
  }

  // ===========================================
  // Task 2.3.4: Fraud Detection Capabilities
  // ===========================================

  /**
     * Detects potential fraud in grid states
     * @param {Array<Array<string|null>>} gridState - Grid to analyze
     * @returns {Object} Fraud detection result
     */
  detectGridFraud(gridState) {
    const result = {
      suspicious: false,
      warnings: [],
      fraudScore: 0,
      patterns: []
    };

    // Check for impossible patterns
    const impossiblePatterns = this.detectImpossiblePatterns(gridState);
    if (impossiblePatterns.found) {
      result.suspicious = true;
      result.fraudScore += 50;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: 'Impossible grid patterns detected',
        details: impossiblePatterns.patterns
      });
    }

    // Check for artificially perfect distributions
    const distributionAnalysis = this.analyzeSymbolDistribution(gridState);
    if (distributionAnalysis.suspicious) {
      result.suspicious = true;
      result.fraudScore += 30;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: 'Suspicious symbol distribution',
        details: distributionAnalysis
      });
    }

    // Check for repeated patterns
    const patternAnalysis = this.detectRepeatedPatterns(gridState);
    if (patternAnalysis.suspicious) {
      result.suspicious = true;
      result.fraudScore += 20;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: 'Repeated patterns detected',
        details: patternAnalysis
      });
    }

    return result;
  }

  /**
     * Detects potential fraud in cascade steps
     * @param {CascadeStep} cascadeStep - Step to analyze
     * @returns {Object} Fraud detection result
     */
  detectCascadeStepFraud(cascadeStep) {
    const result = {
      suspicious: false,
      warnings: [],
      fraudScore: 0
    };

    // Check for impossible match patterns
    const matchAnalysis = this.analyzeMatchPatterns(cascadeStep);
    if (matchAnalysis.suspicious) {
      result.suspicious = true;
      result.fraudScore += 40;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: 'Suspicious match patterns',
        details: matchAnalysis
      });
    }

    // Check for payout manipulation
    const payoutAnalysis = this.analyzePayoutPatterns(cascadeStep);
    if (payoutAnalysis.suspicious) {
      result.suspicious = true;
      result.fraudScore += 60;
      result.warnings.push({
        code: this.ERROR_CODES.PAYOUT_MANIPULATION,
        message: 'Potential payout manipulation',
        details: payoutAnalysis
      });
    }

    // Check timing manipulation
    const timingAnalysis = this.analyzeTimingManipulation(cascadeStep);
    if (timingAnalysis.suspicious) {
      result.suspicious = true;
      result.fraudScore += 25;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: 'Timing manipulation detected',
        details: timingAnalysis
      });
    }

    return result;
  }

  /**
     * Detects impossible grid patterns
     * @param {Array<Array<string|null>>} gridState - Grid to analyze
     * @returns {Object} Analysis result
     */
  detectImpossiblePatterns(gridState) {
    const result = {
      found: false,
      patterns: []
    };

    // Check for horizontal/vertical lines of same symbol (very unlikely naturally)
    for (let col = 0; col < gridState.length; col++) {
      let verticalCount = 1;
      let currentSymbol = gridState[col][0];

      for (let row = 1; row < gridState[col].length; row++) {
        if (gridState[col][row] === currentSymbol && currentSymbol !== null) {
          verticalCount++;
        } else {
          if (verticalCount >= 4) {
            result.found = true;
            result.patterns.push({
              type: 'vertical_line',
              column: col,
              length: verticalCount,
              symbol: currentSymbol
            });
          }
          verticalCount = 1;
          currentSymbol = gridState[col][row];
        }
      }

      if (verticalCount >= 4) {
        result.found = true;
        result.patterns.push({
          type: 'vertical_line',
          column: col,
          length: verticalCount,
          symbol: currentSymbol
        });
      }
    }

    return result;
  }

  /**
     * Analyzes symbol distribution for anomalies
     * @param {Array<Array<string|null>>} gridState - Grid to analyze
     * @returns {Object} Analysis result
     */
  analyzeSymbolDistribution(gridState) {
    const symbolCounts = {};
    let totalSymbols = 0;

    // Count symbols
    for (const column of gridState) {
      for (const symbol of column) {
        if (symbol !== null) {
          symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
          totalSymbols++;
        }
      }
    }

    // Calculate expected distribution (should be roughly even)
    const expectedPerSymbol = totalSymbols / this.options.validSymbols.length;
    let maxDeviation = 0;
    let uniformityScore = 0;

    for (const symbol of this.options.validSymbols) {
      const count = symbolCounts[symbol] || 0;
      const deviation = Math.abs(count - expectedPerSymbol);
      maxDeviation = Math.max(maxDeviation, deviation);
      uniformityScore += deviation;
    }

    // Suspicious if distribution is too uniform (might be artificially generated)
    const suspicious = uniformityScore < totalSymbols * 0.1; // Less than 10% deviation total

    return {
      suspicious,
      symbolCounts,
      uniformityScore,
      maxDeviation,
      totalSymbols
    };
  }

  /**
     * Detects repeated patterns in grid
     * @param {Array<Array<string|null>>} gridState - Grid to analyze
     * @returns {Object} Analysis result
     */
  detectRepeatedPatterns(gridState) {
    const result = {
      suspicious: false,
      repeatedPatterns: 0
    };

    // Check for 2x2 repeated patterns
    const patterns = new Map();

    for (let col = 0; col < gridState.length - 1; col++) {
      for (let row = 0; row < gridState[col].length - 1; row++) {
        const pattern = [
          gridState[col][row],
          gridState[col + 1][row],
          gridState[col][row + 1],
          gridState[col + 1][row + 1]
        ].join(',');

        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    }

    // Count how many patterns repeat more than once
    for (const [pattern, count] of patterns) {
      if (count > 1 && !pattern.includes('null')) {
        result.repeatedPatterns++;
      }
    }

    // Suspicious if too many patterns repeat
    result.suspicious = result.repeatedPatterns > 3;

    return result;
  }

  /**
     * Analyzes match patterns for fraud
     * @param {CascadeStep} cascadeStep - Step to analyze
     * @returns {Object} Analysis result
     */
  analyzeMatchPatterns(cascadeStep) {
    const result = {
      suspicious: false,
      reasons: []
    };

    // Check for too many large clusters (statistically unlikely)
    const largeClusters = cascadeStep.matchedClusters.filter(cluster => cluster.clusterSize > 15);
    if (largeClusters.length > 2) {
      result.suspicious = true;
      result.reasons.push(`Too many large clusters: ${largeClusters.length}`);
    }

    // Check for perfect geometric shapes (artificial)
    for (const cluster of cascadeStep.matchedClusters) {
      if (this.isPerfectGeometricShape(cluster.positions)) {
        result.suspicious = true;
        result.reasons.push(`Perfect geometric cluster detected: ${cluster.symbolType}`);
      }
    }

    return result;
  }

  /**
     * Analyzes payout patterns for manipulation
     * @param {CascadeStep} cascadeStep - Step to analyze
     * @returns {Object} Analysis result
     */
  analyzePayoutPatterns(cascadeStep) {
    const result = {
      suspicious: false,
      reasons: []
    };

    // Check for unusually high payouts
    const totalPayout = cascadeStep.winData.stepWin;
    if (totalPayout > 100) { // Arbitrary threshold - would need game config integration
      result.suspicious = true;
      result.reasons.push(`Unusually high payout: ${totalPayout}`);
    }

    // Check for impossible multipliers
    if (cascadeStep.winData.stepMultiplier > 10) {
      result.suspicious = true;
      result.reasons.push(`Impossible multiplier: ${cascadeStep.winData.stepMultiplier}`);
    }

    return result;
  }

  /**
     * Analyzes timing for manipulation signs
     * @param {CascadeStep} cascadeStep - Step to analyze
     * @returns {Object} Analysis result
     */
  analyzeTimingManipulation(cascadeStep) {
    const result = {
      suspicious: false,
      reasons: []
    };

    // Check for impossibly fast completion
    if (cascadeStep.timing.duration < 100) {
      result.suspicious = true;
      result.reasons.push(`Too fast completion: ${cascadeStep.timing.duration}ms`);
    }

    // Check for perfect timing (artificial)
    const subTimings = [
      cascadeStep.timing.matchDetectionTime,
      cascadeStep.timing.removalAnimationTime,
      cascadeStep.timing.dropAnimationTime,
      cascadeStep.timing.settleDuration
    ];

    if (subTimings.every(time => time % 100 === 0)) {
      result.suspicious = true;
      result.reasons.push('Perfect timing values (artificial)');
    }

    return result;
  }

  /**
     * Checks if cluster positions form a perfect geometric shape
     * @param {Array<Object>} positions - Cluster positions
     * @returns {boolean} True if perfect geometric shape
     */
  isPerfectGeometricShape(positions) {
    if (positions.length < 4) {return false;}

    // Check for perfect rectangle
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));
    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));

    const expectedRectangleSize = (maxCol - minCol + 1) * (maxRow - minRow + 1);

    return positions.length === expectedRectangleSize;
  }

  // ===========================================
  // Validation Orchestration and Utilities
  // ===========================================

  /**
     * Performs comprehensive validation of a complete spin result
     * @param {SpinResult} spinResult - Spin result to validate
     * @param {GameSession} session - Game session context
     * @returns {Object} Complete validation result
     */
  validateCompleteSpinResult(spinResult, session = null) {
    const startTime = Date.now();
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      validationSummary: {
        gridValidations: 0,
        stepValidations: 0,
        timingValidations: 0,
        fraudChecks: 0
      },
      fraudScore: 0,
      validationTime: null
    };

    try {
      // Validate initial grid
      const initialGridValidation = this.validateGridState(spinResult.initialGrid);
      result.validationSummary.gridValidations++;
      if (!initialGridValidation.isValid) {
        result.isValid = false;
        result.errors.push(...initialGridValidation.errors);
      }

      // Validate each cascade step
      let previousStep = null;
      for (const cascadeStep of spinResult.cascadeSteps) {
        const stepValidation = this.validateCascadeStepIntegrity(cascadeStep, previousStep);
        result.validationSummary.stepValidations++;

        if (!stepValidation.isValid) {
          result.isValid = false;
          result.errors.push(...stepValidation.errors);
        }

        result.warnings.push(...stepValidation.warnings);
        previousStep = cascadeStep;
      }

      // Validate overall sequence timing
      if (spinResult.cascadeSteps.length > 0) {
        const sequenceTiming = spinResult.cascadeSteps.map(step => step.timing);
        const timingValidation = this.validateTiming({ sequenceTiming });
        result.validationSummary.timingValidations++;

        if (!timingValidation.isValid) {
          result.isValid = false;
          result.errors.push(...timingValidation.errors);
        }
      }

      // Fraud detection on complete result
      if (this.options.fraudDetectionEnabled) {
        const fraudAnalysis = this.analyzeSpinResultFraud(spinResult, session);
        result.validationSummary.fraudChecks++;
        result.fraudScore = fraudAnalysis.fraudScore;

        if (fraudAnalysis.suspicious) {
          result.warnings.push(...fraudAnalysis.warnings);
        }
      }

      // Update fraud detection statistics
      if (session) {
        this.updateFraudDetectionStats(session.sessionId, result.fraudScore);
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        code: 'VALIDATION_ERROR',
        message: `Complete validation failed: ${error.message}`
      });
    } finally {
      result.validationTime = Date.now() - startTime;
      this.updatePerformanceMetrics('completeValidation', result.validationTime, result.isValid);
    }

    return result;
  }

  /**
     * Analyzes complete spin result for fraud
     * @param {SpinResult} spinResult - Spin result to analyze
     * @param {GameSession} session - Session context
     * @returns {Object} Fraud analysis result
     */
  analyzeSpinResultFraud(spinResult, session) {
    const result = {
      suspicious: false,
      warnings: [],
      fraudScore: 0
    };

    // Check win frequency (if session provided)
    if (session) {
      const winRate = session.gameState.totalSpins > 0 ?
        session.gameState.totalWins / session.gameState.totalSpins : 0;

      if (winRate > 0.7) { // More than 70% win rate is suspicious
        result.suspicious = true;
        result.fraudScore += 40;
        result.warnings.push({
          code: this.ERROR_CODES.FRAUD_DETECTED,
          message: `Suspicious win rate: ${(winRate * 100).toFixed(1)}%`
        });
      }
    }

    // Check for impossible wins
    if (spinResult.totalWin > spinResult.betAmount * 1000) { // 1000x bet is extremely unlikely
      result.suspicious = true;
      result.fraudScore += 80;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: `Impossible win amount: ${spinResult.totalWin}`
      });
    }

    // Check cascade count (too many cascades is suspicious)
    if (spinResult.cascadeSteps.length > 10) {
      result.suspicious = true;
      result.fraudScore += 30;
      result.warnings.push({
        code: this.ERROR_CODES.FRAUD_DETECTED,
        message: `Too many cascades: ${spinResult.cascadeSteps.length}`
      });
    }

    return result;
  }

  /**
     * Updates performance metrics
     * @param {string} operation - Operation type
     * @param {number} duration - Operation duration
     * @param {boolean} success - Whether operation succeeded
     */
  updatePerformanceMetrics(operation, duration, success) {
    if (!this.options.enablePerformanceMetrics) {return;}

    this.performanceMetrics.totalValidations++;

    if (success) {
      this.performanceMetrics.successfulValidations++;
    } else {
      this.performanceMetrics.failedValidations++;
    }

    // Update average validation time
    const totalTime = this.performanceMetrics.averageValidationTime *
            (this.performanceMetrics.totalValidations - 1) + duration;
    this.performanceMetrics.averageValidationTime =
            totalTime / this.performanceMetrics.totalValidations;

    this.performanceMetrics.lastValidationTime = Date.now();
  }

  /**
     * Updates fraud detection statistics
     * @param {string} sessionId - Session ID
     * @param {number} fraudScore - Fraud score for this validation
     */
  updateFraudDetectionStats(sessionId, fraudScore) {
    if (!this.fraudDetectionStats.has(sessionId)) {
      this.fraudDetectionStats.set(sessionId, {
        totalValidations: 0,
        totalFraudScore: 0,
        averageFraudScore: 0,
        highFraudIncidents: 0
      });
    }

    const stats = this.fraudDetectionStats.get(sessionId);
    stats.totalValidations++;
    stats.totalFraudScore += fraudScore;
    stats.averageFraudScore = stats.totalFraudScore / stats.totalValidations;

    if (fraudScore > 50) {
      stats.highFraudIncidents++;
    }
  }

  /**
     * Gets performance metrics
     * @returns {Object} Performance metrics
     */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
     * Gets fraud detection statistics
     * @param {string} sessionId - Optional session ID filter
     * @returns {Object} Fraud detection statistics
     */
  getFraudDetectionStats(sessionId = null) {
    if (sessionId) {
      return this.fraudDetectionStats.get(sessionId) || null;
    }

    return Object.fromEntries(this.fraudDetectionStats);
  }

  /**
     * Clears validation cache
     */
  clearValidationCache() {
    this.validationCache.clear();
  }

  /**
     * Resets performance metrics
     */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      lastValidationTime: null
    };
  }

  /**
     * Creates a validation report
     * @param {Object} validationResult - Validation result to report
     * @returns {Object} Formatted validation report
     */
  createValidationReport(validationResult) {
    return {
      timestamp: Date.now(),
      status: validationResult.isValid ? 'VALID' : 'INVALID',
      summary: {
        totalErrors: validationResult.errors.length,
        totalWarnings: validationResult.warnings.length,
        fraudScore: validationResult.fraudScore || 0,
        validationTime: validationResult.validationTime
      },
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      metrics: this.getPerformanceMetrics()
    };
  }
}

// Adapters for test expectations and route usage
CascadeValidator.prototype.validateCascadeStep = function(cascadeStep, previousStep = null /*, gameConfig */) {
  const result = this.validateCascadeStepIntegrity(cascadeStep, previousStep);
  return {
    valid: result.isValid,
    errors: result.errors || [],
    warnings: result.warnings || [],
    fraudDetected: (result.warnings || []).some(w => w.code === this.ERROR_CODES?.FRAUD_DETECTED)
  };
};

CascadeValidator.prototype.validateCascadeSequence = function(cascadeSteps = [], spinResult /* optional */) {
  const errors = [];
  const warnings = [];
  let allValid = true;
  let previous = null;
  for (const step of cascadeSteps) {
    const v = this.validateCascadeStep(step, previous);
    if (!v.valid) {allValid = false;}
    errors.push(...(v.errors || []));
    warnings.push(...(v.warnings || []));
    previous = step;
  }
  return { valid: allValid, errors, warnings, fraudDetected: warnings.length > 0 };
};

CascadeValidator.prototype.validateGridStateNormalized = function(gridState, options = {}) {
  const r = this.validateGridState(gridState, options);
  return {
    valid: r.isValid,
    errors: r.errors || [],
    warnings: r.warnings || [],
    hash: r.gridHash,
    fraudScore: 0
  };
};

module.exports = CascadeValidator;