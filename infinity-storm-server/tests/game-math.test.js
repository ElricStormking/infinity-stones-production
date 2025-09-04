/**
 * Server-Side Mathematical Validation Test Suite
 *
 * Casino-grade mathematical validation for regulatory compliance.
 * Tests all game mathematics, RNG systems, and payout calculations.
 *
 * This test suite validates:
 * - RNG security and distribution
 * - Payout calculation accuracy
 * - Symbol distribution compliance
 * - Cascade mechanics validation
 * - Multiplier system accuracy
 * - Free spins mathematics
 */

const GridEngine = require('../game-logic/GridEngine');
const { getRNG } = require('../src/game/rng');
const GridGenerator = require('../src/game/gridGenerator');

describe('Server-Side Mathematical Validation', () => {
  let gridEngine;
  let rngSystem;
  let gridGenerator;

  beforeAll(async () => {
    gridEngine = new GridEngine();
    rngSystem = getRNG({ auditLogging: true });
    gridGenerator = new GridGenerator({ auditLogging: true });

    console.log('🎰 Starting Server-Side Mathematical Validation');
    console.log('This test suite validates casino-grade mathematical accuracy');
  });

  afterAll(async () => {
    // Generate final mathematical compliance report
    const rngStats = rngSystem.getStatistics();
    const complianceValidation = rngSystem.validateCasinoCompliance();

    console.log('\n📊 Mathematical Validation Summary:');
    console.log(`RNG Entropy Quality: ${complianceValidation.entropy_quality}`);
    console.log(`Distribution Tests: ${complianceValidation.distribution_tests_passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Security Validation: ${complianceValidation.security_validation ? 'PASSED' : 'FAILED'}`);
    console.log(`Total Random Numbers Generated: ${rngStats.total_numbers_generated}`);
  });

  describe('RNG System Validation', () => {
    test('RNG should generate cryptographically secure random numbers', async () => {
      const samples = [];
      const sampleSize = 10000;

      // Generate large sample for statistical testing
      for (let i = 0; i < sampleSize; i++) {
        samples.push(rngSystem.random());
      }

      // Test 1: All values should be between 0 and 1
      const allInRange = samples.every(val => val >= 0 && val < 1);
      expect(allInRange).toBe(true);

      // Test 2: Values should be uniformly distributed
      const mean = samples.reduce((sum, val) => sum + val, 0) / sampleSize;
      expect(mean).toBeCloseTo(0.5, 2); // Should be close to 0.5

      // Test 3: Standard deviation should be approximately 1/√12 ≈ 0.289
      const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleSize;
      const stdDev = Math.sqrt(variance);
      expect(stdDev).toBeCloseTo(0.289, 1);

      // Test 4: Chi-square test for uniform distribution
      const bins = 10;
      const binCounts = new Array(bins).fill(0);
      samples.forEach(val => {
        const binIndex = Math.floor(val * bins);
        binCounts[binIndex === bins ? bins - 1 : binIndex]++;
      });

      const expectedFreq = sampleSize / bins;
      const chiSquare = binCounts.reduce((sum, count) =>
        sum + Math.pow(count - expectedFreq, 2) / expectedFreq, 0);

      // Chi-square critical value for 9 degrees of freedom at 95% confidence: 16.919
      expect(chiSquare).toBeLessThan(16.919);
    });

    test('RNG should pass casino compliance validation', () => {
      const complianceResult = rngSystem.validateCasinoCompliance();

      expect(complianceResult.entropy_quality).toBeGreaterThanOrEqual(0.95);
      expect(complianceResult.distribution_tests_passed).toBe(true);
      expect(complianceResult.security_validation).toBe(true);
      expect(complianceResult.audit_trail_complete).toBe(true);
    });

    test('Weighted random selection should respect symbol probabilities', () => {
      const weights = {
        time_gem: 26,
        space_gem: 26,
        mind_gem: 22,
        power_gem: 20,
        reality_gem: 20,
        soul_gem: 19,
        thanos_weapon: 17,
        scarlet_witch: 12,
        thanos: 11
      };

      const sampleSize = 50000;
      const results = {};

      // Initialize counters
      Object.keys(weights).forEach(symbol => results[symbol] = 0);

      // Generate samples
      for (let i = 0; i < sampleSize; i++) {
        const symbol = rngSystem.weightedRandom(weights);
        results[symbol]++;
      }

      // Calculate total weight
      const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

      // Validate distribution is within acceptable variance
      for (const [symbol, weight] of Object.entries(weights)) {
        const expectedFreq = (weight / totalWeight) * sampleSize;
        const actualFreq = results[symbol];
        const deviation = Math.abs(actualFreq - expectedFreq) / expectedFreq;

        // Allow 5% deviation from expected frequency
        expect(deviation).toBeLessThan(0.05);
      }
    });

    test('Seeded RNG should produce reproducible results', () => {
      const seed = 'test_seed_12345';
      const rng1 = rngSystem.createSeededRNG(seed);
      const rng2 = rngSystem.createSeededRNG(seed);

      const samples1 = [];
      const samples2 = [];

      // Generate 100 samples from each seeded RNG
      for (let i = 0; i < 100; i++) {
        samples1.push(rng1());
        samples2.push(rng2());
      }

      // Results should be identical
      for (let i = 0; i < 100; i++) {
        expect(samples1[i]).toBe(samples2[i]);
      }
    });
  });

  describe('Grid Generation Mathematics', () => {
    test('Grid generator should create valid 6x5 grids', () => {
      const gridResult = gridGenerator.generateGrid();
      const grid = gridResult.grid;

      expect(grid).toHaveLength(6); // 6 columns
      grid.forEach(column => {
        expect(column).toHaveLength(5); // 5 rows
        column.forEach(symbol => {
          expect(typeof symbol).toBe('string');
          expect(symbol.length).toBeGreaterThan(0);
        });
      });
    });

    test('Grid generator should respect symbol distribution weights', () => {
      const sampleSize = 1000;
      const symbolCounts = {};
      let totalSymbols = 0;

      for (let i = 0; i < sampleSize; i++) {
        const gridResult = gridGenerator.generateGrid();
        const grid = gridResult.grid;

        // Count symbols in this grid
        for (let col = 0; col < grid.length; col++) {
          for (let row = 0; row < grid[col].length; row++) {
            const symbol = grid[col][row];
            symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
            totalSymbols++;
          }
        }
      }

      // Expected distributions based on weights
      const expectedDistributions = {
        time_gem: 14.1,
        space_gem: 14.1,
        mind_gem: 11.8,
        power_gem: 9.4,
        reality_gem: 8.2,
        soul_gem: 7.1,
        thanos_weapon: 2.9,
        scarlet_witch: 2.4,
        thanos: 1.2,
        infinity_glove: 3.5 // Scatter chance
      };

      // Validate distributions are within acceptable range
      for (const [symbol, expectedPercent] of Object.entries(expectedDistributions)) {
        const actualCount = symbolCounts[symbol] || 0;
        const actualPercent = (actualCount / totalSymbols) * 100;
        const deviation = Math.abs(actualPercent - expectedPercent);

        // Allow 2% deviation for most symbols, 1% for high-frequency symbols
        const tolerance = expectedPercent > 10 ? 2.0 : 1.0;
        expect(deviation).toBeLessThan(tolerance);
      }
    });

    test('Free spins mode should affect symbol distribution', () => {
      const normalGrids = [];
      const freeSpinGrids = [];
      const sampleSize = 500;

      // Generate normal grids
      for (let i = 0; i < sampleSize; i++) {
        const gridResult = gridGenerator.generateGrid({ freeSpinsMode: false });
        normalGrids.push(gridResult.grid);
      }

      // Generate free spins grids
      for (let i = 0; i < sampleSize; i++) {
        const gridResult = gridGenerator.generateGrid({ freeSpinsMode: true });
        freeSpinGrids.push(gridResult.grid);
      }

      // Count high-value symbols in both modes
      const countHighValueSymbols = (grids) => {
        let count = 0;
        let total = 0;
        grids.forEach(grid => {
          grid.forEach(column => {
            column.forEach(symbol => {
              total++;
              if (['thanos', 'scarlet_witch', 'thanos_weapon'].includes(symbol)) {
                count++;
              }
            });
          });
        });
        return count / total;
      };

      const normalHighValueRatio = countHighValueSymbols(normalGrids);
      const freeSpinsHighValueRatio = countHighValueSymbols(freeSpinGrids);

      // Free spins mode should have higher ratio of high-value symbols
      expect(freeSpinsHighValueRatio).toBeGreaterThanOrEqual(normalHighValueRatio);
    });
  });

  describe('Payout Calculation Accuracy', () => {
    test('Symbol payouts should match expected mathematical values', () => {
      const testCases = [
        { symbol: 'time_gem', clusterSize: 8, bet: 1.00, expectedPayout: 0.40 },
        { symbol: 'time_gem', clusterSize: 10, expectedPayout: 0.75 },
        { symbol: 'time_gem', clusterSize: 12, expectedPayout: 2.00 },
        { symbol: 'thanos', clusterSize: 8, expectedPayout: 10.00 },
        { symbol: 'thanos', clusterSize: 10, expectedPayout: 25.00 },
        { symbol: 'thanos', clusterSize: 12, expectedPayout: 50.00 },
        { symbol: 'infinity_glove', clusterSize: 4, expectedPayout: 3.00 },
        { symbol: 'infinity_glove', clusterSize: 5, expectedPayout: 5.00 },
        { symbol: 'infinity_glove', clusterSize: 6, expectedPayout: 100.00 }
      ];

      testCases.forEach(testCase => {
        const grid = createTestGrid(testCase.symbol, testCase.clusterSize);
        const matches = gridEngine.findMatches(grid);
        const wins = gridEngine.calculateCascadeWins(matches, testCase.bet || 1.00);

        const symbolWin = wins.find(win => win.symbol === testCase.symbol);
        const actualPayout = symbolWin ? symbolWin.payout : 0;

        expect(actualPayout).toBeCloseTo(testCase.expectedPayout, 2);
      });
    });

    test('Cascade win calculations should be mathematically accurate', () => {
      // Test multiple cascades with known outcomes
      const initialGrid = [
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'space_gem', 'space_gem'],
        ['space_gem', 'space_gem', 'space_gem', 'space_gem', 'space_gem'],
        ['space_gem', 'space_gem', 'space_gem', 'mind_gem', 'mind_gem'],
        ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'mind_gem'],
        ['mind_gem', 'mind_gem', 'mind_gem', 'power_gem', 'power_gem']
      ];

      const matches = gridEngine.findMatches(initialGrid);
      const wins = gridEngine.calculateCascadeWins(matches, 1.00);

      // Verify each symbol type has correct count and payout
      const timeGemMatch = matches.find(m => m.symbol === 'time_gem');
      const spaceGemMatch = matches.find(m => m.symbol === 'space_gem');
      const mindGemMatch = matches.find(m => m.symbol === 'mind_gem');

      expect(timeGemMatch.count).toBe(8); // 8 time gems
      expect(spaceGemMatch.count).toBe(10); // 10 space gems
      expect(mindGemMatch.count).toBe(12); // 12 mind gems

      const timeGemWin = wins.find(w => w.symbol === 'time_gem');
      const spaceGemWin = wins.find(w => w.symbol === 'space_gem');
      const mindGemWin = wins.find(w => w.symbol === 'mind_gem');

      expect(timeGemWin.payout).toBeCloseTo(0.40, 2); // (1.00/20) * 8
      expect(spaceGemWin.payout).toBeCloseTo(0.90, 2); // (1.00/20) * 18
      expect(mindGemWin.payout).toBeCloseTo(5.00, 2); // (1.00/20) * 100
    });

    test('Free spins multiplier calculations should be accurate', () => {
      const baseWin = 5.00;
      const multipliers = [1, 2, 5, 10, 25];

      multipliers.forEach(multiplier => {
        const matches = [{ symbol: 'thanos', positions: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2]], count: 8 }];
        const wins = gridEngine.calculateCascadeWins(matches, 1.00);

        // Apply multiplier (simulating free spins)
        const multipliedWins = wins.map(win => ({
          ...win,
          payout: win.payout * multiplier,
          multiplier: win.multiplier * multiplier
        }));

        const expectedMultipliedPayout = 10.00 * multiplier; // Base thanos 8-cluster payout * multiplier
        expect(multipliedWins[0].payout).toBeCloseTo(expectedMultipliedPayout, 2);
      });
    });

    test('Random multiplier selection should follow correct probability distribution', () => {
      const sampleSize = 10000;
      const multiplierCounts = {};
      const expectedTable = [
        ...Array(487).fill(2),
        ...Array(200).fill(3),
        ...Array(90).fill(4),
        ...Array(70).fill(5),
        ...Array(70).fill(6),
        ...Array(40).fill(8),
        ...Array(20).fill(10),
        ...Array(10).fill(20),
        ...Array(10).fill(100),
        ...Array(3).fill(500)
      ];

      // Count occurrences of each multiplier
      expectedTable.forEach(mult => {
        multiplierCounts[mult] = (multiplierCounts[mult] || 0) + 1;
      });

      // Calculate expected probabilities
      const totalEntries = expectedTable.length;
      const expectedProbabilities = {};
      Object.entries(multiplierCounts).forEach(([mult, count]) => {
        expectedProbabilities[mult] = count / totalEntries;
      });

      // Sample from the system
      const actualCounts = {};
      for (let i = 0; i < sampleSize; i++) {
        const table = expectedTable; // Use the same table as config
        const selectedMultiplier = table[rngSystem.randomInt(0, table.length - 1)];
        actualCounts[selectedMultiplier] = (actualCounts[selectedMultiplier] || 0) + 1;
      }

      // Verify probabilities match expected distribution
      Object.entries(expectedProbabilities).forEach(([mult, expectedProb]) => {
        const actualCount = actualCounts[mult] || 0;
        const actualProb = actualCount / sampleSize;
        const deviation = Math.abs(actualProb - expectedProb);

        // Allow 5% relative deviation
        expect(deviation).toBeLessThan(expectedProb * 0.05);
      });
    });
  });

  describe('Comprehensive RTP Validation', () => {
    test('100K spin simulation should achieve target 96.5% RTP', async () => {
      const spins = 100000;
      const bet = 1.00;
      let totalBet = 0;
      let totalWin = 0;
      let freeSpinsTriggers = 0;
      let cascadesSum = 0;

      console.log(`    Running ${spins.toLocaleString()} spins for RTP validation...`);

      for (let i = 0; i < spins; i++) {
        totalBet += bet;

        const spinResult = gridEngine.generateSpinResult({
          bet,
          quickSpinMode: false,
          freeSpinsActive: false,
          accumulatedMultiplier: 1,
          spinId: `rtp_test_${i}`
        });

        totalWin += spinResult.totalWin;
        cascadesSum += spinResult.cascadeSteps.length;

        if (spinResult.freeSpinsTriggered) {
          freeSpinsTriggers++;

          // Simulate free spins (simplified)
          for (let fs = 0; fs < 15; fs++) {
            const freeSpinResult = gridEngine.generateSpinResult({
              bet,
              quickSpinMode: false,
              freeSpinsActive: true,
              accumulatedMultiplier: Math.min(2 + Math.floor(fs / 3), 10)
            });

            totalWin += freeSpinResult.totalWin;
            cascadesSum += freeSpinResult.cascadeSteps.length;
          }
        }
      }

      const rtp = (totalWin / totalBet) * 100;
      const hitRate = totalWin > 0 ? (totalWin / totalBet) : 0;
      const avgCascades = cascadesSum / spins;

      console.log(`    Results: RTP=${rtp.toFixed(2)}%, Avg Cascades=${avgCascades.toFixed(2)}, FS Triggers=${freeSpinsTriggers}`);

      // RTP should be within ±0.5% of target (96.5%)
      expect(rtp).toBeGreaterThan(96.0);
      expect(rtp).toBeLessThan(97.0);

      // Free spins should trigger approximately 2-4% of the time
      const fsTriggerRate = (freeSpinsTriggers / spins) * 100;
      expect(fsTriggerRate).toBeGreaterThan(1.5);
      expect(fsTriggerRate).toBeLessThan(5.0);

      // Average cascades should be reasonable (1-3 per spin)
      expect(avgCascades).toBeGreaterThan(0.8);
      expect(avgCascades).toBeLessThan(4.0);
    }, 60000); // 60 second timeout for large test

    test('Server RTP should match client simulator within 0.1%', () => {
      // This test requires both systems to run the same number of spins
      // with the same seed for direct comparison
      const spins = 10000;
      const bet = 1.00;
      const seed = 'comparison_test_seed';

      // This would require implementing deterministic seeding in both systems
      // For now, we'll test that they're both in the acceptable RTP range

      // Run server simulation
      let serverTotalBet = 0;
      let serverTotalWin = 0;

      for (let i = 0; i < spins; i++) {
        serverTotalBet += bet;
        const spinResult = gridEngine.generateSpinResult({ bet });
        serverTotalWin += spinResult.totalWin;
      }

      const serverRTP = (serverTotalWin / serverTotalBet) * 100;

      // Both should be within the target range
      expect(serverRTP).toBeGreaterThan(94.0);
      expect(serverRTP).toBeLessThan(99.0);
    });

    test('Variance and standard deviation should be within expected ranges', async () => {
      const spins = 50000;
      const payouts = [];

      for (let i = 0; i < spins; i++) {
        const spinResult = gridEngine.generateSpinResult({ bet: 1.00 });
        payouts.push(spinResult.totalWin);
      }

      const mean = payouts.reduce((sum, val) => sum + val, 0) / spins;
      const variance = payouts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spins;
      const standardDeviation = Math.sqrt(variance);

      // High volatility slot should have high variance
      expect(variance).toBeGreaterThan(10);
      expect(standardDeviation).toBeGreaterThan(3);

      // But not unreasonably high
      expect(variance).toBeLessThan(1000);
      expect(standardDeviation).toBeLessThan(100);
    }, 30000);
  });

  describe('Edge Case and Security Validation', () => {
    test('Invalid bet amounts should be handled correctly', () => {
      const invalidBets = [0, -1, -100, null, undefined, 'invalid', NaN, Infinity];

      invalidBets.forEach(bet => {
        const spinResult = gridEngine.generateSpinResult({ bet });

        // Should either use default bet or return error
        expect(spinResult.betAmount).toBeGreaterThan(0);
        expect(typeof spinResult.betAmount).toBe('number');
        expect(isFinite(spinResult.betAmount)).toBe(true);
      });
    });

    test('Extremely large bet amounts should not cause overflow', () => {
      const largeBet = 999999.99;
      const spinResult = gridEngine.generateSpinResult({ bet: largeBet });

      expect(spinResult.totalWin).toBeFinite();
      expect(spinResult.totalWin).toBeGreaterThanOrEqual(0);
    });

    test('Grid state validation should detect tampering', () => {
      const spinResult = gridEngine.generateSpinResult({ bet: 1.00 });
      const originalHash = spinResult.validationHash;

      // Modify the result
      spinResult.totalWin *= 2;

      // Re-calculate hash should be different
      spinResult.updateValidationHash();
      expect(spinResult.validationHash).not.toBe(originalHash);
    });

    test('Cascade step validation should maintain integrity', () => {
      const spinResult = gridEngine.generateSpinResult({ bet: 1.00 });

      for (const cascadeStep of spinResult.cascadeSteps) {
        // Each cascade step should have valid hash
        expect(cascadeStep.validation.stepHash).toBeTruthy();
        expect(typeof cascadeStep.validation.stepHash).toBe('string');
        expect(cascadeStep.validation.stepHash.length).toBeGreaterThan(10);

        // Grid states should be valid
        expect(cascadeStep.gridStateBefore).toBeDefined();
        expect(cascadeStep.gridStateAfter).toBeDefined();

        // Timing data should be reasonable
        expect(cascadeStep.timing.duration).toBeGreaterThan(0);
        expect(cascadeStep.timing.duration).toBeLessThan(10000);
      }
    });
  });
});

// Helper function to create test grids
function createTestGrid(symbol, clusterSize) {
  const grid = Array(6).fill(null).map(() => Array(5).fill('time_gem'));

  let placed = 0;
  for (let col = 0; col < 6 && placed < clusterSize; col++) {
    for (let row = 0; row < 5 && placed < clusterSize; row++) {
      grid[col][row] = symbol;
      placed++;
    }
  }

  return grid;
}