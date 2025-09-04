/**
 * Complete Server-Side Game Engine
 *
 * Task 4.2: Port game logic to server (XL)
 *
 * This is the main orchestrator that coordinates all game systems:
 * - Win calculation and payout logic
 * - Cascade processing and symbol management
 * - Multiplier engine for all multiplier types
 * - Free spins mode management
 * - Bonus feature implementations
 *
 * CRITICAL: This must generate identical results to client-only version
 * for seamless gameplay transition while maintaining 96.5% RTP.
 */

const WinCalculator = require('./winCalculator');
const CascadeProcessor = require('./cascadeProcessor');
const MultiplierEngine = require('./multiplierEngine');
const FreeSpinsEngine = require('./freeSpinsEngine');
const BonusFeatures = require('./bonusFeatures');
const { getRNG } = require('./rng');
const GridGenerator = require('./gridGenerator');

// Game configuration constants
const GAME_CONFIG = {
  GRID_COLS: 6,
  GRID_ROWS: 5,
  MIN_MATCH_COUNT: 8,
  CASCADE_SPEED: 300,
  RTP: 0.965,
  MAX_WIN_MULTIPLIER: 5000,

  // Symbol payout tables (identical to client GameConfig.js)
  SYMBOLS: {
    time_gem: { payouts: { 8: 8, 10: 15, 12: 40 }, type: 'low' },
    space_gem: { payouts: { 8: 9, 10: 18, 12: 80 }, type: 'low' },
    mind_gem: { payouts: { 8: 10, 10: 20, 12: 100 }, type: 'low' },
    power_gem: { payouts: { 8: 16, 10: 24, 12: 160 }, type: 'low' },
    reality_gem: { payouts: { 8: 20, 10: 30, 12: 200 }, type: 'low' },
    soul_gem: { payouts: { 8: 30, 10: 40, 12: 240 }, type: 'low' },
    thanos_weapon: { payouts: { 8: 40, 10: 100, 12: 300 }, type: 'high' },
    scarlet_witch: { payouts: { 8: 50, 10: 200, 12: 500 }, type: 'high' },
    thanos: { payouts: { 8: 200, 10: 500, 12: 1000 }, type: 'high' },
    infinity_glove: { payouts: { 4: 60, 5: 100, 6: 2000 }, type: 'scatter' }
  },

  // Symbol weights for 96.5% RTP
  SYMBOL_WEIGHTS: {
    time_gem: 26,
    space_gem: 26,
    mind_gem: 22,
    power_gem: 20,
    reality_gem: 20,
    soul_gem: 19,
    thanos_weapon: 17,
    scarlet_witch: 12,
    thanos: 11
  },

  SCATTER_CHANCE: 0.035,

  // Free spins configuration
  FREE_SPINS: {
    SCATTER_4_PLUS: 15,
    RETRIGGER_SPINS: 5,
    BUY_FEATURE_COST: 100,
    BUY_FEATURE_SPINS: 15,
    BASE_MULTIPLIER: 1,
    ACCUM_TRIGGER_CHANCE_PER_CASCADE: 0.35
  },

  // Random multiplier configuration
  RANDOM_MULTIPLIER: {
    TRIGGER_CHANCE: 0.4,
    MIN_WIN_REQUIRED: 0.01,
    ANIMATION_DURATION: 2000,
    TABLE: [].concat(
      Array(487).fill(2),
      Array(200).fill(3),
      Array(90).fill(4),
      Array(70).fill(5),
      Array(70).fill(6),
      Array(40).fill(8),
      Array(20).fill(10),
      Array(10).fill(20),
      Array(10).fill(100),
      Array(3).fill(500)
    )
  }
};

class GameEngine {
  constructor(options = {}) {
    // Initialize crypto RNG system
    this.rng = getRNG({ auditLogging: true });
    this.gridGenerator = new GridGenerator({ auditLogging: true });

    // Initialize all game systems
    this.winCalculator = new WinCalculator(GAME_CONFIG);
    this.cascadeProcessor = new CascadeProcessor(GAME_CONFIG, this.rng);
    this.multiplierEngine = new MultiplierEngine(GAME_CONFIG, this.rng);
    this.freeSpinsEngine = new FreeSpinsEngine(GAME_CONFIG, this.rng);
    this.bonusFeatures = new BonusFeatures(GAME_CONFIG, this.rng);

    // Game state tracking
    this.sessionStats = {
      totalSpins: 0,
      totalWins: 0,
      totalWon: 0,
      totalBet: 0,
      biggestWin: 0,
      currentSession: Date.now()
    };

    this.logAuditEvent('GAME_ENGINE_INITIALIZED', {
      systems_loaded: ['winCalculator', 'cascadeProcessor', 'multiplierEngine', 'freeSpinsEngine', 'bonusFeatures'],
      rtp_target: GAME_CONFIG.RTP,
      max_win_multiplier: GAME_CONFIG.MAX_WIN_MULTIPLIER
    });
  }

  /**
     * Process a complete spin with all cascades and features
     * This is the main entry point that coordinates all game logic
     * @param {Object} spinRequest - Complete spin request
     * @returns {Object} Complete spin result with all game data
     */
  async processCompleteSpin(spinRequest) {
    const {
      betAmount,
      playerId,
      sessionId,
      freeSpinsActive = false,
      freeSpinsRemaining = 0,
      accumulatedMultiplier = 1,
      quickSpinMode = false,
      spinId = this.generateSpinId()
    } = spinRequest;

    try {
      this.logAuditEvent('SPIN_PROCESSING_STARTED', {
        spin_id: spinId,
        player_id: playerId,
        session_id: sessionId,
        bet_amount: betAmount,
        free_spins_active: freeSpinsActive,
        accumulated_multiplier: accumulatedMultiplier
      });

      // Generate initial grid state
      const rngSeed = this.rng.generateSeed();
      const initialGridResult = this.gridGenerator.generateGrid({
        seed: rngSeed,
        freeSpinsMode: freeSpinsActive,
        accumulatedMultiplier: accumulatedMultiplier
      });

      let currentGrid = initialGridResult.grid;
      let totalWin = 0;
      const cascadeSteps = [];
      let cascadeCount = 0;

      // Initialize spin result structure
      const spinResult = {
        spinId,
        playerId,
        sessionId,
        betAmount,
        freeSpinsActive,
        freeSpinsRemaining,
        accumulatedMultiplier,
        initialGrid: this.cloneGrid(currentGrid),
        rngSeed,
        cascadeSteps: [],
        totalWin: 0,
        baseWin: 0,
        finalGrid: null,
        bonusFeatures: {
          freeSpinsTriggered: false,
          freeSpinsAwarded: 0,
          randomMultipliers: [],
          specialFeatures: []
        },
        timing: {
          spinStartTime: Date.now(),
          cascadeDuration: 0,
          totalDuration: 0
        },
        metadata: {
          quickSpinMode,
          rngAuditId: rngSeed
        }
      };

      // Process all cascading cycles
      while (true) {
        const matches = this.winCalculator.findConnectedMatches(currentGrid);

        if (matches.length === 0) {
          break; // No more matches, cascading complete
        }

        cascadeCount++;

        // Calculate wins for current cascade
        const cascadeWins = this.winCalculator.calculateCascadeWins(matches, betAmount);
        let cascadeWinTotal = cascadeWins.reduce((sum, win) => sum + win.payout, 0);

        // Apply free spins accumulated multiplier
        if (freeSpinsActive && accumulatedMultiplier > 1) {
          cascadeWinTotal *= accumulatedMultiplier;
        }

        totalWin += cascadeWinTotal;

        // Process symbol removal and dropping
        const cascadeResult = await this.cascadeProcessor.processCascade(
          currentGrid,
          matches,
          cascadeCount,
          quickSpinMode
        );

        // Store cascade step data
        const cascadeStep = {
          stepNumber: cascadeCount,
          gridStateBefore: this.cloneGrid(currentGrid),
          gridStateAfter: this.cloneGrid(cascadeResult.newGrid),
          matchedClusters: matches.map(match => ({
            symbolType: match.symbolType,
            positions: match.positions,
            clusterSize: match.positions.length,
            payout: cascadeWins.find(w => w.symbolType === match.symbolType)?.payout || 0
          })),
          cascadeWin: cascadeWinTotal,
          dropPatterns: cascadeResult.dropPatterns,
          timing: cascadeResult.timing
        };

        cascadeSteps.push(cascadeStep);

        // Process random multipliers during free spins cascades
        if (freeSpinsActive && cascadeCount > 1) {
          const cascadeMultiplierResult = await this.freeSpinsEngine.processCascadeMultiplier(
            cascadeCount,
            cascadeWinTotal,
            betAmount
          );

          if (cascadeMultiplierResult.triggered) {
            // Apply the multiplier to current cascade win
            const multipliedAmount = cascadeWinTotal * cascadeMultiplierResult.multiplier;
            totalWin += (multipliedAmount - cascadeWinTotal); // Add the difference

            cascadeStep.randomMultiplier = {
              multiplier: cascadeMultiplierResult.multiplier,
              position: cascadeMultiplierResult.position,
              character: cascadeMultiplierResult.character
            };

            spinResult.bonusFeatures.randomMultipliers.push(cascadeMultiplierResult);
          }
        }

        // Update grid for next cascade
        currentGrid = cascadeResult.newGrid;

        // Safety check to prevent infinite cascades
        if (cascadeCount >= 20) {
          this.logAuditEvent('CASCADE_LIMIT_REACHED', {
            spin_id: spinId,
            cascade_count: cascadeCount
          });
          break;
        }
      }

      // Check for scatter-triggered free spins on initial grid
      const scatterCount = this.countScatters(initialGridResult.grid);
      if (scatterCount >= 4) {
        const freeSpinsResult = this.freeSpinsEngine.triggerFreeSpins(scatterCount, freeSpinsActive);
        spinResult.bonusFeatures.freeSpinsTriggered = true;
        spinResult.bonusFeatures.freeSpinsAwarded = freeSpinsResult.spinsAwarded;

        // Add scatter payout
        const scatterPayout = this.winCalculator.calculateScatterPayout(scatterCount, betAmount);
        totalWin += scatterPayout;
      }

      // Process post-cascade random multipliers (base game)
      if (!freeSpinsActive && totalWin > GAME_CONFIG.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
        const randomMultiplierResult = await this.multiplierEngine.processRandomMultiplier(totalWin, betAmount);

        if (randomMultiplierResult.triggered) {
          totalWin *= randomMultiplierResult.multiplier;
          spinResult.bonusFeatures.randomMultipliers.push(randomMultiplierResult);
        }
      }

      // Apply win limits and rounding
      totalWin = this.applyWinLimits(totalWin, betAmount);
      const baseWin = freeSpinsActive ? totalWin / accumulatedMultiplier : totalWin;

      // Complete spin result
      spinResult.cascadeSteps = cascadeSteps;
      spinResult.totalWin = totalWin;
      spinResult.baseWin = baseWin;
      spinResult.finalGrid = currentGrid;
      spinResult.timing.cascadeDuration = cascadeSteps.reduce((sum, step) => sum + (step.timing?.totalDuration || 0), 0);
      spinResult.timing.totalDuration = spinResult.timing.cascadeDuration + 1000; // Buffer time

      // Update session statistics
      this.updateSessionStats(spinResult);

      this.logAuditEvent('SPIN_PROCESSING_COMPLETED', {
        spin_id: spinId,
        total_win: totalWin,
        cascade_count: cascadeCount,
        free_spins_triggered: spinResult.bonusFeatures.freeSpinsTriggered,
        random_multipliers: spinResult.bonusFeatures.randomMultipliers.length
      });

      return spinResult;

    } catch (error) {
      this.logAuditEvent('SPIN_PROCESSING_ERROR', {
        spin_id: spinId,
        error: error.message,
        stack: error.stack
      });

      throw new Error(`Spin processing failed: ${error.message}`);
    }
  }

  /**
     * Process free spins spin with accumulated multiplier handling
     * @param {Object} freeSpinRequest - Free spins specific request
     * @returns {Object} Free spins result
     */
  async processFreeSpinSpin(freeSpinRequest) {
    const {
      betAmount,
      playerId,
      sessionId,
      freeSpinsRemaining,
      accumulatedMultiplier,
      totalFreeSpinsWin = 0,
      spinId = this.generateSpinId()
    } = freeSpinRequest;

    // Process as regular spin but with free spins context
    const spinResult = await this.processCompleteSpin({
      ...freeSpinRequest,
      freeSpinsActive: true,
      accumulatedMultiplier,
      spinId
    });

    // Update free spins specific data
    spinResult.freeSpinsRemaining = Math.max(0, freeSpinsRemaining - 1);
    spinResult.totalFreeSpinsWin = totalFreeSpinsWin + spinResult.totalWin;
    spinResult.freeSpinsComplete = spinResult.freeSpinsRemaining === 0;

    // Handle multiplier accumulation during free spins
    const newAccumulatedMultiplier = await this.freeSpinsEngine.updateAccumulatedMultiplier(
      accumulatedMultiplier,
      spinResult.bonusFeatures.randomMultipliers
    );

    spinResult.newAccumulatedMultiplier = newAccumulatedMultiplier;

    return spinResult;
  }

  /**
     * Calculate RTP for session validation
     * @param {number} totalBet - Total amount bet
     * @param {number} totalWon - Total amount won
     * @returns {number} RTP percentage
     */
  calculateSessionRTP(totalBet, totalWon) {
    if (totalBet === 0) {return 0;}
    return (totalWon / totalBet) * 100;
  }

  /**
     * Validate game result against expected RTP ranges
     * @param {Object} spinResult - Spin result to validate
     * @returns {Object} Validation result
     */
  validateGameResult(spinResult) {
    const winMultiplier = spinResult.totalWin / spinResult.betAmount;
    const sessionRTP = this.calculateSessionRTP(this.sessionStats.totalBet, this.sessionStats.totalWon);

    // Check if win exceeds maximum
    const maxWin = spinResult.betAmount * GAME_CONFIG.MAX_WIN_MULTIPLIER;
    const winExceedsMax = spinResult.totalWin > maxWin;

    // Check RTP deviation (allow wider range for individual spins)
    const rtpTooHigh = sessionRTP > (GAME_CONFIG.RTP * 100) + 5; // 5% tolerance
    const rtpTooLow = sessionRTP < (GAME_CONFIG.RTP * 100) - 5;

    return {
      valid: !winExceedsMax && !rtpTooHigh && !rtpTooLow,
      winMultiplier,
      sessionRTP,
      maxWinExceeded: winExceedsMax,
      rtpDeviation: Math.abs(sessionRTP - (GAME_CONFIG.RTP * 100)),
      warnings: []
    };
  }

  /**
     * Get game engine statistics for monitoring
     * @returns {Object} Comprehensive statistics
     */
  getGameStatistics() {
    const rngStats = this.rng.getStatistics();
    const currentRTP = this.calculateSessionRTP(this.sessionStats.totalBet, this.sessionStats.totalWon);

    return {
      session: {
        ...this.sessionStats,
        currentRTP,
        rtpDeviation: Math.abs(currentRTP - (GAME_CONFIG.RTP * 100)),
        winRate: this.sessionStats.totalSpins > 0 ? (this.sessionStats.totalWins / this.sessionStats.totalSpins * 100) : 0,
        averageWin: this.sessionStats.totalWins > 0 ? (this.sessionStats.totalWon / this.sessionStats.totalWins) : 0
      },
      rng: rngStats,
      systems: {
        winCalculator: this.winCalculator.getStatistics(),
        multiplierEngine: this.multiplierEngine.getStatistics(),
        freeSpinsEngine: this.freeSpinsEngine.getStatistics(),
        bonusFeatures: this.bonusFeatures.getStatistics()
      },
      compliance: {
        targetRTP: GAME_CONFIG.RTP * 100,
        maxWinMultiplier: GAME_CONFIG.MAX_WIN_MULTIPLIER,
        auditTrailEnabled: true
      }
    };
  }

  /**
     * Utility methods
     */

  generateSpinId() {
    const timestamp = Date.now();
    const random = this.rng.uuid().substring(0, 8);
    return `spin_${timestamp}_${random}`;
  }

  cloneGrid(grid) {
    return grid.map(column => [...column]);
  }

  countScatters(grid) {
    let count = 0;
    for (let col = 0; col < GAME_CONFIG.GRID_COLS; col++) {
      for (let row = 0; row < GAME_CONFIG.GRID_ROWS; row++) {
        if (grid[col][row] === 'infinity_glove') {
          count++;
        }
      }
    }
    return count;
  }

  applyWinLimits(win, betAmount) {
    const maxWin = betAmount * GAME_CONFIG.MAX_WIN_MULTIPLIER;
    const limitedWin = Math.min(win, maxWin);
    return Math.round(limitedWin * 100) / 100; // Round to 2 decimal places
  }

  updateSessionStats(spinResult) {
    this.sessionStats.totalSpins++;
    this.sessionStats.totalBet += spinResult.betAmount;

    if (spinResult.totalWin > 0) {
      this.sessionStats.totalWins++;
      this.sessionStats.totalWon += spinResult.totalWin;
      this.sessionStats.biggestWin = Math.max(this.sessionStats.biggestWin, spinResult.totalWin);
    }
  }

  logAuditEvent(event, data = {}) {
    this.rng.emit('audit_event', {
      timestamp: Date.now(),
      component: 'GameEngine',
      event,
      data
    });
  }

  /**
     * Reset session statistics (for testing/new session)
     */
  resetSessionStats() {
    this.sessionStats = {
      totalSpins: 0,
      totalWins: 0,
      totalWon: 0,
      totalBet: 0,
      biggestWin: 0,
      currentSession: Date.now()
    };

    this.logAuditEvent('SESSION_STATS_RESET', {});
  }

  /**
     * Run comprehensive game engine validation
     * @returns {Object} Validation results
     */
  async validateGameEngine() {
    const validationResults = {
      rngCompliance: this.rng.validateCasinoCompliance(),
      systemIntegrity: {
        winCalculator: this.winCalculator.validateIntegrity(),
        multiplierEngine: this.multiplierEngine.validateIntegrity(),
        freeSpinsEngine: this.freeSpinsEngine.validateIntegrity(),
        bonusFeatures: this.bonusFeatures.validateIntegrity()
      },
      configuration: {
        rtpTarget: GAME_CONFIG.RTP,
        maxWinMultiplier: GAME_CONFIG.MAX_WIN_MULTIPLIER,
        symbolPayouts: Object.keys(GAME_CONFIG.SYMBOLS).length,
        randomMultiplierTable: GAME_CONFIG.RANDOM_MULTIPLIER.TABLE.length
      }
    };

    validationResults.overallValid = (
      validationResults.rngCompliance.overall_compliance &&
            Object.values(validationResults.systemIntegrity).every(result => result.valid)
    );

    this.logAuditEvent('GAME_ENGINE_VALIDATION', validationResults);

    return validationResults;
  }
}

module.exports = GameEngine;