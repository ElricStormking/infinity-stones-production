/**
 * RTP Simulator Service
 * 
 * Runs large-scale spin simulations with custom configurations to calculate RTP.
 * Supports 50k, 100k, and 1M spin tests with real-time progress tracking.
 */

const GameEngine = require('../game/gameEngine');
const { logger } = require('../utils/logger');

class RTPSimulator {
  constructor() {
    this.activeSimulations = new Map();
  }

  /**
   * Run RTP simulation with custom configuration
   * @param {Object} options - Simulation options
   * @returns {Promise<Object>} Simulation results
   */
  async runSimulation(options) {
    const {
      symbolWeights,
      scatterChance,
      multiplierTable,
      spinCount = 100000,
      betAmount = 1.0,
      simulationId = this.generateSimulationId(),
      progressCallback = null
    } = options;

    // Create custom game config
    const customConfig = this.createCustomConfig({
      symbolWeights,
      scatterChance,
      multiplierTable
    });

    // Create game engine with custom config
    const gameEngine = new GameEngine();
    gameEngine.gameConfig = customConfig;
    
    // Reinitialize with new config
    const GridGenerator = require('../game/gridGenerator');
    const MultiplierEngine = require('../game/multiplierEngine');
    const FreeSpinsEngine = require('../game/freeSpinsEngine');
    const SymbolDistribution = require('../game/symbolDistribution');
    
    // Create GridGenerator and update its symbol distribution with custom scatter chance
    gameEngine.gridGenerator = new GridGenerator({
      auditLogging: false // Disable audit logging for faster simulation
    });
    
    // Update symbol weights in SymbolDistribution
    if (customConfig.SYMBOL_WEIGHTS) {
      Object.entries(customConfig.SYMBOL_WEIGHTS).forEach(([symbol, weight]) => {
        gameEngine.gridGenerator.symbolDistribution.baseWeights[symbol] = weight;
      });
    }
    
    // Update scatter chance in SymbolDistribution
    if (customConfig.SCATTER_CHANCE !== undefined) {
      gameEngine.gridGenerator.symbolDistribution.scatterChance.base_game = customConfig.SCATTER_CHANCE;
      gameEngine.gridGenerator.symbolDistribution.scatterChance.free_spins = customConfig.SCATTER_CHANCE;
    }
    
    gameEngine.multiplierEngine = new MultiplierEngine(customConfig);
    gameEngine.freeSpinsEngine = new FreeSpinsEngine(customConfig);

    // Initialize statistics
    const stats = this.createStatistics();
    const startTime = Date.now();

    // Mark simulation as active
    this.activeSimulations.set(simulationId, {
      startTime,
      spinCount,
      completed: 0,
      stats
    });

    try {
      logger.info(`Starting RTP simulation: ${simulationId}`, {
        spinCount,
        symbolWeights,
        scatterChance
      });

      // Run spins
      for (let i = 0; i < spinCount; i++) {
        const spinResult = await gameEngine.processCompleteSpin({
          betAmount,
          freeSpinsActive: false,
          accumulatedMultiplier: 1.0,
          quickSpinMode: true
        });

        // Record spin statistics
        this.recordSpin(stats, spinResult, betAmount);

        // Check if free spins were triggered - if so, play them
        if (spinResult.bonusFeatures && spinResult.bonusFeatures.freeSpinsTriggered) {
          const freeSpinsAwarded = spinResult.bonusFeatures.freeSpinsAwarded || 0;
          let freeSpinsRemaining = freeSpinsAwarded;
          let accumulatedMultiplier = customConfig.FREE_SPINS.BASE_MULTIPLIER || 1;

          // Play all awarded free spins
          while (freeSpinsRemaining > 0) {
            const freeSpinResult = await gameEngine.processCompleteSpin({
              betAmount,
              freeSpinsActive: true,
              freeSpinsRemaining,
              accumulatedMultiplier,
              quickSpinMode: true
            });

            // Record free spin statistics
            this.recordSpin(stats, freeSpinResult, betAmount);
            stats.freeSpinsCompleted++;

            // Update accumulated multiplier if new multipliers were added
            if (freeSpinResult.newAccumulatedMultiplier !== undefined) {
              accumulatedMultiplier = freeSpinResult.newAccumulatedMultiplier;
            }

            // Check for retrigger
            if (freeSpinResult.bonusFeatures && freeSpinResult.bonusFeatures.freeSpinsRetriggered) {
              const retriggeredSpins = freeSpinResult.bonusFeatures.freeSpinsAwarded || 0;
              freeSpinsRemaining += retriggeredSpins;
              stats.freeSpinsRetriggered++;
              stats.totalFreeSpinsAwarded += retriggeredSpins;
            }

            freeSpinsRemaining--;
          }
        }

        // Progress callback every 1000 spins
        if (progressCallback && (i + 1) % 1000 === 0) {
          const progress = {
            simulationId,
            spinsCompleted: i + 1,
            totalSpins: spinCount,
            currentRTP: this.calculateRTP(stats),
            elapsedTime: Date.now() - startTime,
            estimatedTimeRemaining: this.estimateTimeRemaining(
              i + 1,
              spinCount,
              Date.now() - startTime
            )
          };
          progressCallback(progress);
        }
      }

      // Calculate final statistics
      const endTime = Date.now();
      const results = this.generateResults(stats, spinCount, endTime - startTime);

      // Remove from active simulations
      this.activeSimulations.delete(simulationId);

      logger.info(`Simulation completed: ${simulationId}`, {
        finalRTP: results.overallRTP,
        duration: results.duration
      });

      return results;

    } catch (error) {
      logger.error('Simulation error', {
        simulationId,
        error: error.message,
        stack: error.stack
      });
      this.activeSimulations.delete(simulationId);
      throw error;
    }
  }

  /**
   * Create custom game configuration
   */
  createCustomConfig({ symbolWeights, scatterChance, multiplierTable, freeSpinsConfig }) {
    const GameEngine = require('../game/gameEngine');
    const baseConfig = require('../game/gameEngine').GAME_CONFIG || GameEngine.prototype.gameConfig;

    return {
      ...baseConfig,
      SYMBOL_WEIGHTS: symbolWeights || baseConfig.SYMBOL_WEIGHTS,
      SCATTER_CHANCE: scatterChance !== undefined ? scatterChance : baseConfig.SCATTER_CHANCE,
      RANDOM_MULTIPLIER: {
        ...baseConfig.RANDOM_MULTIPLIER,
        WEIGHTED_TABLE: multiplierTable || baseConfig.RANDOM_MULTIPLIER.WEIGHTED_TABLE
      },
      FREE_SPINS: freeSpinsConfig ? {
        ...baseConfig.FREE_SPINS,
        ...freeSpinsConfig
      } : baseConfig.FREE_SPINS
    };
  }

  /**
   * Initialize statistics tracking
   */
  createStatistics() {
    return {
      totalSpins: 0,
      totalWagered: 0,
      totalWon: 0,
      winningSpins: 0,
      losingSpins: 0,
      largestWin: 0,
      largestWinMultiplier: 0,
      
      // Win categories
      winsByCategory: {
        small: 0,      // 1x-5x
        medium: 0,     // 5x-10x
        big: 0,        // 10x-25x
        mega: 0,       // 25x-50x
        epic: 0,       // 50x-100x
        legendary: 0   // 100x+
      },

      // Cascade stats
      totalCascades: 0,
      cascadesByDepth: {},
      maxCascadeDepth: 0,

      // Symbol appearance tracking
      symbolAppearances: {},

      // Multiplier stats
      multipliersTriggered: 0,
      multiplierDistribution: {},
      totalMultiplierValue: 0,

      // Scatter stats
      scatterTriggers: 0,
      scatterCountDistribution: {},

      // Free spins stats
      freeSpinsTriggered: 0,
      totalFreeSpinsAwarded: 0,
      freeSpinsCompleted: 0,
      freeSpinsRetriggered: 0,
      buyFeatureUsed: 0,
      
      // Separate tracking for base game vs free spins mode
      baseGame: {
        spins: 0,
        wagered: 0,
        won: 0,
        winningSpins: 0
      },
      freeSpinsMode: {
        spins: 0,
        wagered: 0,
        won: 0,
        winningSpins: 0,
        averageMultiplier: 0,
        totalMultiplier: 0
      }
    };
  }

  /**
   * Record individual spin statistics
   */
  recordSpin(stats, spinResult, betAmount) {
    stats.totalSpins++;
    stats.totalWagered += betAmount;
    stats.totalWon += spinResult.totalWin || 0;

    // Track base game vs free spins separately
    const isFreeSpins = spinResult.freeSpinsActive || false;
    if (isFreeSpins) {
      stats.freeSpinsMode.spins++;
      stats.freeSpinsMode.wagered += betAmount;
      stats.freeSpinsMode.won += spinResult.totalWin || 0;
      if (spinResult.totalWin > 0) {
        stats.freeSpinsMode.winningSpins++;
      }
      // Track multiplier in free spins (always track, even if it's 1)
      const multiplier = spinResult.accumulatedMultiplier || 1;
      stats.freeSpinsMode.totalMultiplier += multiplier;
    } else {
      stats.baseGame.spins++;
      stats.baseGame.wagered += betAmount;
      stats.baseGame.won += spinResult.totalWin || 0;
      if (spinResult.totalWin > 0) {
        stats.baseGame.winningSpins++;
      }
    }

    // Track free spins triggers
    if (spinResult.bonusFeatures && spinResult.bonusFeatures.freeSpinsTriggered) {
      stats.freeSpinsTriggered++;
      stats.totalFreeSpinsAwarded += spinResult.bonusFeatures.freeSpinsAwarded || 0;
    }

    if (spinResult.totalWin > 0) {
      stats.winningSpins++;
      
      const multiplier = spinResult.totalWin / betAmount;
      
      // Categorize win
      if (multiplier >= 100) stats.winsByCategory.legendary++;
      else if (multiplier >= 50) stats.winsByCategory.epic++;
      else if (multiplier >= 25) stats.winsByCategory.mega++;
      else if (multiplier >= 10) stats.winsByCategory.big++;
      else if (multiplier >= 5) stats.winsByCategory.medium++;
      else stats.winsByCategory.small++;

      // Track largest win
      if (spinResult.totalWin > stats.largestWin) {
        stats.largestWin = spinResult.totalWin;
        stats.largestWinMultiplier = multiplier;
      }
    } else {
      stats.losingSpins++;
    }

    // Cascade stats
    const cascadeCount = spinResult.cascadeSteps?.length || 0;
    stats.totalCascades += cascadeCount;
    stats.cascadesByDepth[cascadeCount] = (stats.cascadesByDepth[cascadeCount] || 0) + 1;
    if (cascadeCount > stats.maxCascadeDepth) {
      stats.maxCascadeDepth = cascadeCount;
    }

    // Symbol appearances (including scatter symbols)
    if (spinResult.initialGrid) {
      let scatterCount = 0;
      spinResult.initialGrid.forEach(row => {
        row.forEach(symbol => {
          stats.symbolAppearances[symbol] = (stats.symbolAppearances[symbol] || 0) + 1;
          if (symbol === 'infinity_glove') {
            scatterCount++;
          }
        });
      });
      
      // Track scatter statistics
      if (scatterCount >= 4) {
        stats.scatterTriggers++;
      }
      if (scatterCount > 0) {
        stats.scatterCountDistribution[scatterCount] = 
          (stats.scatterCountDistribution[scatterCount] || 0) + 1;
      }
    }

    // Multiplier stats - extract from multiplierAwarded.events
    if (spinResult.multiplierAwarded && spinResult.multiplierAwarded.events) {
      spinResult.multiplierAwarded.events.forEach(event => {
        if (event.multipliers && Array.isArray(event.multipliers)) {
          event.multipliers.forEach(mult => {
            stats.multipliersTriggered++;
            const multValue = mult.multiplier || mult.value || 2;
            stats.multiplierDistribution[multValue] = (stats.multiplierDistribution[multValue] || 0) + 1;
            stats.totalMultiplierValue += multValue;
          });
        }
      });
    }
  }

  /**
   * Calculate current RTP percentage
   */
  calculateRTP(stats) {
    if (stats.totalWagered === 0) return 0;
    return (stats.totalWon / stats.totalWagered) * 100;
  }

  /**
   * Estimate remaining time
   */
  estimateTimeRemaining(completed, total, elapsed) {
    if (completed === 0) return 0;
    const avgTimePerSpin = elapsed / completed;
    const remaining = total - completed;
    return Math.round(avgTimePerSpin * remaining);
  }

  /**
   * Generate final results report
   */
  generateResults(stats, totalSpins, duration) {
    const rtp = this.calculateRTP(stats);
    const winFrequency = (stats.winningSpins / stats.totalSpins) * 100;
    const avgWin = stats.winningSpins > 0 ? stats.totalWon / stats.winningSpins : 0;
    const avgCascadeDepth = stats.totalSpins > 0 ? stats.totalCascades / stats.totalSpins : 0;
    const avgMultiplier = stats.multipliersTriggered > 0 ? 
      stats.totalMultiplierValue / stats.multipliersTriggered : 0;

    // Calculate symbol probabilities
    const totalSymbols = Object.values(stats.symbolAppearances).reduce((a, b) => a + b, 0);
    const symbolProbabilities = {};
    Object.keys(stats.symbolAppearances).forEach(symbol => {
      symbolProbabilities[symbol] = (stats.symbolAppearances[symbol] / totalSymbols) * 100;
    });

    // Calculate base game vs free spins RTP
    const baseGameRTP = stats.baseGame.wagered > 0 ? 
      (stats.baseGame.won / stats.baseGame.wagered) * 100 : 0;
    const freeSpinsRTP = stats.freeSpinsMode.wagered > 0 ? 
      (stats.freeSpinsMode.won / stats.freeSpinsMode.wagered) * 100 : 0;
    const baseGameWinFreq = stats.baseGame.spins > 0 ?
      (stats.baseGame.winningSpins / stats.baseGame.spins) * 100 : 0;
    const freeSpinsWinFreq = stats.freeSpinsMode.spins > 0 ?
      (stats.freeSpinsMode.winningSpins / stats.freeSpinsMode.spins) * 100 : 0;
    const avgFreeSpinsMultiplier = stats.freeSpinsMode.spins > 0 ?
      stats.freeSpinsMode.totalMultiplier / stats.freeSpinsMode.spins : 0;

    return {
      // Overall metrics
      overallRTP: parseFloat(rtp.toFixed(2)),
      winFrequency: parseFloat(winFrequency.toFixed(2)),
      averageWin: parseFloat(avgWin.toFixed(2)),
      
      // Financial summary
      totalWagered: stats.totalWagered,
      totalWon: stats.totalWon,
      totalLost: stats.totalWagered - stats.totalWon,
      largestWin: stats.largestWin,
      largestWinMultiplier: parseFloat(stats.largestWinMultiplier.toFixed(2)),

      // Spin breakdown
      totalSpins,
      winningSpins: stats.winningSpins,
      losingSpins: stats.losingSpins,
      winsByCategory: stats.winsByCategory,

      // Base game vs Free spins comparison
      baseGameAnalysis: {
        spins: stats.baseGame.spins,
        rtp: parseFloat(baseGameRTP.toFixed(2)),
        winFrequency: parseFloat(baseGameWinFreq.toFixed(2)),
        totalWagered: stats.baseGame.wagered,
        totalWon: stats.baseGame.won,
        averageWin: stats.baseGame.winningSpins > 0 ? 
          stats.baseGame.won / stats.baseGame.winningSpins : 0
      },
      freeSpinsAnalysis: {
        spins: stats.freeSpinsMode.spins,
        rtp: parseFloat(freeSpinsRTP.toFixed(2)),
        winFrequency: parseFloat(freeSpinsWinFreq.toFixed(2)),
        totalWagered: stats.freeSpinsMode.wagered,
        totalWon: stats.freeSpinsMode.won,
        averageWin: stats.freeSpinsMode.winningSpins > 0 ? 
          stats.freeSpinsMode.won / stats.freeSpinsMode.winningSpins : 0,
        averageMultiplier: parseFloat(avgFreeSpinsMultiplier.toFixed(2)),
        rtpImprovement: parseFloat((freeSpinsRTP - baseGameRTP).toFixed(2)),
        triggered: stats.freeSpinsTriggered,
        totalAwarded: stats.totalFreeSpinsAwarded,
        retriggered: stats.freeSpinsRetriggered
      },

      // Cascade analysis
      averageCascadeDepth: parseFloat(avgCascadeDepth.toFixed(2)),
      maxCascadeDepth: stats.maxCascadeDepth,
      cascadesByDepth: stats.cascadesByDepth,

      // Symbol analysis
      symbolAppearances: stats.symbolAppearances,
      symbolProbabilities,

      // Multiplier analysis
      multipliersTriggered: stats.multipliersTriggered,
      multiplierTriggerRate: parseFloat(((stats.multipliersTriggered / stats.totalSpins) * 100).toFixed(2)),
      averageMultiplier: parseFloat(avgMultiplier.toFixed(2)),
      multiplierDistribution: stats.multiplierDistribution,

      // Scatter analysis
      scatterTriggers: stats.scatterTriggers,
      scatterTriggerRate: parseFloat(((stats.scatterTriggers / stats.totalSpins) * 100).toFixed(4)),
      scatterCountDistribution: stats.scatterCountDistribution,

      // Performance
      duration,
      spinsPerSecond: parseFloat((totalSpins / (duration / 1000)).toFixed(2))
    };
  }

  /**
   * Generate unique simulation ID
   */
  generateSimulationId() {
    return `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active simulation status
   */
  getSimulationStatus(simulationId) {
    return this.activeSimulations.get(simulationId);
  }

  /**
   * Cancel active simulation
   */
  cancelSimulation(simulationId) {
    const sim = this.activeSimulations.get(simulationId);
    if (sim) {
      sim.cancelled = true;
      this.activeSimulations.delete(simulationId);
      return true;
    }
    return false;
  }
}

// Singleton instance
const simulatorInstance = new RTPSimulator();

module.exports = simulatorInstance;

