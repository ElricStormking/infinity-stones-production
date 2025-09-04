/**
 * Server-Side Win Calculator
 *
 * Task 4.2: Port WinCalculator Logic
 *
 * Ports the complete win calculation logic from client WinCalculator.js
 * including flood-fill cluster detection, payout calculation, and win validation.
 *
 * CRITICAL: Must generate identical results to client version for seamless gameplay.
 */

const { getRNG } = require('./rng');

class WinCalculator {
  constructor(gameConfig) {
    this.gameConfig = gameConfig;
    this.rng = getRNG();

    // Win categories for presentation
    this.winCategories = {
      SMALL: { min: 0, max: 10, name: 'Small Win' },
      MEDIUM: { min: 10, max: 50, name: 'Medium Win' },
      BIG: { min: 50, max: 100, name: 'Big Win' },
      MEGA: { min: 100, max: 250, name: 'Mega Win' },
      EPIC: { min: 250, max: 500, name: 'Epic Win' },
      LEGENDARY: { min: 500, max: Infinity, name: 'Legendary Win' }
    };

    // Statistics tracking
    this.statistics = {
      totalWinsCalculated: 0,
      totalPayoutCalculated: 0,
      clusterMatches: 0,
      scatterMatches: 0,
      averageWinMultiplier: 0,
      largestCluster: 0,
      initialized: Date.now()
    };

    this.logAuditEvent('WIN_CALCULATOR_INITIALIZED', {
      min_match_count: gameConfig.MIN_MATCH_COUNT,
      symbol_count: Object.keys(gameConfig.SYMBOLS).length,
      max_win_multiplier: gameConfig.MAX_WIN_MULTIPLIER
    });
  }

  /**
     * Find all connected clusters using flood-fill algorithm (identical to client)
     * @param {Array<Array<string>>} grid - 6x5 grid of symbol types
     * @returns {Array<Object>} Array of match objects with connected clusters
     */
  findConnectedMatches(grid) {
    const matches = [];
    const visited = new Set();

    // Iterate through each position in the grid
    for (let col = 0; col < this.gameConfig.GRID_COLS; col++) {
      for (let row = 0; row < this.gameConfig.GRID_ROWS; row++) {
        const positionKey = `${col},${row}`;

        // Skip if already visited or empty
        if (visited.has(positionKey) || !grid[col][row]) {
          continue;
        }

        const symbol = grid[col][row];

        // Skip scatter symbols for cluster matching
        if (symbol === 'infinity_glove') {
          continue;
        }

        // Find all connected symbols of the same type using flood-fill
        const cluster = this.floodFillCluster(grid, col, row, symbol, visited);

        // Only create match if cluster meets minimum size requirement
        if (cluster.length >= this.gameConfig.MIN_MATCH_COUNT) {
          matches.push({
            symbolType: symbol,
            positions: cluster,
            clusterSize: cluster.length
          });

          this.statistics.clusterMatches++;
          this.statistics.largestCluster = Math.max(this.statistics.largestCluster, cluster.length);
        }
      }
    }

    this.logAuditEvent('MATCHES_FOUND', {
      match_count: matches.length,
      total_symbols_matched: matches.reduce((sum, match) => sum + match.clusterSize, 0)
    });

    return matches;
  }

  /**
     * Flood-fill algorithm to find all connected symbols of the same type
     * @param {Array<Array<string>>} grid - Game grid
     * @param {number} startCol - Starting column
     * @param {number} startRow - Starting row
     * @param {string} targetSymbol - Symbol type to match
     * @param {Set} visited - Set of already visited positions
     * @returns {Array<Object>} Array of connected positions
     */
  floodFillCluster(grid, startCol, startRow, targetSymbol, visited) {
    const cluster = [];
    const queue = [{ col: startCol, row: startRow }];
    const localVisited = new Set();

    while (queue.length > 0) {
      const { col, row } = queue.shift();
      const positionKey = `${col},${row}`;

      // Skip if out of bounds or already processed
      if (col < 0 || col >= this.gameConfig.GRID_COLS ||
                row < 0 || row >= this.gameConfig.GRID_ROWS ||
                localVisited.has(positionKey)) {
        continue;
      }

      // Skip if symbol doesn't match target
      if (grid[col][row] !== targetSymbol) {
        continue;
      }

      // Mark as visited and add to cluster
      localVisited.add(positionKey);
      visited.add(positionKey);
      cluster.push({ col, row });

      // Add adjacent positions to queue (4-directional connectivity)
      queue.push(
        { col: col - 1, row }, // Left
        { col: col + 1, row }, // Right
        { col, row: row - 1 }, // Up
        { col, row: row + 1 }  // Down
      );
    }

    return cluster;
  }

  /**
     * Calculate payout for a single match cluster
     * @param {Object} match - Match object with symbolType and positions
     * @param {number} betAmount - Current bet amount
     * @returns {Object} Win object with payout details
     */
  calculateMatchWin(match, betAmount) {
    const { symbolType, positions, clusterSize } = match;
    const symbolInfo = this.gameConfig.SYMBOLS[symbolType];

    if (!symbolInfo || !symbolInfo.payouts) {
      this.logAuditEvent('INVALID_SYMBOL_WIN_CALCULATION', {
        symbol_type: symbolType,
        cluster_size: clusterSize
      });
      return { payout: 0, multiplier: 1 };
    }

    // Get the appropriate payout multiplier based on cluster size
    let payoutMultiplier = 0;

    if (symbolInfo.type === 'scatter') {
      // Scatter symbols use exact match counts
      payoutMultiplier = symbolInfo.payouts[clusterSize] || 0;
    } else {
      // Regular symbols use tiered system (identical to client)
      if (clusterSize >= 12) {
        payoutMultiplier = symbolInfo.payouts[12];
      } else if (clusterSize >= 10) {
        payoutMultiplier = symbolInfo.payouts[10];
      } else if (clusterSize >= 8) {
        payoutMultiplier = symbolInfo.payouts[8];
      }
    }

    if (payoutMultiplier === 0) {
      return { payout: 0, multiplier: 1 };
    }

    // Base win calculation: (Bet Amount / 20) * Symbol Payout Multiplier
    // This formula is identical to client implementation
    const baseWin = (betAmount / 20) * payoutMultiplier;

    // Get highest symbol multiplier in the match (from special symbols)
    const symbolMultiplier = this.getHighestSymbolMultiplier(match);

    // Calculate total win
    const totalWin = baseWin * symbolMultiplier;
    const validatedWin = this.validateWin(totalWin, betAmount);

    this.logAuditEvent('MATCH_WIN_CALCULATED', {
      symbol_type: symbolType,
      cluster_size: clusterSize,
      payout_multiplier: payoutMultiplier,
      base_win: baseWin,
      symbol_multiplier: symbolMultiplier,
      total_win: validatedWin
    });

    return {
      symbolType,
      positions,
      clusterSize,
      payout: validatedWin,
      multiplier: symbolMultiplier,
      payoutMultiplier,
      baseWin
    };
  }

  /**
     * Calculate wins for all matches in a cascade
     * @param {Array<Object>} matches - Array of match objects
     * @param {number} betAmount - Current bet amount
     * @returns {Array<Object>} Array of win objects
     */
  calculateCascadeWins(matches, betAmount) {
    const wins = [];
    let totalCascadeWin = 0;

    for (const match of matches) {
      const win = this.calculateMatchWin(match, betAmount);
      if (win.payout > 0) {
        wins.push(win);
        totalCascadeWin += win.payout;
      }
    }

    // Update statistics
    this.statistics.totalWinsCalculated += wins.length;
    this.statistics.totalPayoutCalculated += totalCascadeWin;
    if (wins.length > 0) {
      this.statistics.averageWinMultiplier =
                (this.statistics.averageWinMultiplier * (this.statistics.totalWinsCalculated - wins.length) +
                 (totalCascadeWin / betAmount)) / this.statistics.totalWinsCalculated;
    }

    this.logAuditEvent('CASCADE_WINS_CALCULATED', {
      match_count: matches.length,
      win_count: wins.length,
      total_cascade_win: totalCascadeWin,
      win_multiplier: totalCascadeWin / betAmount
    });

    return wins;
  }

  /**
     * Calculate scatter symbol payouts (separate from cluster logic)
     * @param {number} scatterCount - Number of scatter symbols
     * @param {number} betAmount - Current bet amount
     * @returns {number} Scatter payout amount
     */
  calculateScatterPayout(scatterCount, betAmount) {
    const scatterInfo = this.gameConfig.SYMBOLS.infinity_glove;

    if (!scatterInfo || !scatterInfo.payouts || scatterCount < 4) {
      return 0;
    }

    const payoutMultiplier = scatterInfo.payouts[scatterCount] || 0;

    if (payoutMultiplier === 0) {
      return 0;
    }

    // Scatter payout calculation (same formula as regular symbols)
    const scatterPayout = this.validateWin((betAmount / 20) * payoutMultiplier, betAmount);

    this.statistics.scatterMatches++;

    this.logAuditEvent('SCATTER_PAYOUT_CALCULATED', {
      scatter_count: scatterCount,
      payout_multiplier: payoutMultiplier,
      scatter_payout: scatterPayout
    });

    return scatterPayout;
  }

  /**
     * Get the highest symbol multiplier from a match (for special symbols)
     * Currently returns 1 as base implementation, can be extended for symbol multipliers
     * @param {Object} match - Match object
     * @returns {number} Highest multiplier value
     */
  getHighestSymbolMultiplier(match) {
    // Base implementation - can be extended if symbols have individual multipliers
    // This would integrate with special symbol multipliers if implemented
    return 1;
  }

  /**
     * Validate and cap win amounts according to game rules
     * @param {number} win - Raw win amount
     * @param {number} betAmount - Current bet amount
     * @returns {number} Validated and capped win amount
     */
  validateWin(win, betAmount) {
    // Ensure win is not negative
    if (win < 0) {return 0;}

    // Cap win at max win multiplier
    const maxWin = betAmount * this.gameConfig.MAX_WIN_MULTIPLIER;
    if (win > maxWin) {
      this.logAuditEvent('WIN_CAPPED_AT_MAX', {
        original_win: win,
        capped_win: maxWin,
        max_multiplier: this.gameConfig.MAX_WIN_MULTIPLIER
      });
      win = maxWin;
    }

    // Round to 2 decimal places
    return Math.round(win * 100) / 100;
  }

  /**
     * Determine win category for presentation purposes
     * @param {number} win - Win amount
     * @param {number} betAmount - Bet amount
     * @returns {Object|null} Win category object
     */
  getWinCategory(win, betAmount) {
    if (win <= 0) {return null;}

    const winMultiplier = win / betAmount;

    for (const [key, category] of Object.entries(this.winCategories)) {
      if (winMultiplier >= category.min && winMultiplier < category.max) {
        return {
          key,
          name: category.name,
          multiplier: winMultiplier
        };
      }
    }

    return null;
  }

  /**
     * Calculate total win across multiple cascades with multipliers
     * @param {Array<Array<Object>>} allCascadeWins - Array of win arrays from each cascade
     * @param {number} betAmount - Bet amount
     * @param {number} freeSpinsMultiplier - Free spins accumulated multiplier
     * @returns {Object} Complete win calculation result
     */
  calculateTotalWin(allCascadeWins, betAmount, freeSpinsMultiplier = 1) {
    let totalWin = 0;
    let totalMatches = 0;
    const winBreakdown = [];

    allCascadeWins.forEach((cascadeWins, cascadeIndex) => {
      let cascadeTotal = cascadeWins.reduce((sum, win) => sum + win.payout, 0);

      // Apply free spins multiplier
      if (freeSpinsMultiplier > 1) {
        cascadeTotal *= freeSpinsMultiplier;
      }

      totalWin += cascadeTotal;
      totalMatches += cascadeWins.length;

      winBreakdown.push({
        cascadeIndex,
        wins: cascadeWins,
        cascadeTotal,
        multiplier: freeSpinsMultiplier
      });
    });

    // Validate final total win
    const validatedTotalWin = this.validateWin(totalWin, betAmount);
    const winCategory = this.getWinCategory(validatedTotalWin, betAmount);

    const result = {
      totalWin: validatedTotalWin,
      baseWin: validatedTotalWin / freeSpinsMultiplier,
      totalMatches,
      cascadeCount: allCascadeWins.length,
      winMultiplier: validatedTotalWin / betAmount,
      winCategory,
      winBreakdown,
      freeSpinsMultiplier
    };

    this.logAuditEvent('TOTAL_WIN_CALCULATED', {
      total_win: validatedTotalWin,
      base_win: result.baseWin,
      cascade_count: allCascadeWins.length,
      total_matches: totalMatches,
      win_multiplier: result.winMultiplier,
      win_category: winCategory?.key || 'none'
    });

    return result;
  }

  /**
     * Simulate win probability based on current statistics
     * @param {number} betAmount - Bet amount to simulate
     * @param {number} simulations - Number of simulations to run
     * @returns {Object} Win probability simulation results
     */
  simulateWinProbability(betAmount, simulations = 1000) {
    const currentRTP = this.statistics.totalPayoutCalculated /
                          (this.statistics.totalWinsCalculated * betAmount) || this.gameConfig.RTP;
    const estimatedWinRate = 0.25; // Estimated 25% win rate

    let wins = 0;
    let totalPayout = 0;

    for (let i = 0; i < simulations; i++) {
      if (this.rng.random() < estimatedWinRate) {
        wins++;
        // Simulate win amount based on RTP
        const avgWinMultiplier = currentRTP / estimatedWinRate;
        const winAmount = betAmount * avgWinMultiplier * (0.5 + this.rng.random() * 1.5);
        totalPayout += winAmount;
      }
    }

    return {
      winProbability: (wins / simulations * 100).toFixed(1),
      expectedReturn: (totalPayout / (betAmount * simulations) * 100).toFixed(1),
      averageWinAmount: wins > 0 ? (totalPayout / wins).toFixed(2) : 0,
      simulationCount: simulations
    };
  }

  /**
     * Get win calculator statistics
     * @returns {Object} Statistics object
     */
  getStatistics() {
    return {
      ...this.statistics,
      uptime: Date.now() - this.statistics.initialized,
      averagePayoutPerWin: this.statistics.totalWinsCalculated > 0 ?
        (this.statistics.totalPayoutCalculated / this.statistics.totalWinsCalculated) : 0
    };
  }

  /**
     * Validate win calculator integrity
     * @returns {Object} Validation result
     */
  validateIntegrity() {
    const symbolCount = Object.keys(this.gameConfig.SYMBOLS).length;
    const hasMinMatchCount = this.gameConfig.MIN_MATCH_COUNT >= 8;
    const hasMaxWinMultiplier = this.gameConfig.MAX_WIN_MULTIPLIER > 0;
    const hasValidSymbols = symbolCount > 0;

    return {
      valid: hasMinMatchCount && hasMaxWinMultiplier && hasValidSymbols,
      checks: {
        minMatchCount: hasMinMatchCount,
        maxWinMultiplier: hasMaxWinMultiplier,
        validSymbols: hasValidSymbols,
        symbolCount
      }
    };
  }

  /**
     * Reset statistics (for testing/maintenance)
     */
  resetStatistics() {
    this.statistics = {
      totalWinsCalculated: 0,
      totalPayoutCalculated: 0,
      clusterMatches: 0,
      scatterMatches: 0,
      averageWinMultiplier: 0,
      largestCluster: 0,
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
      component: 'WinCalculator',
      event,
      data
    });
  }
}

module.exports = WinCalculator;