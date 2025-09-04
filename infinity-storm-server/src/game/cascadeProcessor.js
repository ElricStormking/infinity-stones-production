/**
 * Server-Side Cascade Processor
 *
 * Task 4.2: Port Cascade Logic
 *
 * Handles symbol removal, dropping physics simulation, and new symbol generation
 * with identical timing and behavior to client GridManager cascade logic.
 *
 * CRITICAL: Must produce identical grid states and timing as client implementation.
 */

const { getRNG } = require('./rng');

class CascadeProcessor {
  constructor(gameConfig, rng = null) {
    this.gameConfig = gameConfig;
    this.rng = rng || getRNG();

    // Timing constants (identical to client GameConfig.js)
    this.timing = {
      SYMBOL_DROP_TIME: 200,
      SYMBOL_DESTROY_TIME: 300,
      CASCADE_SPEED: 300,
      DROP_DELAY_PER_ROW: 100,
      WIN_PRESENTATION_DELAY: 300
    };

    // Statistics tracking
    this.statistics = {
      cascadesProcessed: 0,
      symbolsRemoved: 0,
      symbolsGenerated: 0,
      averageCascadeDuration: 0,
      maxSymbolsInCascade: 0,
      initialized: Date.now()
    };

    this.logAuditEvent('CASCADE_PROCESSOR_INITIALIZED', {
      grid_dimensions: `${gameConfig.GRID_COLS}x${gameConfig.GRID_ROWS}`,
      cascade_speed: this.timing.CASCADE_SPEED,
      drop_delay_per_row: this.timing.DROP_DELAY_PER_ROW
    });
  }

  /**
     * Process a complete cascade: remove matched symbols, drop remaining symbols, generate new ones
     * @param {Array<Array<string>>} grid - Current grid state
     * @param {Array<Object>} matches - Matched clusters to remove
     * @param {number} cascadeNumber - Current cascade step number
     * @param {boolean} quickSpinMode - Quick spin mode enabled
     * @returns {Object} Cascade result with new grid, timing, and drop patterns
     */
  async processCascade(grid, matches, cascadeNumber, quickSpinMode = false) {
    const startTime = Date.now();

    this.logAuditEvent('CASCADE_PROCESSING_STARTED', {
      cascade_number: cascadeNumber,
      matches_count: matches.length,
      symbols_to_remove: matches.reduce((sum, match) => sum + match.positions.length, 0),
      quick_spin_mode: quickSpinMode
    });

    // Clone grid to avoid modifying original
    const newGrid = this.cloneGrid(grid);

    // Step 1: Remove matched symbols
    const removedPositions = this.removeMatchedSymbols(newGrid, matches);

    // Step 2: Calculate symbol drops and generate drop patterns
    const dropResult = this.calculateSymbolDrops(newGrid);

    // Step 3: Fill empty spaces with new symbols
    const fillResult = await this.fillEmptySpaces(newGrid, cascadeNumber);

    // Step 4: Calculate timing for all animations
    const timing = this.calculateCascadeTiming(
      removedPositions.length,
      dropResult.maxDropDistance,
      fillResult.newSymbolCount,
      quickSpinMode,
      cascadeNumber
    );

    // Update statistics
    this.updateCascadeStatistics(removedPositions.length, fillResult.newSymbolCount, timing.totalDuration);

    const endTime = Date.now();

    const cascadeResult = {
      newGrid,
      removedPositions,
      dropPatterns: dropResult.dropPatterns,
      newSymbols: fillResult.newSymbols,
      timing,
      metadata: {
        cascadeNumber,
        quickSpinMode,
        processingTime: endTime - startTime,
        symbolsRemoved: removedPositions.length,
        symbolsGenerated: fillResult.newSymbolCount
      }
    };

    this.logAuditEvent('CASCADE_PROCESSING_COMPLETED', {
      cascade_number: cascadeNumber,
      symbols_removed: removedPositions.length,
      symbols_generated: fillResult.newSymbolCount,
      processing_time_ms: endTime - startTime,
      total_animation_duration: timing.totalDuration
    });

    return cascadeResult;
  }

  /**
     * Remove matched symbols from grid
     * @param {Array<Array<string>>} grid - Grid to modify
     * @param {Array<Object>} matches - Matches to remove
     * @returns {Array<Object>} Array of removed positions
     */
  removeMatchedSymbols(grid, matches) {
    const removedPositions = [];

    for (const match of matches) {
      for (const position of match.positions) {
        const { col, row } = position;
        if (grid[col] && grid[col][row]) {
          removedPositions.push({
            col,
            row,
            symbolType: grid[col][row]
          });
          grid[col][row] = null;
        }
      }
    }

    this.logAuditEvent('SYMBOLS_REMOVED', {
      removed_count: removedPositions.length,
      positions: removedPositions.map(pos => `${pos.col},${pos.row}`)
    });

    return removedPositions;
  }

  /**
     * Calculate how symbols will drop after removal
     * @param {Array<Array<string>>} grid - Grid with removed symbols
     * @returns {Object} Drop calculation result
     */
  calculateSymbolDrops(grid) {
    const dropPatterns = [];
    let maxDropDistance = 0;

    // Process each column
    for (let col = 0; col < this.gameConfig.GRID_COLS; col++) {
      const columnDropPattern = {
        column: col,
        drops: [],
        maxDropInColumn: 0
      };

      const writeRow = this.gameConfig.GRID_ROWS - 1; // Start from bottom

      // Collect existing symbols from bottom to top
      const existingSymbols = [];
      for (let row = this.gameConfig.GRID_ROWS - 1; row >= 0; row--) {
        if (grid[col][row]) {
          existingSymbols.push({
            symbol: grid[col][row],
            originalRow: row
          });
          grid[col][row] = null; // Clear original position
        }
      }

      // Place symbols back from bottom up, calculating drops
      for (let i = 0; i < existingSymbols.length; i++) {
        const targetRow = writeRow - i;
        if (targetRow >= 0) {
          const symbolData = existingSymbols[i];
          grid[col][targetRow] = symbolData.symbol;

          // Track drop if symbol moved
          if (symbolData.originalRow !== targetRow) {
            const dropDistance = symbolData.originalRow - targetRow;
            columnDropPattern.drops.push({
              from: symbolData.originalRow,
              to: targetRow,
              symbol: symbolData.symbol,
              dropDistance,
              dropTime: this.calculateDropTime(dropDistance)
            });

            columnDropPattern.maxDropInColumn = Math.max(columnDropPattern.maxDropInColumn, dropDistance);
            maxDropDistance = Math.max(maxDropDistance, dropDistance);
          }
        }
      }

      // Only add pattern if there were drops in this column
      if (columnDropPattern.drops.length > 0) {
        dropPatterns.push(columnDropPattern);
      }
    }

    this.logAuditEvent('SYMBOL_DROPS_CALCULATED', {
      columns_with_drops: dropPatterns.length,
      max_drop_distance: maxDropDistance,
      total_drops: dropPatterns.reduce((sum, pattern) => sum + pattern.drops.length, 0)
    });

    return {
      dropPatterns,
      maxDropDistance
    };
  }

  /**
     * Fill empty spaces with new symbols
     * @param {Array<Array<string>>} grid - Grid to fill
     * @param {number} cascadeStep - Current cascade step for RNG seeding
     * @returns {Object} Fill result with new symbols data
     */
  async fillEmptySpaces(grid, cascadeStep) {
    const newSymbols = [];
    let newSymbolCount = 0;

    // Create seeded RNG for consistent results
    const cascadeRNG = this.rng.createSeededRNG(`cascade_${cascadeStep}_${Date.now()}`);

    // Fill from top to bottom to ensure proper cascading order
    for (let row = 0; row < this.gameConfig.GRID_ROWS; row++) {
      for (let col = 0; col < this.gameConfig.GRID_COLS; col++) {
        if (!grid[col][row]) {
          const newSymbol = this.getRandomSymbol(cascadeRNG);
          grid[col][row] = newSymbol;

          // Calculate how many empty rows are above this position
          let emptyRowsAbove = 0;
          for (let checkRow = row - 1; checkRow >= 0; checkRow--) {
            if (!grid[col][checkRow]) {
              emptyRowsAbove++;
            } else {
              break;
            }
          }

          // Calculate drop timing and start position
          const dropFromRow = -1 - emptyRowsAbove; // Start above grid
          const dropTime = this.calculateDropTime(Math.abs(dropFromRow - row));

          const newSymbolData = {
            position: { col, row },
            symbol: newSymbol,
            dropFromRow,
            dropTime,
            emptyRowsAbove,
            isNewSymbol: true
          };

          newSymbols.push(newSymbolData);
          newSymbolCount++;
        }
      }
    }

    this.logAuditEvent('EMPTY_SPACES_FILLED', {
      new_symbols_count: newSymbolCount,
      symbols_generated: newSymbols.map(s => `${s.position.col},${s.position.row}:${s.symbol}`)
    });

    return {
      newSymbols,
      newSymbolCount
    };
  }

  /**
     * Get random symbol using weighted distribution
     * @param {Function} rng - Random number generator function
     * @returns {string} Symbol type
     */
  getRandomSymbol(rng = null) {
    const randomFunc = rng || (() => this.rng.random());

    // Check for scatter symbols first
    if (randomFunc() < this.gameConfig.SCATTER_CHANCE) {
      return 'infinity_glove';
    }

    // Use weighted selection for regular symbols
    const weights = this.gameConfig.SYMBOL_WEIGHTS;
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const randomValue = randomFunc() * totalWeight;

    let currentWeight = 0;
    const symbols = Object.keys(weights);

    for (const symbol of symbols) {
      currentWeight += weights[symbol];
      if (randomValue <= currentWeight) {
        return symbol;
      }
    }

    // Fallback to last symbol
    return symbols[symbols.length - 1];
  }

  /**
     * Calculate drop time based on distance (gravity effect)
     * @param {number} dropDistance - Distance to drop in rows
     * @returns {number} Drop time in milliseconds
     */
  calculateDropTime(dropDistance) {
    return this.timing.CASCADE_SPEED + (dropDistance * this.timing.DROP_DELAY_PER_ROW);
  }

  /**
     * Calculate complete timing for cascade animation
     * @param {number} symbolsRemoved - Number of symbols removed
     * @param {number} maxDropDistance - Maximum drop distance
     * @param {number} newSymbolCount - Number of new symbols generated
     * @param {boolean} quickSpinMode - Quick spin mode enabled
     * @param {number} cascadeNumber - Current cascade number
     * @returns {Object} Complete timing information
     */
  calculateCascadeTiming(symbolsRemoved, maxDropDistance, newSymbolCount, quickSpinMode, cascadeNumber) {
    // Quick spin adjustments
    const quickSpinFactor = quickSpinMode ? 0.6 : 1.0;
    const minDuration = quickSpinMode ? 150 : 200;

    // Base timing calculations
    const baseDestroyDuration = this.timing.SYMBOL_DESTROY_TIME * quickSpinFactor;
    const baseDropDuration = this.timing.CASCADE_SPEED * quickSpinFactor;
    const dropDelayPerRow = this.timing.DROP_DELAY_PER_ROW * quickSpinFactor;
    const winPresentationDelay = this.timing.WIN_PRESENTATION_DELAY * quickSpinFactor;

    // Ensure minimum durations
    const destroyDuration = Math.max(minDuration * 0.8, baseDestroyDuration);
    const dropDuration = Math.max(minDuration, baseDropDuration);
    const maxDropTime = dropDuration + (maxDropDistance * dropDelayPerRow);

    // Calculate phase timings
    const phases = {
      symbolRemoval: {
        startTime: 0,
        duration: destroyDuration
      },
      symbolDrop: {
        startTime: destroyDuration,
        duration: maxDropTime
      },
      gridSettle: {
        startTime: destroyDuration + maxDropTime,
        duration: quickSpinMode ? 60 : 100
      },
      winPresentation: {
        startTime: destroyDuration + maxDropTime + (quickSpinMode ? 60 : 100),
        duration: winPresentationDelay
      }
    };

    // Calculate total duration
    const totalDuration = phases.winPresentation.startTime + phases.winPresentation.duration;

    return {
      // Basic timing (backward compatibility)
      destroyDuration,
      dropDuration,
      dropDelayPerRow,
      winPresentationDelay,
      totalDuration,

      // Enhanced timing data
      phases,
      maxDropTime,
      quickSpinActive: quickSpinMode,
      cascadeNumber,

      // Synchronization data
      serverTimestamp: Date.now(),
      expectedClientStartTime: 0, // Will be set by caller
      syncTolerance: quickSpinMode ? 50 : 100,

      // Animation metadata
      symbolsAffected: symbolsRemoved + newSymbolCount,
      maxDropDistance,
      animationComplexity: this.calculateAnimationComplexity(symbolsRemoved, maxDropDistance, newSymbolCount)
    };
  }

  /**
     * Calculate animation complexity score for performance optimization
     * @param {number} symbolsRemoved - Symbols removed
     * @param {number} maxDropDistance - Max drop distance
     * @param {number} newSymbolCount - New symbols generated
     * @returns {string} Complexity level
     */
  calculateAnimationComplexity(symbolsRemoved, maxDropDistance, newSymbolCount) {
    const complexityScore = (symbolsRemoved * 1) + (maxDropDistance * 2) + (newSymbolCount * 1);

    if (complexityScore < 10) {return 'low';}
    if (complexityScore < 25) {return 'medium';}
    if (complexityScore < 40) {return 'high';}
    return 'very_high';
  }

  /**
     * Create a deep clone of the grid
     * @param {Array<Array<string>>} grid - Grid to clone
     * @returns {Array<Array<string>>} Cloned grid
     */
  cloneGrid(grid) {
    return grid.map(column => [...column]);
  }

  /**
     * Update cascade processing statistics
     * @param {number} symbolsRemoved - Symbols removed
     * @param {number} symbolsGenerated - Symbols generated
     * @param {number} duration - Animation duration
     * @private
     */
  updateCascadeStatistics(symbolsRemoved, symbolsGenerated, duration) {
    this.statistics.cascadesProcessed++;
    this.statistics.symbolsRemoved += symbolsRemoved;
    this.statistics.symbolsGenerated += symbolsGenerated;
    this.statistics.maxSymbolsInCascade = Math.max(
      this.statistics.maxSymbolsInCascade,
      symbolsRemoved + symbolsGenerated
    );

    // Update average duration
    const totalPrevious = this.statistics.averageCascadeDuration * (this.statistics.cascadesProcessed - 1);
    this.statistics.averageCascadeDuration = (totalPrevious + duration) / this.statistics.cascadesProcessed;
  }

  /**
     * Get cascade processor statistics
     * @returns {Object} Statistics object
     */
  getStatistics() {
    return {
      ...this.statistics,
      uptime: Date.now() - this.statistics.initialized,
      averageSymbolsPerCascade: this.statistics.cascadesProcessed > 0 ?
        (this.statistics.symbolsRemoved + this.statistics.symbolsGenerated) / this.statistics.cascadesProcessed : 0
    };
  }

  /**
     * Validate cascade processor integrity
     * @returns {Object} Validation result
     */
  validateIntegrity() {
    const hasValidTiming = this.timing.CASCADE_SPEED > 0;
    const hasValidGridSize = this.gameConfig.GRID_COLS > 0 && this.gameConfig.GRID_ROWS > 0;
    const hasSymbolWeights = Object.keys(this.gameConfig.SYMBOL_WEIGHTS).length > 0;

    return {
      valid: hasValidTiming && hasValidGridSize && hasSymbolWeights,
      checks: {
        validTiming: hasValidTiming,
        validGridSize: hasValidGridSize,
        hasSymbolWeights: hasSymbolWeights
      }
    };
  }

  /**
     * Reset statistics (for testing/maintenance)
     */
  resetStatistics() {
    this.statistics = {
      cascadesProcessed: 0,
      symbolsRemoved: 0,
      symbolsGenerated: 0,
      averageCascadeDuration: 0,
      maxSymbolsInCascade: 0,
      initialized: Date.now()
    };

    this.logAuditEvent('STATISTICS_RESET', {});
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
      component: 'CascadeProcessor',
      event,
      data
    });
  }
}

module.exports = CascadeProcessor;