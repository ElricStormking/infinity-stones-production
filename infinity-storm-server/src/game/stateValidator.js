/**
 * State Validator - Game State Integrity Validation System
 *
 * Provides comprehensive state validation including:
 * - State consistency checks
 * - Transition validation
 * - Data integrity verification
 * - Business rule enforcement
 * - Mathematical correctness validation
 *
 * Features:
 * - Multi-layer validation framework
 * - Configurable validation rules
 * - Detailed error reporting
 * - Performance-optimized checks
 * - Casino compliance validation
 */

const crypto = require('crypto');

class StateValidator {
  constructor() {
    // Validation rules configuration
    this.validationRules = {
      // Game mode rules
      gameModes: ['base', 'free_spins', 'bonus'],

      // Multiplier constraints
      multiplier: {
        min: 1.00,
        max: 1000.00,
        precision: 2
      },

      // Free spins constraints
      freeSpins: {
        min: 0,
        max: 100,
        validAwards: [5, 8, 10, 12, 15, 20, 25, 30]
      },

      // State data constraints
      stateData: {
        maxSize: 10240, // 10KB max state data
        requiredFields: ['last_updated'],
        forbiddenFields: ['password', 'private_key', 'secret']
      },

      // Transition rules
      validTransitions: {
        'base': ['free_spins', 'bonus'],
        'free_spins': ['base', 'bonus'],
        'bonus': ['base', 'free_spins']
      },

      // Business rules
      business: {
        maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
        maxStateAge: 7 * 24 * 60 * 60 * 1000,    // 7 days
        maxMultiplierIncrease: 10.0,
        maxFreeSpinsPerTrigger: 50
      }
    };

    // Validation contexts
    this.validationContexts = {
      CREATION: 'creation',
      UPDATE: 'update',
      TRANSITION: 'transition',
      PERSISTENCE: 'persistence',
      RECOVERY: 'recovery'
    };

    // Error severity levels
    this.errorSeverity = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      INFO: 'info'
    };
  }

  /**
     * Validate complete game state
     * @param {Object} gameState - Game state to validate
     * @param {string} context - Validation context
     * @returns {Promise<Object>} Validation result
     */
  async validateState(gameState, context = this.validationContexts.UPDATE) {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      context
    };

    try {
      // Basic structure validation
      const structureResult = this.validateStateStructure(gameState);
      this.mergeValidationResults(validationResult, structureResult);

      // Game mode validation
      const gameModeResult = this.validateGameMode(gameState);
      this.mergeValidationResults(validationResult, gameModeResult);

      // Multiplier validation
      const multiplierResult = this.validateMultiplier(gameState);
      this.mergeValidationResults(validationResult, multiplierResult);

      // Free spins validation
      const freeSpinsResult = this.validateFreeSpins(gameState);
      this.mergeValidationResults(validationResult, freeSpinsResult);

      // State data validation
      const stateDataResult = this.validateStateData(gameState);
      this.mergeValidationResults(validationResult, stateDataResult);

      // Business rules validation
      const businessResult = this.validateBusinessRules(gameState, context);
      this.mergeValidationResults(validationResult, businessResult);

      // Mathematical consistency
      const mathResult = this.validateMathematicalConsistency(gameState);
      this.mergeValidationResults(validationResult, mathResult);

      // Context-specific validation
      const contextResult = await this.validateByContext(gameState, context);
      this.mergeValidationResults(validationResult, contextResult);

      // Set overall validity
      validationResult.valid = validationResult.errors.length === 0;

      return validationResult;

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        context
      };
    }
  }

  /**
     * Validate state transition
     * @param {Object} currentState - Current game state
     * @param {Object} stateUpdates - Proposed state updates
     * @param {string} reason - Reason for transition
     * @returns {Promise<Object>} Validation result
     */
  async validateStateTransition(currentState, stateUpdates, reason) {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      context: this.validationContexts.TRANSITION
    };

    try {
      // Validate transition legality
      const transitionResult = this.validateTransitionLegality(currentState, stateUpdates);
      this.mergeValidationResults(validationResult, transitionResult);

      // Validate transition timing
      const timingResult = this.validateTransitionTiming(currentState, reason);
      this.mergeValidationResults(validationResult, timingResult);

      // Validate transition magnitude
      const magnitudeResult = this.validateTransitionMagnitude(currentState, stateUpdates);
      this.mergeValidationResults(validationResult, magnitudeResult);

      // Validate transition context
      const contextResult = this.validateTransitionContext(currentState, stateUpdates, reason);
      this.mergeValidationResults(validationResult, contextResult);

      // Create hypothetical new state for full validation
      const hypotheticalState = { ...currentState, ...stateUpdates };
      const newStateResult = await this.validateState(hypotheticalState, this.validationContexts.TRANSITION);
      this.mergeValidationResults(validationResult, newStateResult);

      validationResult.valid = validationResult.errors.length === 0;
      return validationResult;

    } catch (error) {
      return {
        valid: false,
        errors: [`Transition validation error: ${error.message}`],
        warnings: [],
        context: this.validationContexts.TRANSITION
      };
    }
  }

  /**
     * Validate state structure
     * @param {Object} gameState - Game state to validate
     * @returns {Object} Validation result
     */
  validateStateStructure(gameState) {
    const errors = [];
    const warnings = [];

    // Check required fields
    const requiredFields = ['player_id', 'game_mode', 'free_spins_remaining', 'accumulated_multiplier'];

    for (const field of requiredFields) {
      if (gameState[field] === undefined || gameState[field] === null) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          severity: this.errorSeverity.CRITICAL
        });
      }
    }

    // Check field types
    const fieldTypes = {
      player_id: 'string',
      game_mode: 'string',
      free_spins_remaining: 'number',
      accumulated_multiplier: 'number'
    };

    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (gameState[field] !== undefined && typeof gameState[field] !== expectedType) {
        errors.push({
          field,
          message: `Field '${field}' must be of type '${expectedType}', got '${typeof gameState[field]}'`,
          severity: this.errorSeverity.HIGH
        });
      }
    }

    return { errors, warnings };
  }

  /**
     * Validate game mode
     * @param {Object} gameState - Game state to validate
     * @returns {Object} Validation result
     */
  validateGameMode(gameState) {
    const errors = [];
    const warnings = [];

    // Check if game mode is valid
    if (!this.validationRules.gameModes.includes(gameState.game_mode)) {
      errors.push({
        field: 'game_mode',
        message: `Invalid game mode '${gameState.game_mode}'. Valid modes: ${this.validationRules.gameModes.join(', ')}`,
        severity: this.errorSeverity.CRITICAL
      });
    }

    // Check game mode consistency
    if (gameState.game_mode === 'base') {
      if (gameState.free_spins_remaining > 0) {
        errors.push({
          field: 'game_mode',
          message: 'Base game mode cannot have free spins remaining',
          severity: this.errorSeverity.HIGH
        });
      }

      if (gameState.accumulated_multiplier > 1.00) {
        warnings.push({
          field: 'accumulated_multiplier',
          message: 'Base game mode typically has multiplier of 1.00',
          severity: this.errorSeverity.LOW
        });
      }
    }

    if (gameState.game_mode === 'free_spins') {
      if (gameState.free_spins_remaining === 0) {
        errors.push({
          field: 'game_mode',
          message: 'Free spins mode must have free spins remaining',
          severity: this.errorSeverity.HIGH
        });
      }
    }

    return { errors, warnings };
  }

  /**
     * Validate multiplier values
     * @param {Object} gameState - Game state to validate
     * @returns {Object} Validation result
     */
  validateMultiplier(gameState) {
    const errors = [];
    const warnings = [];
    const multiplier = gameState.accumulated_multiplier;

    // Check multiplier range
    if (multiplier < this.validationRules.multiplier.min) {
      errors.push({
        field: 'accumulated_multiplier',
        message: `Multiplier cannot be less than ${this.validationRules.multiplier.min}`,
        severity: this.errorSeverity.CRITICAL
      });
    }

    if (multiplier > this.validationRules.multiplier.max) {
      errors.push({
        field: 'accumulated_multiplier',
        message: `Multiplier cannot exceed ${this.validationRules.multiplier.max}`,
        severity: this.errorSeverity.CRITICAL
      });
    }

    // Check multiplier precision
    const decimalPlaces = this.getDecimalPlaces(multiplier);
    if (decimalPlaces > this.validationRules.multiplier.precision) {
      warnings.push({
        field: 'accumulated_multiplier',
        message: `Multiplier has more than ${this.validationRules.multiplier.precision} decimal places`,
        severity: this.errorSeverity.LOW
      });
    }

    // Check for unusual multiplier values
    if (multiplier > 10.00) {
      warnings.push({
        field: 'accumulated_multiplier',
        message: `Unusually high multiplier value: ${multiplier}`,
        severity: this.errorSeverity.MEDIUM
      });
    }

    return { errors, warnings };
  }

  /**
     * Validate free spins
     * @param {Object} gameState - Game state to validate
     * @returns {Object} Validation result
     */
  validateFreeSpins(gameState) {
    const errors = [];
    const warnings = [];
    const freeSpins = gameState.free_spins_remaining;

    // Check free spins range
    if (freeSpins < this.validationRules.freeSpins.min) {
      errors.push({
        field: 'free_spins_remaining',
        message: 'Free spins cannot be negative',
        severity: this.errorSeverity.CRITICAL
      });
    }

    if (freeSpins > this.validationRules.freeSpins.max) {
      errors.push({
        field: 'free_spins_remaining',
        message: `Free spins cannot exceed ${this.validationRules.freeSpins.max}`,
        severity: this.errorSeverity.HIGH
      });
    }

    // Check for unusual free spins counts
    if (freeSpins > 0 && !this.validationRules.freeSpins.validAwards.includes(freeSpins)) {
      const closestValid = this.findClosestValidValue(freeSpins, this.validationRules.freeSpins.validAwards);
      warnings.push({
        field: 'free_spins_remaining',
        message: `Unusual free spins count: ${freeSpins}. Expected values: ${this.validationRules.freeSpins.validAwards.join(', ')}. Closest valid: ${closestValid}`,
        severity: this.errorSeverity.LOW
      });
    }

    return { errors, warnings };
  }

  /**
     * Validate state data
     * @param {Object} gameState - Game state to validate
     * @returns {Object} Validation result
     */
  validateStateData(gameState) {
    const errors = [];
    const warnings = [];
    const stateData = gameState.state_data || {};

    // Check state data size
    const stateDataSize = JSON.stringify(stateData).length;
    if (stateDataSize > this.validationRules.stateData.maxSize) {
      errors.push({
        field: 'state_data',
        message: `State data size (${stateDataSize} bytes) exceeds maximum (${this.validationRules.stateData.maxSize} bytes)`,
        severity: this.errorSeverity.HIGH
      });
    }

    // Check required fields
    for (const requiredField of this.validationRules.stateData.requiredFields) {
      if (!stateData[requiredField]) {
        warnings.push({
          field: 'state_data',
          message: `State data missing recommended field: ${requiredField}`,
          severity: this.errorSeverity.LOW
        });
      }
    }

    // Check for forbidden fields
    for (const forbiddenField of this.validationRules.stateData.forbiddenFields) {
      if (stateData[forbiddenField]) {
        errors.push({
          field: 'state_data',
          message: `State data contains forbidden field: ${forbiddenField}`,
          severity: this.errorSeverity.CRITICAL
        });
      }
    }

    // Validate state data structure
    try {
      JSON.stringify(stateData);
    } catch (error) {
      errors.push({
        field: 'state_data',
        message: `State data is not JSON serializable: ${error.message}`,
        severity: this.errorSeverity.HIGH
      });
    }

    return { errors, warnings };
  }

  /**
     * Validate business rules
     * @param {Object} gameState - Game state to validate
     * @param {string} context - Validation context
     * @returns {Object} Validation result
     */
  validateBusinessRules(gameState, context) {
    const errors = [];
    const warnings = [];

    // Check state age
    if (gameState.created_at) {
      const stateAge = Date.now() - new Date(gameState.created_at).getTime();
      if (stateAge > this.validationRules.business.maxStateAge) {
        warnings.push({
          field: 'created_at',
          message: `State is older than maximum age (${Math.round(stateAge / (24 * 60 * 60 * 1000))} days)`,
          severity: this.errorSeverity.MEDIUM
        });
      }
    }

    // Check session duration if applicable
    if (gameState.session && gameState.session.created_at) {
      const sessionDuration = Date.now() - new Date(gameState.session.created_at).getTime();
      if (sessionDuration > this.validationRules.business.maxSessionDuration) {
        warnings.push({
          field: 'session_duration',
          message: `Session duration exceeds maximum (${Math.round(sessionDuration / (60 * 60 * 1000))} hours)`,
          severity: this.errorSeverity.MEDIUM
        });
      }
    }

    // Casino-specific business rules
    if (gameState.game_mode === 'free_spins') {
      // Free spins should have a reasonable trigger record
      const freeSpinsTrigger = gameState.state_data?.free_spins_triggered_at;
      if (!freeSpinsTrigger) {
        warnings.push({
          field: 'state_data',
          message: 'Free spins mode lacks trigger timestamp',
          severity: this.errorSeverity.LOW
        });
      }
    }

    return { errors, warnings };
  }

  /**
     * Validate mathematical consistency
     * @param {Object} gameState - Game state to validate
     * @returns {Object} Validation result
     */
  validateMathematicalConsistency(gameState) {
    const errors = [];
    const warnings = [];

    // Check for NaN or Infinity values
    const numericalFields = ['accumulated_multiplier', 'free_spins_remaining'];

    for (const field of numericalFields) {
      const value = gameState[field];
      if (typeof value === 'number') {
        if (isNaN(value)) {
          errors.push({
            field,
            message: `Field '${field}' is NaN`,
            severity: this.errorSeverity.CRITICAL
          });
        }

        if (!isFinite(value)) {
          errors.push({
            field,
            message: `Field '${field}' is not finite`,
            severity: this.errorSeverity.CRITICAL
          });
        }
      }
    }

    // Check mathematical relationships
    if (gameState.game_mode === 'free_spins' && gameState.accumulated_multiplier === 1.00) {
      warnings.push({
        field: 'accumulated_multiplier',
        message: 'Free spins mode typically has multiplier greater than 1.00',
        severity: this.errorSeverity.LOW
      });
    }

    return { errors, warnings };
  }

  /**
     * Validate by context
     * @param {Object} gameState - Game state to validate
     * @param {string} context - Validation context
     * @returns {Promise<Object>} Validation result
     */
  async validateByContext(gameState, context) {
    const errors = [];
    const warnings = [];

    switch (context) {
    case this.validationContexts.CREATION:
      // New state should have default values
      if (gameState.accumulated_multiplier !== 1.00) {
        warnings.push({
          field: 'accumulated_multiplier',
          message: 'New state typically starts with multiplier 1.00',
          severity: this.errorSeverity.LOW
        });
      }
      break;

    case this.validationContexts.RECOVERY:
      // Recovery context is more lenient
      break;

    case this.validationContexts.PERSISTENCE:
      // Check for persistence-specific requirements
      if (!gameState.updated_at) {
        warnings.push({
          field: 'updated_at',
          message: 'State lacks updated timestamp for persistence',
          severity: this.errorSeverity.LOW
        });
      }
      break;
    }

    return { errors, warnings };
  }

  /**
     * Validate transition legality
     * @param {Object} currentState - Current state
     * @param {Object} stateUpdates - State updates
     * @returns {Object} Validation result
     */
  validateTransitionLegality(currentState, stateUpdates) {
    const errors = [];
    const warnings = [];

    // Check game mode transitions
    if (stateUpdates.game_mode && stateUpdates.game_mode !== currentState.game_mode) {
      const validTransitions = this.validationRules.validTransitions[currentState.game_mode] || [];

      if (!validTransitions.includes(stateUpdates.game_mode)) {
        errors.push({
          field: 'game_mode',
          message: `Invalid transition from '${currentState.game_mode}' to '${stateUpdates.game_mode}'`,
          severity: this.errorSeverity.HIGH
        });
      }
    }

    return { errors, warnings };
  }

  /**
     * Validate transition timing
     * @param {Object} currentState - Current state
     * @param {string} reason - Transition reason
     * @returns {Object} Validation result
     */
  validateTransitionTiming(currentState, reason) {
    const errors = [];
    const warnings = [];

    // Check minimum time between state updates
    if (currentState.updated_at) {
      const lastUpdate = new Date(currentState.updated_at).getTime();
      const timeSinceUpdate = Date.now() - lastUpdate;

      // Require minimum 100ms between updates (except for system updates)
      if (timeSinceUpdate < 100 && reason !== 'system_update') {
        warnings.push({
          field: 'timing',
          message: `Rapid state transition (${timeSinceUpdate}ms since last update)`,
          severity: this.errorSeverity.MEDIUM
        });
      }
    }

    return { errors, warnings };
  }

  /**
     * Validate transition magnitude
     * @param {Object} currentState - Current state
     * @param {Object} stateUpdates - State updates
     * @returns {Object} Validation result
     */
  validateTransitionMagnitude(currentState, stateUpdates) {
    const errors = [];
    const warnings = [];

    // Check multiplier increase magnitude
    if (stateUpdates.accumulated_multiplier !== undefined) {
      const multiplierIncrease = stateUpdates.accumulated_multiplier - currentState.accumulated_multiplier;

      if (multiplierIncrease > this.validationRules.business.maxMultiplierIncrease) {
        errors.push({
          field: 'accumulated_multiplier',
          message: `Multiplier increase (${multiplierIncrease}) exceeds maximum (${this.validationRules.business.maxMultiplierIncrease})`,
          severity: this.errorSeverity.HIGH
        });
      }
    }

    // Check free spins award magnitude
    if (stateUpdates.free_spins_remaining !== undefined) {
      const freeSpinsIncrease = stateUpdates.free_spins_remaining - currentState.free_spins_remaining;

      if (freeSpinsIncrease > this.validationRules.business.maxFreeSpinsPerTrigger) {
        errors.push({
          field: 'free_spins_remaining',
          message: `Free spins award (${freeSpinsIncrease}) exceeds maximum (${this.validationRules.business.maxFreeSpinsPerTrigger})`,
          severity: this.errorSeverity.HIGH
        });
      }
    }

    return { errors, warnings };
  }

  /**
     * Validate transition context
     * @param {Object} currentState - Current state
     * @param {Object} stateUpdates - State updates
     * @param {string} reason - Transition reason
     * @returns {Object} Validation result
     */
  validateTransitionContext(currentState, stateUpdates, reason) {
    const errors = [];
    const warnings = [];

    // Validate reason-specific constraints
    switch (reason) {
    case 'spin_result':
      if (currentState.game_mode === 'free_spins' && stateUpdates.free_spins_remaining !== undefined) {
        const expectedDecrease = stateUpdates.free_spins_remaining - currentState.free_spins_remaining;
        if (expectedDecrease !== -1 && expectedDecrease !== 0) {
          warnings.push({
            field: 'free_spins_remaining',
            message: `Unexpected free spins change (${expectedDecrease}) for spin result`,
            severity: this.errorSeverity.MEDIUM
          });
        }
      }
      break;

    case 'free_spins_awarded':
      if (!stateUpdates.free_spins_remaining || stateUpdates.free_spins_remaining <= currentState.free_spins_remaining) {
        errors.push({
          field: 'free_spins_remaining',
          message: 'Free spins award must increase free spins count',
          severity: this.errorSeverity.HIGH
        });
      }
      break;
    }

    return { errors, warnings };
  }

  /**
     * Merge validation results
     * @param {Object} target - Target validation result
     * @param {Object} source - Source validation result
     */
  mergeValidationResults(target, source) {
    if (source.errors) {
      target.errors.push(...source.errors);
    }
    if (source.warnings) {
      target.warnings.push(...source.warnings);
    }
  }

  /**
     * Get number of decimal places
     * @param {number} number - Number to check
     * @returns {number} Number of decimal places
     */
  getDecimalPlaces(number) {
    if (Math.floor(number) === number) {return 0;}
    const str = number.toString();
    if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
      return str.split('.')[1].length;
    } else if (str.indexOf('e-') !== -1) {
      const parts = str.split('e-');
      return parseInt(parts[1], 10);
    }
    return 0;
  }

  /**
     * Find closest valid value
     * @param {number} value - Value to find closest match for
     * @param {Array} validValues - Array of valid values
     * @returns {number} Closest valid value
     */
  findClosestValidValue(value, validValues) {
    return validValues.reduce((closest, current) => {
      return Math.abs(current - value) < Math.abs(closest - value) ? current : closest;
    });
  }

  /**
     * Create validation error object
     * @param {string} field - Field name
     * @param {string} message - Error message
     * @param {string} severity - Error severity
     * @returns {Object} Error object
     */
  createError(field, message, severity = this.errorSeverity.MEDIUM) {
    return {
      field,
      message,
      severity,
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Create validation warning object
     * @param {string} field - Field name
     * @param {string} message - Warning message
     * @param {string} severity - Warning severity
     * @returns {Object} Warning object
     */
  createWarning(field, message, severity = this.errorSeverity.LOW) {
    return {
      field,
      message,
      severity,
      timestamp: new Date().toISOString()
    };
  }

  /**
     * Get validation rules
     * @returns {Object} Validation rules
     */
  getValidationRules() {
    return { ...this.validationRules };
  }

  /**
     * Update validation rules
     * @param {Object} newRules - New validation rules
     */
  updateValidationRules(newRules) {
    this.validationRules = { ...this.validationRules, ...newRules };
  }

  /**
     * Get validation statistics
     * @returns {Object} Validation statistics
     */
  getStats() {
    return {
      validation_rules: Object.keys(this.validationRules).length,
      validation_contexts: Object.keys(this.validationContexts).length,
      error_severity_levels: Object.keys(this.errorSeverity).length,
      supported_game_modes: this.validationRules.gameModes.length
    };
  }
}

module.exports = StateValidator;