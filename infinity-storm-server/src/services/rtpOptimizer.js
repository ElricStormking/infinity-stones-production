/**
 * RTP Optimizer Service
 * 
 * AI-powered optimizer that suggests optimal symbol weights to reach target RTP.
 * Uses iterative hill-climbing algorithm to find optimal configuration.
 */

const rtpSimulator = require('./rtpSimulator');
const { logger } = require('../utils/logger');

class RTPOptimizer {
  /**
   * Optimize symbol weights to reach target RTP
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized configuration
   */
  async optimize(options) {
    const {
      targetRTP = 96.5,
      currentConfig,
      maxIterations = 10,
      tolerance = 0.5,
      spinCount = 50000 // Use smaller spin count for faster iterations
    } = options;

    logger.info('Starting RTP optimization', {
      targetRTP,
      maxIterations,
      tolerance
    });

    let bestConfig = currentConfig;
    let bestRTP = null;
    let bestDeviation = Infinity;
    const iterationResults = [];

    // Run initial simulation with current config
    logger.info('Running initial simulation with current config');
    const initialResults = await rtpSimulator.runSimulation({
      symbolWeights: currentConfig.symbolWeights,
      scatterChance: currentConfig.scatterChance,
      multiplierTable: currentConfig.multiplierTable,
      spinCount
    });

    bestRTP = initialResults.overallRTP;
    bestDeviation = Math.abs(bestRTP - targetRTP);

    iterationResults.push({
      iteration: 0,
      rtp: bestRTP,
      deviation: bestDeviation,
      config: { ...currentConfig }
    });

    logger.info(`Initial RTP: ${bestRTP}%, Deviation: ${bestDeviation}%`);

    // If already within tolerance, return current config
    if (bestDeviation <= tolerance) {
      return {
        optimizedConfig: bestConfig,
        achievedRTP: bestRTP,
        targetRTP,
        deviation: bestDeviation,
        iterations: 1,
        converged: true,
        iterationResults
      };
    }

    // Iterative optimization
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      logger.info(`Optimization iteration ${iteration}/${maxIterations}`);

      // Calculate adjustment direction
      const rtpDiff = targetRTP - bestRTP;
      const adjustmentFactor = this.calculateAdjustmentFactor(rtpDiff, iteration);

      // Adjust symbol weights
      const adjustedWeights = this.adjustSymbolWeights(
        bestConfig.symbolWeights,
        rtpDiff,
        adjustmentFactor
      );

      // Run simulation with adjusted weights
      const results = await rtpSimulator.runSimulation({
        symbolWeights: adjustedWeights,
        scatterChance: bestConfig.scatterChance,
        multiplierTable: bestConfig.multiplierTable,
        spinCount
      });

      const newRTP = results.overallRTP;
      const newDeviation = Math.abs(newRTP - targetRTP);

      logger.info(`Iteration ${iteration}: RTP ${newRTP}%, Deviation ${newDeviation}%`);

      iterationResults.push({
        iteration,
        rtp: newRTP,
        deviation: newDeviation,
        config: {
          symbolWeights: adjustedWeights,
          scatterChance: bestConfig.scatterChance,
          multiplierTable: bestConfig.multiplierTable
        }
      });

      // Check if this is better
      if (newDeviation < bestDeviation) {
        bestConfig = {
          symbolWeights: adjustedWeights,
          scatterChance: bestConfig.scatterChance,
          multiplierTable: bestConfig.multiplierTable
        };
        bestRTP = newRTP;
        bestDeviation = newDeviation;

        logger.info(`New best config found: RTP ${bestRTP}%, Deviation ${bestDeviation}%`);
      }

      // Check convergence
      if (bestDeviation <= tolerance) {
        logger.info(`Converged! Target RTP reached within tolerance.`);
        break;
      }
    }

    const converged = bestDeviation <= tolerance;
    const confidenceScore = this.calculateConfidenceScore(bestDeviation, tolerance);

    return {
      optimizedConfig: bestConfig,
      achievedRTP: bestRTP,
      targetRTP,
      deviation: bestDeviation,
      iterations: iterationResults.length,
      converged,
      confidenceScore,
      iterationResults
    };
  }

  /**
   * Calculate adjustment factor based on RTP difference and iteration
   */
  calculateAdjustmentFactor(rtpDiff, iteration) {
    // Start with larger adjustments, then refine
    const baseAdjustment = 0.1; // 10% base adjustment
    const decayFactor = Math.pow(0.8, iteration - 1); // Decay over iterations
    return baseAdjustment * decayFactor * Math.abs(rtpDiff) / 10;
  }

  /**
   * Adjust symbol weights based on RTP difference
   */
  adjustSymbolWeights(currentWeights, rtpDiff, adjustmentFactor) {
    const adjusted = { ...currentWeights };

    // Get symbol values (high to low)
    const symbolValues = {
      thanos: 1000,           // Highest
      scarlet_witch: 500,
      thanos_weapon: 300,
      soul_gem: 240,
      reality_gem: 200,
      power_gem: 160,
      mind_gem: 100,
      space_gem: 80,
      time_gem: 40            // Lowest
    };

    Object.keys(adjusted).forEach(symbol => {
      const value = symbolValues[symbol] || 100;
      const isHighValue = value > 150;

      if (rtpDiff > 0) {
        // Need to increase RTP - increase high-value symbols, decrease low-value
        if (isHighValue) {
          adjusted[symbol] = Math.round(adjusted[symbol] * (1 + adjustmentFactor));
        } else {
          adjusted[symbol] = Math.max(1, Math.round(adjusted[symbol] * (1 - adjustmentFactor)));
        }
      } else {
        // Need to decrease RTP - decrease high-value symbols, increase low-value
        if (isHighValue) {
          adjusted[symbol] = Math.max(1, Math.round(adjusted[symbol] * (1 - adjustmentFactor)));
        } else {
          adjusted[symbol] = Math.round(adjusted[symbol] * (1 + adjustmentFactor));
        }
      }
    });

    return adjusted;
  }

  /**
   * Calculate confidence score (0-100)
   */
  calculateConfidenceScore(deviation, tolerance) {
    if (deviation === 0) return 100;
    if (deviation >= tolerance * 3) return 0;
    
    // Linear interpolation
    const score = 100 * (1 - (deviation / (tolerance * 3)));
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

// Singleton instance
const optimizerInstance = new RTPOptimizer();

module.exports = optimizerInstance;

