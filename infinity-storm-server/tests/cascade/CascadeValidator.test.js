/**
 * CascadeValidator.test.js - Task 2.4.3: Validate CascadeValidator service functionality
 *
 * Comprehensive test suite for the CascadeValidator service.
 * Tests grid validation, cascade step integrity, timing validation, and fraud detection.
 */

const CascadeValidator = require('../../src/services/CascadeValidator');
const SpinResult = require('../../src/models/SpinResult');
const CascadeStep = require('../../src/models/CascadeStep');
const GameSession = require('../../src/models/GameSession');

describe('CascadeValidator Service Functionality', () => {
  let validator;
  let mockGameSession;

  beforeEach(() => {
    validator = new CascadeValidator({
      timingTolerance: 1000,
      hashValidationEnabled: true,
      fraudDetectionEnabled: true
    });

    mockGameSession = new GameSession('test-session', 'test-player');
  });

  // ===========================================
  // Task 2.4.3: CascadeValidator Tests
  // ===========================================

  describe('Grid State Validation (Task 2.3.1)', () => {
    test('should validate correct grid structure', () => {
      const validGrid = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ];

      const result = validator.validateGridState(validGrid);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.gridHash).toBeDefined();
      expect(result.validationTime).toBeGreaterThan(0);
    });

    test('should reject invalid grid dimensions', () => {
      const invalidGrid = [
        ['time_gem', 'space_gem'],
        ['mind_gem', 'power_gem']
      ];

      const result = validator.validateGridState(invalidGrid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(validator.ERROR_CODES.INVALID_GRID_DIMENSIONS);
    });

    test('should reject non-array grid structure', () => {
      const invalidGrid = 'not an array';

      const result = validator.validateGridState(invalidGrid);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(validator.ERROR_CODES.INVALID_GRID_STRUCTURE);
    });

    test('should reject invalid symbols', () => {
      const gridWithInvalidSymbols = [
        ['invalid_symbol', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'another_invalid', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ];

      const result = validator.validateGridState(gridWithInvalidSymbols);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === validator.ERROR_CODES.INVALID_SYMBOLS)).toBe(true);
    });

    test('should detect floating symbols (physics violation)', () => {
      const gridWithFloatingSymbols = [
        ['time_gem', null, 'mind_gem', 'power_gem', 'reality_gem'],
        ['space_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ];

      const result = validator.validateGridState(gridWithFloatingSymbols);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PHYSICS')).toBe(true);
    });

    test('should generate consistent hashes for same grid', () => {
      const grid = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ];

      const hash1 = validator.generateGridHash(grid, 'salt');
      const hash2 = validator.generateGridHash(grid, 'salt');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    test('should generate different hashes for different grids', () => {
      const grid1 = [['time_gem', 'space_gem'], ['mind_gem', 'power_gem']];
      const grid2 = [['soul_gem', 'thanos_weapon'], ['scarlet_witch', 'thanos']];

      const hash1 = validator.generateGridHash(grid1, 'salt');
      const hash2 = validator.generateGridHash(grid2, 'salt');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Cascade Step Integrity Checking (Task 2.3.2)', () => {
    test('should validate correct cascade step structure', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
        ],
        gridStateAfter: [
          ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
        ]
      });

      // Add valid matched cluster
      cascadeStep.addMatchedCluster({
        symbolType: 'time_gem',
        positions: [
          { col: 0, row: 0 }, { col: 0, row: 1 }, { col: 0, row: 2 }, { col: 0, row: 3 },
          { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 1, row: 2 }, { col: 1, row: 3 }
        ],
        clusterSize: 8,
        payout: 10.0,
        multiplier: 1
      });

      const result = validator.validateCascadeStepIntegrity(cascadeStep);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validationTime).toBeGreaterThan(0);
    });

    test('should reject invalid step numbers', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: -1, // Invalid
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      const result = validator.validateCascadeStepIntegrity(cascadeStep);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === validator.ERROR_CODES.INVALID_SEQUENCE)).toBe(true);
    });

    test('should validate grid continuity between steps', () => {
      const previousStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      const currentStep = new CascadeStep({
        stepNumber: 1,
        gridStateBefore: [['space_gem']], // Should match previous gridStateAfter
        gridStateAfter: [['mind_gem']]
      });

      const result = validator.validateCascadeStepIntegrity(currentStep, previousStep);

      expect(result.isValid).toBe(true);
    });

    test('should detect grid continuity breaks', () => {
      const previousStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      const currentStep = new CascadeStep({
        stepNumber: 1,
        gridStateBefore: [['mind_gem']], // Does not match previous gridStateAfter
        gridStateAfter: [['power_gem']]
      });

      const result = validator.validateCascadeStepIntegrity(currentStep, previousStep);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === validator.ERROR_CODES.STEP_INTEGRITY_FAILURE)).toBe(true);
    });

    test('should validate matched clusters connectivity', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [
          ['time_gem', 'space_gem', 'mind_gem'],
          ['time_gem', 'space_gem', 'mind_gem'],
          ['time_gem', 'space_gem', 'mind_gem']
        ],
        gridStateAfter: [
          ['soul_gem', 'space_gem', 'mind_gem'],
          ['soul_gem', 'space_gem', 'mind_gem'],
          ['soul_gem', 'space_gem', 'mind_gem']
        ]
      });

      // Add disconnected cluster (should fail)
      cascadeStep.addMatchedCluster({
        symbolType: 'time_gem',
        positions: [
          { col: 0, row: 0 }, { col: 2, row: 2 } // Not connected
        ],
        clusterSize: 2,
        payout: 1.0,
        multiplier: 1
      });

      const result = validator.validateCascadeStepIntegrity(cascadeStep);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('not connected'))).toBe(true);
    });

    test('should reject clusters smaller than minimum size', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem', 'space_gem']],
        gridStateAfter: [['soul_gem', 'mind_gem']]
      });

      // Add cluster with less than 8 symbols
      cascadeStep.addMatchedCluster({
        symbolType: 'time_gem',
        positions: [
          { col: 0, row: 0 }, { col: 0, row: 1 }
        ],
        clusterSize: 2, // Too small
        payout: 1.0,
        multiplier: 1
      });

      const result = validator.validateCascadeStepIntegrity(cascadeStep);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Invalid cluster size'))).toBe(true);
    });

    test('should validate payout calculations', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      cascadeStep.addMatchedCluster({
        symbolType: 'time_gem',
        positions: Array.from({ length: 8 }, (_, i) => ({ col: 0, row: i % 5 })),
        clusterSize: 8,
        payout: 5.0,
        multiplier: 1
      });

      cascadeStep.winData.stepWin = 5.0; // Should match cluster payout

      const result = validator.validateCascadeStepIntegrity(cascadeStep);

      expect(result.isValid).toBe(true);
    });

    test('should detect payout manipulation', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      cascadeStep.addMatchedCluster({
        symbolType: 'time_gem',
        positions: Array.from({ length: 8 }, (_, i) => ({ col: 0, row: i % 5 })),
        clusterSize: 8,
        payout: -10.0, // Negative payout is invalid
        multiplier: 1
      });

      const result = validator.validateCascadeStepIntegrity(cascadeStep);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === validator.ERROR_CODES.PAYOUT_MANIPULATION)).toBe(true);
    });
  });

  describe('Timing Validation Mechanisms (Task 2.3.3)', () => {
    test('should validate correct step timing', () => {
      const stepTiming = {
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        matchDetectionTime: 200,
        removalAnimationTime: 300,
        dropAnimationTime: 400,
        settleDuration: 100
      };

      const result = validator.validateTiming({ stepTiming });

      expect(result.isValid).toBe(true);
      expect(result.timingAnalysis.stepTiming).toBeDefined();
    });

    test('should detect negative timing values', () => {
      const stepTiming = {
        startTime: -100, // Invalid
        endTime: 1000,
        duration: 1100
      };

      const result = validator.validateTiming({ stepTiming });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === validator.ERROR_CODES.TIMING_VALIDATION_FAILURE)).toBe(true);
    });

    test('should detect invalid timing sequences', () => {
      const stepTiming = {
        startTime: 2000,
        endTime: 1000, // End before start
        duration: -1000
      };

      const result = validator.validateTiming({ stepTiming });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('end before start'))).toBe(true);
    });

    test('should validate duration calculations', () => {
      const stepTiming = {
        startTime: 1000,
        endTime: 2000,
        duration: 500 // Should be 1000, not 500
      };

      const result = validator.validateTiming({ stepTiming });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duration mismatch'))).toBe(true);
    });

    test('should validate sequence timing progression', () => {
      const sequenceTiming = [
        {
          startTime: 0,
          endTime: 1000,
          duration: 1000
        },
        {
          startTime: 1000,
          endTime: 2000,
          duration: 1000
        },
        {
          startTime: 2000,
          endTime: 3000,
          duration: 1000
        }
      ];

      const result = validator.validateTiming({ sequenceTiming });

      expect(result.isValid).toBe(true);
      expect(result.timingAnalysis.sequenceTiming.sequenceIntegrity).toBe(true);
    });

    test('should detect overlapping steps in sequence', () => {
      const sequenceTiming = [
        {
          startTime: 0,
          endTime: 1000,
          duration: 1000
        },
        {
          startTime: 500, // Overlaps with previous step
          endTime: 1500,
          duration: 1000
        }
      ];

      const result = validator.validateTiming({ sequenceTiming });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Overlapping steps'))).toBe(true);
    });

    test('should validate client-server synchronization timing', () => {
      const clientTiming = { timestamp: Date.now() };
      const serverTimestamp = Date.now() + 50; // 50ms difference

      const result = validator.validateTiming(
        { syncTiming: clientTiming },
        { serverTimestamp }
      );

      expect(result.isValid).toBe(true);
      expect(result.timingAnalysis.syncTiming.withinTolerance).toBe(true);
    });

    test('should detect excessive client-server time differences', () => {
      const clientTiming = { timestamp: Date.now() };
      const serverTimestamp = Date.now() + 2000; // 2 seconds difference

      const result = validator.validateTiming(
        { syncTiming: clientTiming },
        { serverTimestamp }
      );

      expect(result.isValid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Fraud Detection Capabilities (Task 2.3.4)', () => {
    test('should detect impossible grid patterns', () => {
      // Create grid with perfect vertical line (suspicious)
      const suspiciousGrid = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
      ];

      const result = validator.detectGridFraud(suspiciousGrid);

      expect(result.suspicious).toBe(true);
      expect(result.fraudScore).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should detect artificial symbol distributions', () => {
      // Create too-perfect distribution
      const perfectGrid = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ];

      const analysis = validator.analyzeSymbolDistribution(perfectGrid);

      expect(analysis.suspicious).toBe(true);
      expect(analysis.uniformityScore).toBeLessThan(perfectGrid.length * perfectGrid[0].length * 0.1);
    });

    test('should detect repeated patterns', () => {
      // Create grid with many 2x2 repeated patterns
      const repeatedGrid = [
        ['time_gem', 'space_gem', 'time_gem', 'space_gem', 'time_gem'],
        ['mind_gem', 'power_gem', 'mind_gem', 'power_gem', 'mind_gem'],
        ['time_gem', 'space_gem', 'time_gem', 'space_gem', 'time_gem'],
        ['mind_gem', 'power_gem', 'mind_gem', 'power_gem', 'mind_gem'],
        ['time_gem', 'space_gem', 'time_gem', 'space_gem', 'time_gem'],
        ['mind_gem', 'power_gem', 'mind_gem', 'power_gem', 'mind_gem']
      ];

      const analysis = validator.detectRepeatedPatterns(repeatedGrid);

      expect(analysis.suspicious).toBe(true);
      expect(analysis.repeatedPatterns).toBeGreaterThan(3);
    });

    test('should detect perfect geometric clusters (fraud)', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      // Add perfect rectangle cluster (suspicious)
      cascadeStep.addMatchedCluster({
        symbolType: 'time_gem',
        positions: [
          { col: 0, row: 0 }, { col: 0, row: 1 },
          { col: 1, row: 0 }, { col: 1, row: 1 },
          { col: 2, row: 0 }, { col: 2, row: 1 },
          { col: 3, row: 0 }, { col: 3, row: 1 }
        ],
        clusterSize: 8,
        payout: 10.0,
        multiplier: 1
      });

      const analysis = validator.detectCascadeStepFraud(cascadeStep);

      expect(analysis.suspicious).toBe(true);
      expect(analysis.fraudScore).toBeGreaterThan(0);
    });

    test('should detect impossible payout amounts', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      cascadeStep.winData.stepWin = 1000; // Extremely high

      const analysis = validator.analyzePayoutPatterns(cascadeStep);

      expect(analysis.suspicious).toBe(true);
      expect(analysis.reasons.some(r => r.includes('high payout'))).toBe(true);
    });

    test('should detect timing manipulation', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      cascadeStep.timing = {
        duration: 50, // Too fast
        matchDetectionTime: 100,
        removalAnimationTime: 100,
        dropAnimationTime: 100,
        settleDuration: 100
      };

      const analysis = validator.analyzeTimingManipulation(cascadeStep);

      expect(analysis.suspicious).toBe(true);
      expect(analysis.reasons.some(r => r.includes('Too fast'))).toBe(true);
    });

    test('should detect artificial perfect timings', () => {
      const cascadeStep = new CascadeStep({
        stepNumber: 0,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      });

      cascadeStep.timing = {
        duration: 1000,
        matchDetectionTime: 100, // All perfect multiples of 100
        removalAnimationTime: 200,
        dropAnimationTime: 300,
        settleDuration: 400
      };

      const analysis = validator.analyzeTimingManipulation(cascadeStep);

      expect(analysis.suspicious).toBe(true);
      expect(analysis.reasons.some(r => r.includes('artificial'))).toBe(true);
    });
  });

  describe('Complete Spin Result Validation', () => {
    test('should validate complete legitimate spin result', () => {
      const spinResult = new SpinResult({
        spinId: 'test-spin-123',
        betAmount: 1.00,
        initialGrid: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
        ]
      });

      spinResult.totalWin = 5.0;
      spinResult.cascadeSteps = [];

      const result = validator.validateCompleteSpinResult(spinResult, mockGameSession);

      expect(result.isValid).toBe(true);
      expect(result.validationSummary.gridValidations).toBe(1);
      expect(result.validationTime).toBeGreaterThan(0);
    });

    test('should detect impossible win amounts', () => {
      const spinResult = new SpinResult({
        spinId: 'test-spin-123',
        betAmount: 1.00,
        initialGrid: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
        ]
      });

      spinResult.totalWin = 2000.0; // 2000x bet is impossible
      spinResult.cascadeSteps = [];

      const result = validator.validateCompleteSpinResult(spinResult, mockGameSession);

      expect(result.fraudScore).toBeGreaterThan(50);
      expect(result.warnings.some(w => w.message.includes('Impossible win amount'))).toBe(true);
    });

    test('should detect too many cascades', () => {
      const spinResult = new SpinResult({
        spinId: 'test-spin-123',
        betAmount: 1.00,
        initialGrid: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
          ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
        ]
      });

      // Add too many cascade steps
      spinResult.cascadeSteps = Array.from({ length: 15 }, (_, i) => new CascadeStep({
        stepNumber: i,
        gridStateBefore: [['time_gem']],
        gridStateAfter: [['space_gem']]
      }));

      const result = validator.validateCompleteSpinResult(spinResult, mockGameSession);

      expect(result.warnings.some(w => w.message.includes('Too many cascades'))).toBe(true);
    });
  });

  describe('Performance Metrics and Monitoring', () => {
    test('should track performance metrics', () => {
      const validGrid = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ];

      const initialMetrics = validator.getPerformanceMetrics();

      validator.validateGridState(validGrid);

      const updatedMetrics = validator.getPerformanceMetrics();

      expect(updatedMetrics.totalValidations).toBe(initialMetrics.totalValidations + 1);
      expect(updatedMetrics.successfulValidations).toBe(initialMetrics.successfulValidations + 1);
      expect(updatedMetrics.averageValidationTime).toBeGreaterThan(0);
    });

    test('should track fraud detection statistics', () => {
      const sessionId = 'test-session-123';

      validator.updateFraudDetectionStats(sessionId, 25);
      validator.updateFraudDetectionStats(sessionId, 75);

      const stats = validator.getFraudDetectionStats(sessionId);

      expect(stats.totalValidations).toBe(2);
      expect(stats.averageFraudScore).toBe(50);
      expect(stats.highFraudIncidents).toBe(1); // One score > 50
    });

    test('should create validation reports', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [{ message: 'Test warning' }],
        fraudScore: 10,
        validationTime: 100
      };

      const report = validator.createValidationReport(validationResult);

      expect(report.timestamp).toBeDefined();
      expect(report.status).toBe('VALID');
      expect(report.summary.totalWarnings).toBe(1);
      expect(report.summary.fraudScore).toBe(10);
      expect(report.metrics).toBeDefined();
    });

    test('should reset performance metrics', () => {
      // Perform some validations first
      validator.validateGridState([['time_gem']]);

      const metricsBeforeReset = validator.getPerformanceMetrics();
      expect(metricsBeforeReset.totalValidations).toBeGreaterThan(0);

      validator.resetPerformanceMetrics();

      const metricsAfterReset = validator.getPerformanceMetrics();
      expect(metricsAfterReset.totalValidations).toBe(0);
      expect(metricsAfterReset.successfulValidations).toBe(0);
      expect(metricsAfterReset.averageValidationTime).toBe(0);
    });

    test('should clear validation cache', () => {
      // Cache should be used internally, test that clearing doesn't crash
      validator.clearValidationCache();

      // Validation should still work after cache clear
      const result = validator.validateGridState([
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
      ]);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle validation errors gracefully', () => {
      // Test with null input
      const result = validator.validateGridState(null);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle empty grids', () => {
      const result = validator.validateGridState([]);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === validator.ERROR_CODES.INVALID_GRID_DIMENSIONS)).toBe(true);
    });

    test('should handle malformed cascade steps', () => {
      const malformedStep = {};

      const result = validator.validateCascadeStepIntegrity(malformedStep);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle disabled fraud detection', () => {
      const validatorNoFraud = new CascadeValidator({
        fraudDetectionEnabled: false
      });

      const suspiciousGrid = [
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem'],
        ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'time_gem']
      ];

      const result = validatorNoFraud.validateGridState(suspiciousGrid);

      expect(result.isValid).toBe(true); // Should pass basic validation
      expect(result.warnings).toHaveLength(0); // No fraud warnings
    });
  });
});