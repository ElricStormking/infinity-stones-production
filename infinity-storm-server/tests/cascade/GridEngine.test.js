/**
 * GridEngine.test.js - Task 2.4.1: Verify enhanced GridEngine cascade generation
 *
 * Comprehensive test suite for the Enhanced Cascade Synchronization GridEngine.
 * Tests all aspects of server-side cascade generation, validation, and synchronization.
 */

const GridEngine = require('../../game-logic/GridEngine');
const SpinResult = require('../../src/models/SpinResult');
const CascadeStep = require('../../src/models/CascadeStep');
const GameSession = require('../../src/models/GameSession');

describe('GridEngine Enhanced Cascade Generation', () => {
  let gridEngine;
  let mockGameSession;

  beforeEach(() => {
    gridEngine = new GridEngine();
    mockGameSession = new GameSession('test-session', 'test-player');
  });

  // ===========================================
  // Task 2.4.1: Enhanced GridEngine Tests
  // ===========================================

  describe('Basic Grid Generation', () => {
    test('should generate valid 6x5 grid', () => {
      const grid = gridEngine.generateRandomGrid();

      expect(grid).toHaveLength(6); // 6 columns
      expect(grid[0]).toHaveLength(5); // 5 rows

      // Check all positions have valid symbols
      for (let col = 0; col < 6; col++) {
        for (let row = 0; row < 5; row++) {
          expect(grid[col][row]).toBeDefined();
          expect(typeof grid[col][row]).toBe('string');
        }
      }
    });

    test('should generate reproducible grids with same seed', () => {
      const seed = 'test-seed-123';
      const grid1 = gridEngine.generateRandomGrid(seed);
      const grid2 = gridEngine.generateRandomGrid(seed);

      expect(grid1).toEqual(grid2);
    });

    test('should generate different grids with different seeds', () => {
      const grid1 = gridEngine.generateRandomGrid('seed-1');
      const grid2 = gridEngine.generateRandomGrid('seed-2');

      expect(grid1).not.toEqual(grid2);
    });
  });

  describe('Match Detection Algorithm', () => {
    test('should detect valid matches with 8+ symbols', () => {
      // Create a grid with a known match
      const testGrid = [
        ['time_gem', 'time_gem', 'time_gem', 'space_gem', 'mind_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'space_gem', 'mind_gem'],
        ['time_gem', 'time_gem', 'space_gem', 'space_gem', 'mind_gem'],
        ['power_gem', 'space_gem', 'space_gem', 'space_gem', 'mind_gem'],
        ['power_gem', 'space_gem', 'space_gem', 'space_gem', 'mind_gem'],
        ['power_gem', 'space_gem', 'space_gem', 'space_gem', 'mind_gem']
      ];

      const matches = gridEngine.findMatches(testGrid);

      expect(matches).toHaveLength(2); // Should find time_gem and space_gem clusters

      const timeGemMatch = matches.find(m => m.symbol === 'time_gem');
      const spaceGemMatch = matches.find(m => m.symbol === 'space_gem');

      expect(timeGemMatch.count).toBe(8);
      expect(spaceGemMatch.count).toBeGreaterThanOrEqual(8);
    });

    test('should not detect matches with less than 8 symbols', () => {
      // Create a grid with only small clusters
      const testGrid = [
        ['time_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem'],
        ['time_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem'],
        ['space_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['mind_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
        ['power_gem', 'power_gem', 'reality_gem', 'soul_gem', 'thanos_weapon'],
        ['reality_gem', 'reality_gem', 'soul_gem', 'thanos_weapon', 'scarlet_witch']
      ];

      const matches = gridEngine.findMatches(testGrid);

      expect(matches).toHaveLength(0);
    });

    test('should ignore scatter symbols in match detection', () => {
      const testGrid = [
        ['infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove'],
        ['infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove'],
        ['infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove'],
        ['infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove'],
        ['infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove'],
        ['infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove', 'infinity_glove']
      ];

      const matches = gridEngine.findMatches(testGrid);

      expect(matches).toHaveLength(0); // Scatters should not count as matches
    });
  });

  describe('Win Calculation', () => {
    test('should calculate wins correctly for different cluster sizes', () => {
      const matches = [
        { symbol: 'time_gem', count: 8, positions: [] },
        { symbol: 'thanos', count: 12, positions: [] },
        { symbol: 'scarlet_witch', count: 10, positions: [] }
      ];

      const wins = gridEngine.calculateCascadeWins(matches, 1.00);

      expect(wins).toHaveLength(3);

      const timeGemWin = wins.find(w => w.symbol === 'time_gem');
      const thanosWin = wins.find(w => w.symbol === 'thanos');
      const witchWin = wins.find(w => w.symbol === 'scarlet_witch');

      expect(timeGemWin.payout).toBe(0.4); // (1.00/20) * 8
      expect(thanosWin.payout).toBe(50); // (1.00/20) * 1000
      expect(witchWin.payout).toBe(10); // (1.00/20) * 200
    });

    test('should apply multipliers to wins correctly', () => {
      const wins = gridEngine.calculateCascadeWins([
        { symbol: 'time_gem', count: 8, positions: [] }
      ], 2.00);

      expect(wins[0].payout).toBe(0.8); // (2.00/20) * 8
    });
  });

  describe('Enhanced Cascade Generation', () => {
    test('should generate complete SpinResult with cascade steps', () => {
      const options = {
        bet: 1.00,
        quickSpinMode: false,
        freeSpinsActive: false,
        accumulatedMultiplier: 1,
        gameSession: mockGameSession
      };

      const spinResult = gridEngine.generateSpinResult(options);

      expect(spinResult).toBeInstanceOf(SpinResult);
      expect(spinResult.spinId).toBeDefined();
      expect(spinResult.betAmount).toBe(1.00);
      expect(spinResult.initialGrid).toBeDefined();
      expect(Array.isArray(spinResult.cascadeSteps)).toBe(true);
      expect(spinResult.validationHash).toBeDefined();
    });

    test('should generate CascadeStep objects with proper structure', () => {
      // Create a grid that guarantees matches
      const mockGrid = [
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'space_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'space_gem'],
        ['power_gem', 'power_gem', 'power_gem', 'power_gem', 'space_gem'],
        ['power_gem', 'power_gem', 'power_gem', 'power_gem', 'space_gem'],
        ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'space_gem'],
        ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'space_gem']
      ];

      // Mock the generateRandomGrid method to return our test grid
      jest.spyOn(gridEngine, 'generateRandomGrid').mockReturnValue(mockGrid);

      const spinResult = gridEngine.generateSpinResult({
        bet: 1.00,
        gameSession: mockGameSession
      });

      if (spinResult.cascadeSteps.length > 0) {
        const firstStep = spinResult.cascadeSteps[0];

        expect(firstStep).toBeInstanceOf(CascadeStep);
        expect(firstStep.stepNumber).toBe(0);
        expect(firstStep.gridStateBefore).toBeDefined();
        expect(firstStep.gridStateAfter).toBeDefined();
        expect(firstStep.matchedClusters).toBeDefined();
        expect(firstStep.timing).toBeDefined();
        expect(firstStep.validation.stepHash).toBeDefined();
      }

      gridEngine.generateRandomGrid.mockRestore();
    });

    test('should track game session state during cascade generation', () => {
      const spinResult = gridEngine.generateSpinResult({
        bet: 1.00,
        gameSession: mockGameSession
      });

      // Verify game session was updated
      expect(mockGameSession.gameState.currentSpinId).toBe(spinResult.spinId);
    });
  });

  describe('Validation Hash Generation', () => {
    test('should generate consistent hashes for identical grids', () => {
      const grid = [
        ['time_gem', 'space_gem'],
        ['mind_gem', 'power_gem']
      ];

      const hash1 = gridEngine.generateGridValidationHash(grid, 'salt123');
      const hash2 = gridEngine.generateGridValidationHash(grid, 'salt123');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    test('should generate different hashes for different grids', () => {
      const grid1 = [['time_gem', 'space_gem']];
      const grid2 = [['mind_gem', 'power_gem']];

      const hash1 = gridEngine.generateGridValidationHash(grid1, 'salt');
      const hash2 = gridEngine.generateGridValidationHash(grid2, 'salt');

      expect(hash1).not.toBe(hash2);
    });

    test('should generate different hashes with different salts', () => {
      const grid = [['time_gem', 'space_gem']];

      const hash1 = gridEngine.generateGridValidationHash(grid, 'salt1');
      const hash2 = gridEngine.generateGridValidationHash(grid, 'salt2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Enhanced Drop Patterns and Timing', () => {
    test('should calculate enhanced drop patterns with timing data', () => {
      const grid = [
        ['time_gem', null, 'space_gem'],
        ['mind_gem', 'power_gem', null]
      ];
      const removedPositions = [[0, 0], [1, 1]];

      const result = gridEngine.calculateEnhancedDropsAndNewSymbols(
        grid, removedPositions, 'test-seed', 0
      );

      expect(result.gridAfterCascade).toBeDefined();
      expect(result.newSymbols).toBeDefined();
      expect(result.dropPatterns).toBeDefined();

      // Check that drop patterns include timing
      if (result.dropPatterns.length > 0) {
        const pattern = result.dropPatterns[0];
        expect(pattern.column).toBeDefined();
        expect(pattern.droppedSymbols).toBeDefined();
        expect(pattern.newSymbols).toBeDefined();
      }
    });

    test('should calculate enhanced cascade timing with synchronization data', () => {
      const timing = gridEngine.calculateEnhancedCascadeTiming(0, 0, false);

      expect(timing).toHaveProperty('startTime');
      expect(timing).toHaveProperty('endTime');
      expect(timing).toHaveProperty('duration');
      expect(timing).toHaveProperty('serverTimestamp');
      expect(timing).toHaveProperty('syncTolerance');
      expect(timing).toHaveProperty('phases');
      expect(timing.phases).toHaveProperty('matchHighlight');
      expect(timing.phases).toHaveProperty('symbolRemoval');
      expect(timing.phases).toHaveProperty('symbolDrop');
      expect(timing.phases).toHaveProperty('gridSettle');
    });

    test('should adjust timing for quick spin mode', () => {
      const normalTiming = gridEngine.calculateEnhancedCascadeTiming(0, 0, false);
      const quickTiming = gridEngine.calculateEnhancedCascadeTiming(0, 0, true);

      expect(quickTiming.duration).toBeLessThan(normalTiming.duration);
      expect(quickTiming.quickSpinActive).toBe(true);
      expect(normalTiming.quickSpinActive).toBe(false);
    });
  });

  describe('Recovery Checkpoint System', () => {
    test('should create recovery checkpoints', () => {
      const options = {
        spinId: 'test-spin-123',
        bet: 1.00,
        quickSpinMode: false
      };

      const checkpoint = gridEngine.createRecoveryCheckpoint(options);

      expect(checkpoint.checkpointId).toBeDefined();
      expect(checkpoint.timestamp).toBeDefined();
      expect(checkpoint.spinOptions).toEqual(options);
      expect(checkpoint.gridEngineState).toBeDefined();
      expect(checkpoint.recoveryVersion).toBe('1.0.0');
    });

    test('should generate unique checkpoint IDs', () => {
      const checkpoint1 = gridEngine.createRecoveryCheckpoint({});
      const checkpoint2 = gridEngine.createRecoveryCheckpoint({});

      expect(checkpoint1.checkpointId).not.toBe(checkpoint2.checkpointId);
    });
  });

  describe('Seeded RNG System', () => {
    test('should create deterministic random sequences', () => {
      const rng1 = gridEngine.createSeededRNG('test-seed');
      const rng2 = gridEngine.createSeededRNG('test-seed');

      const sequence1 = Array.from({ length: 10 }, () => rng1());
      const sequence2 = Array.from({ length: 10 }, () => rng2());

      expect(sequence1).toEqual(sequence2);
    });

    test('should generate different sequences for different seeds', () => {
      const rng1 = gridEngine.createSeededRNG('seed-1');
      const rng2 = gridEngine.createSeededRNG('seed-2');

      const value1 = rng1();
      const value2 = rng2();

      expect(value1).not.toBe(value2);
    });

    test('should generate values between 0 and 1', () => {
      const rng = gridEngine.createSeededRNG('test-seed');

      for (let i = 0; i < 100; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe('Cascade Step Validation', () => {
    test('should validate cascade steps against server state', () => {
      const mockCascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem', 'space_gem']],
        gridStateAfter: [['mind_gem', 'power_gem']]
      });

      const clientStepData = {
        stepNumber: 0,
        gridStateAfter: [['mind_gem', 'power_gem']],
        matchedClusters: [],
        totalStepWin: 0
      };

      const validation = gridEngine.validateCascadeStep(clientStepData, mockCascadeStep);

      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(validation.clientHash).toBeDefined();
      expect(validation.serverHash).toBeDefined();
      expect(validation.validatedAt).toBeDefined();
    });

    test('should detect step number mismatches', () => {
      const mockCascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      const clientStepData = {
        stepNumber: 1, // Mismatch
        gridStateAfter: [['space_gem']],
        matchedClusters: [],
        totalStepWin: 0
      };

      const validation = gridEngine.validateCascadeStep(clientStepData, mockCascadeStep);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Step number mismatch');
    });
  });

  describe('Error Handling', () => {
    test('should handle grid generation errors gracefully', () => {
      // Mock a failure in grid generation
      jest.spyOn(gridEngine, 'generateRandomGrid').mockImplementation(() => {
        throw new Error('Grid generation failed');
      });

      const spinResult = gridEngine.generateSpinResult({
        bet: 1.00
      });

      expect(spinResult.error).toBeDefined();
      expect(spinResult.error.code).toBe('SPIN_GENERATION_FAILED');

      gridEngine.generateRandomGrid.mockRestore();
    });

    test('should prevent infinite cascade loops', () => {
      // Mock findMatches to always return matches (infinite loop scenario)
      jest.spyOn(gridEngine, 'findMatches').mockReturnValue([
        { symbol: 'time_gem', count: 8, positions: [[0, 0]] }
      ]);

      const spinResult = gridEngine.generateSpinResult({
        bet: 1.00
      });

      // Should stop at safety limit
      expect(spinResult.cascadeSteps.length).toBeLessThanOrEqual(20);

      gridEngine.findMatches.mockRestore();
    });
  });

  describe('Performance Validation', () => {
    test('should generate spin results within reasonable time', () => {
      const startTime = Date.now();

      const spinResult = gridEngine.generateSpinResult({
        bet: 1.00
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(spinResult).toBeDefined();
    });

    test('should handle multiple concurrent spin generations', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(gridEngine.generateSpinResult({
          bet: 1.00,
          spinId: `concurrent-spin-${i}`
        })));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.spinId).toBe(`concurrent-spin-${index}`);
      });
    });
  });
});