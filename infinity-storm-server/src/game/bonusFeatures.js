/**
 * Server-Side Bonus Features Engine
 *
 * Task 4.2: Port Bonus Feature Logic
 *
 * Handles special bonus features including Infinity Power detection,
 * special symbol interactions, and other bonus game mechanics.
 * Ports logic from client bonus systems and special features.
 *
 * CRITICAL: Must maintain identical bonus feature behavior and triggers.
 */

const { getRNG } = require('./rng');

class BonusFeatures {
  constructor(gameConfig, rng = null) {
    this.gameConfig = gameConfig;
    this.rng = rng || getRNG();

    // Bonus feature configuration
    this.config = {
      infinityPower: {
        requiredSymbols: ['space_gem', 'mind_gem', 'reality_gem', 'power_gem', 'time_gem', 'soul_gem', 'thanos'],
        triggerMultiplier: [2, 3, 4, 5, 6, 8, 10], // Random multiplier when triggered
        animationDuration: 3000
      },
      specialSymbolMultipliers: {
        enabled: true,
        defaultMultiplier: 1
      },
      cascadeBonuses: {
        enabled: true,
        consecutiveCascadeMultipliers: {
          3: 1.1,  // 10% bonus at 3 consecutive cascades
          5: 1.2,  // 20% bonus at 5 consecutive cascades
          7: 1.5,  // 50% bonus at 7 consecutive cascades
          10: 2.0  // 100% bonus at 10 consecutive cascades
        }
      }
    };

    // Statistics tracking
    this.statistics = {
      infinityPowerTriggers: 0,
      totalInfinityPowerWins: 0,
      largestInfinityPowerMultiplier: 0,
      specialSymbolBonuses: 0,
      cascadeBonusesAwarded: 0,
      longestCascadeChain: 0,
      bonusFeaturesTriggered: 0,
      initialized: Date.now()
    };

    this.logAuditEvent('BONUS_FEATURES_INITIALIZED', {
      infinity_power_symbols_required: this.config.infinityPower.requiredSymbols.length,
      cascade_bonus_levels: Object.keys(this.config.cascadeBonuses.consecutiveCascadeMultipliers).length,
      max_cascade_multiplier: Math.max(...Object.values(this.config.cascadeBonuses.consecutiveCascadeMultipliers))
    });
  }

  /**
     * Check for Infinity Power trigger (all 6 gems + Thanos on grid)
     * @param {Array<Array<string>>} grid - Current grid state
     * @returns {Object} Infinity Power check result
     */
  checkInfinityPower(grid) {
    const foundSymbols = new Set();
    const symbolPositions = {};

    // Scan grid for required symbols
    for (let col = 0; col < this.gameConfig.GRID_COLS; col++) {
      for (let row = 0; row < this.gameConfig.GRID_ROWS; row++) {
        const symbol = grid[col][row];
        if (symbol && this.config.infinityPower.requiredSymbols.includes(symbol)) {
          foundSymbols.add(symbol);
          if (!symbolPositions[symbol]) {
            symbolPositions[symbol] = [];
          }
          symbolPositions[symbol].push({ col, row });
        }
      }
    }

    const requiredCount = this.config.infinityPower.requiredSymbols.length;
    const foundCount = foundSymbols.size;
    const isTriggered = foundCount === requiredCount;

    if (isTriggered) {
      // Select random multiplier for Infinity Power
      const multiplierOptions = this.config.infinityPower.triggerMultiplier;
      const selectedMultiplier = multiplierOptions[this.rng.randomInt(0, multiplierOptions.length - 1)];

      // Update statistics
      this.statistics.infinityPowerTriggers++;
      this.statistics.bonusFeaturesTriggered++;
      this.statistics.largestInfinityPowerMultiplier = Math.max(
        this.statistics.largestInfinityPowerMultiplier,
        selectedMultiplier
      );

      const result = {
        triggered: true,
        multiplier: selectedMultiplier,
        requiredSymbols: this.config.infinityPower.requiredSymbols,
        foundSymbols: Array.from(foundSymbols),
        symbolPositions,
        animationDuration: this.config.infinityPower.animationDuration,
        message: 'INFINITY POWER ACTIVATED!'
      };

      this.logAuditEvent('INFINITY_POWER_TRIGGERED', {
        multiplier: selectedMultiplier,
        symbol_positions: Object.keys(symbolPositions).length,
        trigger_count: this.statistics.infinityPowerTriggers
      });

      return result;
    }

    return {
      triggered: false,
      requiredSymbols: this.config.infinityPower.requiredSymbols,
      foundSymbols: Array.from(foundSymbols),
      foundCount,
      requiredCount,
      missing: this.config.infinityPower.requiredSymbols.filter(symbol => !foundSymbols.has(symbol))
    };
  }

  /**
     * Apply symbol multipliers to specific grid positions
     * @param {Array<Array<string>>} grid - Grid to modify
     * @param {Array<Object>} multiplierApplications - Array of {col, row, multiplier}
     * @returns {Object} Application result
     */
  applySymbolMultipliers(grid, multiplierApplications) {
    const appliedMultipliers = [];
    const failedApplications = [];

    for (const application of multiplierApplications) {
      const { col, row, multiplier } = application;

      // Validate position
      if (col < 0 || col >= this.gameConfig.GRID_COLS ||
                row < 0 || row >= this.gameConfig.GRID_ROWS) {
        failedApplications.push({
          ...application,
          reason: 'invalid_position'
        });
        continue;
      }

      // Check if position has a symbol
      if (!grid[col][row]) {
        failedApplications.push({
          ...application,
          reason: 'no_symbol_at_position'
        });
        continue;
      }

      // Apply multiplier (in actual implementation, this would modify the symbol object)
      // For now, we track successful applications
      appliedMultipliers.push({
        col,
        row,
        symbolType: grid[col][row],
        multiplier,
        applied: true
      });

      this.statistics.specialSymbolBonuses++;
    }

    this.logAuditEvent('SYMBOL_MULTIPLIERS_APPLIED', {
      successful_applications: appliedMultipliers.length,
      failed_applications: failedApplications.length,
      total_bonus_count: this.statistics.specialSymbolBonuses
    });

    return {
      appliedMultipliers,
      failedApplications,
      successCount: appliedMultipliers.length,
      failureCount: failedApplications.length
    };
  }

  /**
     * Calculate cascade bonus for consecutive cascades
     * @param {number} cascadeCount - Number of consecutive cascades
     * @param {number} baseWin - Base win amount before bonus
     * @returns {Object} Cascade bonus result
     */
  calculateCascadeBonus(cascadeCount, baseWin) {
    if (!this.config.cascadeBonuses.enabled || cascadeCount < 3) {
      return {
        bonusApplied: false,
        cascadeCount,
        multiplier: 1,
        bonusAmount: 0,
        totalWin: baseWin
      };
    }

    // Find the highest applicable multiplier
    let bonusMultiplier = 1;
    let appliedLevel = 0;

    const multiplierLevels = this.config.cascadeBonuses.consecutiveCascadeMultipliers;
    for (const [level, multiplier] of Object.entries(multiplierLevels)) {
      if (cascadeCount >= parseInt(level)) {
        bonusMultiplier = multiplier;
        appliedLevel = parseInt(level);
      }
    }

    if (bonusMultiplier > 1) {
      const bonusAmount = baseWin * (bonusMultiplier - 1);
      const totalWin = baseWin * bonusMultiplier;

      // Update statistics
      this.statistics.cascadeBonusesAwarded++;
      this.statistics.longestCascadeChain = Math.max(this.statistics.longestCascadeChain, cascadeCount);

      const result = {
        bonusApplied: true,
        cascadeCount,
        appliedLevel,
        multiplier: bonusMultiplier,
        bonusAmount,
        totalWin,
        message: `${cascadeCount} CASCADES! ${(bonusMultiplier * 100).toFixed(0)}% BONUS!`
      };

      this.logAuditEvent('CASCADE_BONUS_APPLIED', {
        cascade_count: cascadeCount,
        applied_level: appliedLevel,
        multiplier: bonusMultiplier,
        base_win: baseWin,
        bonus_amount: bonusAmount,
        total_win: totalWin
      });

      return result;
    }

    return {
      bonusApplied: false,
      cascadeCount,
      multiplier: 1,
      bonusAmount: 0,
      totalWin: baseWin
    };
  }

  /**
     * Process special symbol interactions (gem combinations, etc.)
     * @param {Array<Object>} matches - Current matches on grid
     * @param {Array<Array<string>>} grid - Current grid state
     * @returns {Object} Special interactions result
     */
  processSpecialSymbolInteractions(matches, grid) {
    const interactions = [];
    const gemMatches = [];

    // Identify gem symbol matches
    for (const match of matches) {
      if (match.symbolType.endsWith('_gem')) {
        gemMatches.push(match);
      }
    }

    // Check for multiple gem types in same spin
    if (gemMatches.length >= 2) {
      const gemTypes = gemMatches.map(match => match.symbolType);
      const uniqueGems = [...new Set(gemTypes)];

      if (uniqueGems.length >= 2) {
        // Multi-gem bonus
        const bonusMultiplier = 1 + (uniqueGems.length * 0.1); // 10% per additional gem type

        interactions.push({
          type: 'multi_gem_bonus',
          gemTypes: uniqueGems,
          multiplier: bonusMultiplier,
          message: `${uniqueGems.length} GEM TYPES! ${(bonusMultiplier * 100).toFixed(0)}% BONUS!`
        });

        this.statistics.bonusFeaturesTriggered++;

        this.logAuditEvent('MULTI_GEM_BONUS', {
          gem_types: uniqueGems,
          gem_count: uniqueGems.length,
          multiplier: bonusMultiplier
        });
      }
    }

    // Check for Thanos + Scarlet Witch combination
    const thanosMatch = matches.find(match => match.symbolType === 'thanos');
    const witchMatch = matches.find(match => match.symbolType === 'scarlet_witch');

    if (thanosMatch && witchMatch) {
      const comboMultiplier = 1.5; // 50% bonus for villain combo

      interactions.push({
        type: 'villain_combo',
        symbols: ['thanos', 'scarlet_witch'],
        multiplier: comboMultiplier,
        message: 'VILLAIN COMBO! 50% BONUS!'
      });

      this.statistics.bonusFeaturesTriggered++;

      this.logAuditEvent('VILLAIN_COMBO_BONUS', {
        multiplier: comboMultiplier,
        thanos_cluster_size: thanosMatch.clusterSize,
        witch_cluster_size: witchMatch.clusterSize
      });
    }

    return {
      interactions,
      totalInteractions: interactions.length,
      totalMultiplier: interactions.reduce((total, interaction) => total * interaction.multiplier, 1)
    };
  }

  /**
     * Process end-of-spin bonus checks
     * @param {Object} spinResult - Complete spin result
     * @returns {Object} End-of-spin bonuses
     */
  processEndOfSpinBonuses(spinResult) {
    const bonuses = [];

    // Check for no-win consolation bonus (very rare)
    if (spinResult.totalWin === 0 && this.rng.random() < 0.001) { // 0.1% chance
      const consolationAmount = spinResult.betAmount * 0.1; // 10% of bet

      bonuses.push({
        type: 'consolation',
        amount: consolationAmount,
        message: 'CONSOLATION BONUS!'
      });

      this.logAuditEvent('CONSOLATION_BONUS', {
        bet_amount: spinResult.betAmount,
        consolation_amount: consolationAmount
      });
    }

    // Check for big win bonus effects
    const winMultiplier = spinResult.totalWin / spinResult.betAmount;
    if (winMultiplier >= 50) { // 50x or higher win
      bonuses.push({
        type: 'big_win_celebration',
        winMultiplier,
        message: 'BIG WIN CELEBRATION!'
      });
    }

    return {
      bonuses,
      totalBonuses: bonuses.length,
      additionalWin: bonuses.reduce((sum, bonus) => sum + (bonus.amount || 0), 0)
    };
  }

  /**
     * Simulate random bonus feature trigger (for testing/validation)
     * @param {number} iterations - Number of simulations
     * @returns {Object} Simulation results
     */
  simulateBonusFeatures(iterations = 10000) {
    let infinityPowerTriggers = 0;
    let cascadeBonuses = 0;
    let specialInteractions = 0;

    for (let i = 0; i < iterations; i++) {
      // Simulate Infinity Power (very rare, approximately 1 in 100,000)
      if (this.rng.random() < 0.00001) {
        infinityPowerTriggers++;
      }

      // Simulate cascade bonuses (more common with longer cascade chains)
      const simulatedCascades = this.rng.randomInt(1, 12);
      if (simulatedCascades >= 3) {
        cascadeBonuses++;
      }

      // Simulate special symbol interactions (moderate frequency)
      if (this.rng.random() < 0.05) { // 5% chance
        specialInteractions++;
      }
    }

    return {
      iterations,
      infinityPowerTriggers,
      cascadeBonuses,
      specialInteractions,
      rates: {
        infinityPower: ((infinityPowerTriggers / iterations) * 100).toFixed(4) + '%',
        cascadeBonuses: ((cascadeBonuses / iterations) * 100).toFixed(2) + '%',
        specialInteractions: ((specialInteractions / iterations) * 100).toFixed(2) + '%'
      }
    };
  }

  /**
     * Get comprehensive bonus features statistics
     * @returns {Object} Detailed statistics
     */
  getStatistics() {
    return {
      ...this.statistics,
      uptime: Date.now() - this.statistics.initialized,
      averageInfinityPowerWin: this.statistics.infinityPowerTriggers > 0 ?
        (this.statistics.totalInfinityPowerWins / this.statistics.infinityPowerTriggers) : 0,
      bonusFeatureRates: {
        infinityPowerTriggerRate: this.statistics.infinityPowerTriggers,
        cascadeBonusRate: this.statistics.cascadeBonusesAwarded,
        specialSymbolBonusRate: this.statistics.specialSymbolBonuses
      },
      efficiency: {
        bonusFeaturesPerTrigger: this.statistics.bonusFeaturesTriggered > 0 ?
          (this.statistics.infinityPowerTriggers + this.statistics.cascadeBonusesAwarded) /
                    this.statistics.bonusFeaturesTriggered : 0
      }
    };
  }

  /**
     * Validate bonus features engine integrity
     * @returns {Object} Validation result
     */
  validateIntegrity() {
    const hasValidInfinityPower = this.config.infinityPower.requiredSymbols.length > 0;
    const hasValidMultipliers = this.config.infinityPower.triggerMultiplier.every(m => m > 0);
    const hasValidCascadeBonuses = Object.values(this.config.cascadeBonuses.consecutiveCascadeMultipliers)
      .every(m => m >= 1);

    return {
      valid: hasValidInfinityPower && hasValidMultipliers && hasValidCascadeBonuses,
      checks: {
        validInfinityPower: hasValidInfinityPower,
        validMultipliers: hasValidMultipliers,
        validCascadeBonuses: hasValidCascadeBonuses,
        requiredSymbolsCount: this.config.infinityPower.requiredSymbols.length
      }
    };
  }

  /**
     * Reset statistics (for testing/maintenance)
     */
  resetStatistics() {
    this.statistics = {
      infinityPowerTriggers: 0,
      totalInfinityPowerWins: 0,
      largestInfinityPowerMultiplier: 0,
      specialSymbolBonuses: 0,
      cascadeBonusesAwarded: 0,
      longestCascadeChain: 0,
      bonusFeaturesTriggered: 0,
      initialized: Date.now()
    };

    this.logAuditEvent('STATISTICS_RESET', {});
  }

  /**
     * Update bonus feature configuration (for testing different settings)
     * @param {Object} newConfig - New configuration values
     */
  updateConfiguration(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    this.logAuditEvent('CONFIGURATION_UPDATED', {
      old_config: oldConfig,
      new_config: this.config,
      changed_keys: Object.keys(newConfig)
    });
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
      component: 'BonusFeatures',
      event,
      data
    });
  }
}

module.exports = BonusFeatures;