/**
 * State Management System Tests
 *
 * Comprehensive tests for the game state management system including:
 * - State Manager functionality
 * - Anti-Cheat detection
 * - State Validator rules
 * - Audit Logger compliance
 */

const StateManager = require('../../src/game/stateManager');
const AntiCheat = require('../../src/game/antiCheat');
const StateValidator = require('../../src/game/stateValidator');
const AuditLogger = require('../../src/game/auditLogger');
const { GameState, Player, Session } = require('../../src/models');

// Mock Redis for testing
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    scard: jest.fn().mockResolvedValue(0),
    zadd: jest.fn(),
    zremrangebyscore: jest.fn(),
    zrangebyscore: jest.fn().mockResolvedValue([]),
    zrevrange: jest.fn().mockResolvedValue([])
  })
}));

describe('Game State Management System', () => {
  let stateManager;
  let antiCheat;
  let stateValidator;
  let auditLogger;

  beforeAll(async () => {
    // Initialize test components
    stateManager = new StateManager();
    antiCheat = new AntiCheat();
    stateValidator = new StateValidator();
    auditLogger = new AuditLogger({ logDir: './test-logs' });

    // Allow initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up
    if (auditLogger) {
      await auditLogger.close();
    }
    if (stateManager) {
      await stateManager.shutdown();
    }
  });

  describe('StateManager', () => {
    const mockPlayerId = 'player-123';
    const mockSessionId = 'session-456';

    beforeEach(() => {
      // Clear any cached data
      stateManager.stateCache.clear();
      stateManager.activeSessions.clear();
    });

    test('should initialize correctly', () => {
      expect(stateManager).toBeDefined();
      expect(stateManager.stateCache).toBeDefined();
      expect(stateManager.activeSessions).toBeDefined();
      expect(stateManager.antiCheat).toBeDefined();
      expect(stateManager.stateValidator).toBeDefined();
      expect(stateManager.auditLogger).toBeDefined();
    });

    test('should validate session creation parameters', async () => {
      const mockClientData = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screenResolution: '1920x1080',
        timezone: 'America/New_York'
      };

      // Mock database calls
      Player.findByPk = jest.fn().mockResolvedValue({
        id: mockPlayerId,
        username: 'testplayer',
        balance: 1000
      });

      GameState.getCurrentState = jest.fn().mockResolvedValue(null);
      GameState.create = jest.fn().mockResolvedValue({
        id: 'state-789',
        player_id: mockPlayerId,
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00,
        state_data: {},
        getSafeData: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'base',
          free_spins_remaining: 0,
          accumulated_multiplier: 1.00
        }),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'base'
        })
      });

      Session.create = jest.fn().mockResolvedValue({
        id: mockSessionId,
        player_id: mockPlayerId,
        toJSON: () => ({
          id: mockSessionId,
          player_id: mockPlayerId
        })
      });

      // Test session creation
      const result = await stateManager.createOrResumeSession(
        mockPlayerId,
        null,
        mockClientData
      );

      expect(result).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.gameState).toBeDefined();
      expect(result.validationChecks).toBeDefined();
      expect(result.validationChecks.stateValidation).toBeDefined();
      expect(result.validationChecks.antiCheatValidation).toBeDefined();
    });

    test('should handle state updates with validation', async () => {
      const mockGameState = {
        id: 'state-789',
        player_id: mockPlayerId,
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00,
        state_data: {},
        toJSON: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'base',
          free_spins_remaining: 0,
          accumulated_multiplier: 1.00
        }),
        save: jest.fn().mockResolvedValue(true),
        getSafeData: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'base',
          free_spins_remaining: 0,
          accumulated_multiplier: 1.00
        })
      };

      stateManager.getPlayerState = jest.fn().mockResolvedValue(mockGameState);

      const stateUpdates = {
        game_mode: 'free_spins',
        free_spins_remaining: 10,
        accumulated_multiplier: 2.50
      };

      const result = await stateManager.updateState(
        mockPlayerId,
        stateUpdates,
        'free_spins_awarded'
      );

      expect(result).toBeDefined();
      expect(result.game_mode).toBe('free_spins');
      expect(result.free_spins_remaining).toBe(10);
      expect(result.accumulated_multiplier).toBe(2.50);
    });

    test('should process spin results correctly', async () => {
      const mockGameState = {
        id: 'state-789',
        player_id: mockPlayerId,
        game_mode: 'free_spins',
        free_spins_remaining: 5,
        accumulated_multiplier: 2.00,
        state_data: {},
        isInFreeSpins: () => true,
        toJSON: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'free_spins'
        }),
        save: jest.fn().mockResolvedValue(true),
        getSafeData: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'free_spins',
          free_spins_remaining: 4,
          accumulated_multiplier: 2.50
        })
      };

      const mockSpinResult = {
        id: 'spin-123',
        totalWin: 150,
        multiplier: 0.50,
        features: {}
      };

      stateManager.getPlayerState = jest.fn().mockResolvedValue(mockGameState);
      stateManager.updateState = jest.fn().mockResolvedValue({
        ...mockGameState,
        free_spins_remaining: 4,
        accumulated_multiplier: 2.50,
        getSafeData: () => ({
          id: 'state-789',
          player_id: mockPlayerId,
          game_mode: 'free_spins',
          free_spins_remaining: 4,
          accumulated_multiplier: 2.50
        })
      });

      const result = await stateManager.processSpinResult(mockPlayerId, mockSpinResult);

      expect(result).toBeDefined();
      expect(result.gameState).toBeDefined();
      expect(result.stateUpdates).toBeDefined();
      expect(result.spinResult).toBe(mockSpinResult);
    });
  });

  describe('AntiCheat', () => {
    test('should initialize with proper configuration', () => {
      expect(antiCheat).toBeDefined();
      expect(antiCheat.riskThresholds).toBeDefined();
      expect(antiCheat.detectionPatterns).toBeDefined();
      expect(antiCheat.playerProfiles).toBeDefined();
    });

    test('should validate session start parameters', async () => {
      const mockClientData = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screenResolution: '1920x1080',
        plugins: ['Plugin1', 'Plugin2'],
        languages: ['en-US', 'en']
      };

      const mockGameState = {
        game_mode: 'base',
        accumulated_multiplier: 1.00,
        free_spins_remaining: 0
      };

      const result = await antiCheat.validateSessionStart(
        'player-123',
        mockGameState,
        mockClientData
      );

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.riskScore).toBeDefined();
    });

    test('should detect suspicious user agents', () => {
      expect(antiCheat.isSuspiciousUserAgent('HeadlessChrome')).toBe(true);
      expect(antiCheat.isSuspiciousUserAgent('PhantomJS')).toBe(true);
      expect(antiCheat.isSuspiciousUserAgent('Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
    });

    test('should validate multiplier changes', () => {
      expect(antiCheat.validateMultiplierChange(1.00, 3.50)).toBeNull();
      expect(antiCheat.validateMultiplierChange(1.00, 10.00)).toBe('excessive_multiplier_increase');
      expect(antiCheat.validateMultiplierChange(2.00, 0.50)).toBe('invalid_multiplier_value');
    });

    test('should validate free spins changes', () => {
      expect(antiCheat.validateFreeSpinsChange(0, 10, 'free_spins_awarded')).toBeNull();
      expect(antiCheat.validateFreeSpinsChange(10, 9, 'spin_result')).toBeNull();
      expect(antiCheat.validateFreeSpinsChange(0, 100, 'free_spins_awarded')).toBe('excessive_free_spins_increase');
      expect(antiCheat.validateFreeSpinsChange(5, -1, 'other')).toBe('negative_free_spins');
    });

    test('should validate game mode transitions', () => {
      expect(antiCheat.validateGameModeTransition('base', 'free_spins', 0)).toBeNull();
      expect(antiCheat.validateGameModeTransition('free_spins', 'base', 0)).toBeNull();
      expect(antiCheat.validateGameModeTransition('base', 'invalid_mode', 0)).toBe('invalid_game_mode_transition');
      expect(antiCheat.validateGameModeTransition('free_spins', 'base', 5)).toBe('base_mode_with_free_spins');
    });

    test('should calculate player risk scores', async () => {
      const violations = ['rapid_fire_spinning', 'automation_detected'];
      const riskScore = await antiCheat.calculateRiskScore('player-123', violations);

      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('StateValidator', () => {
    test('should initialize with validation rules', () => {
      expect(stateValidator).toBeDefined();
      expect(stateValidator.validationRules).toBeDefined();
      expect(stateValidator.validationContexts).toBeDefined();
      expect(stateValidator.errorSeverity).toBeDefined();
    });

    test('should validate game state structure', async () => {
      const validGameState = {
        player_id: 'player-123',
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00,
        state_data: {}
      };

      const result = await stateValidator.validateState(validGameState);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should detect invalid game state structure', async () => {
      const invalidGameState = {
        player_id: 'player-123',
        game_mode: 'invalid_mode',
        free_spins_remaining: -5,
        accumulated_multiplier: 0.50,
        state_data: {}
      };

      const result = await stateValidator.validateState(invalidGameState);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate state transitions', async () => {
      const currentState = {
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00
      };

      const validUpdates = {
        game_mode: 'free_spins',
        free_spins_remaining: 10,
        accumulated_multiplier: 2.00
      };

      const result = await stateValidator.validateStateTransition(
        currentState,
        validUpdates,
        'free_spins_awarded'
      );

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should detect invalid transitions', async () => {
      const currentState = {
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00
      };

      const invalidUpdates = {
        game_mode: 'bonus',
        free_spins_remaining: -1,
        accumulated_multiplier: 15.00
      };

      const result = await stateValidator.validateStateTransition(
        currentState,
        invalidUpdates,
        'invalid_reason'
      );

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate multiplier precision', () => {
      expect(stateValidator.getDecimalPlaces(1.00)).toBe(2);
      expect(stateValidator.getDecimalPlaces(2.5)).toBe(1);
      expect(stateValidator.getDecimalPlaces(3.123)).toBe(3);
    });

    test('should find closest valid values', () => {
      const validValues = [5, 8, 10, 12, 15, 20];
      expect(stateValidator.findClosestValidValue(7, validValues)).toBe(8);
      expect(stateValidator.findClosestValidValue(11, validValues)).toBe(10);
      expect(stateValidator.findClosestValidValue(18, validValues)).toBe(20);
    });
  });

  describe('AuditLogger', () => {
    test('should initialize with configuration', () => {
      expect(auditLogger).toBeDefined();
      expect(auditLogger.config).toBeDefined();
      expect(auditLogger.logLevels).toBeDefined();
      expect(auditLogger.logFiles).toBeDefined();
      expect(auditLogger.metrics).toBeDefined();
    });

    test('should format log entries correctly', () => {
      const mockEntry = {
        id: 'log-123',
        timestamp: new Date().toISOString(),
        level: 'INFO',
        category: 'test',
        event_type: 'test_event',
        player_id: 'player-123',
        data: { test: 'data' },
        source: 'test',
        compliance_required: true
      };

      const formatted = auditLogger.formatLogEntry(mockEntry);
      const parsed = JSON.parse(formatted);

      expect(parsed).toBeDefined();
      expect(parsed.id).toBe(mockEntry.id);
      expect(parsed.level).toBe(mockEntry.level);
      expect(parsed.compliance_required).toBe(true);
    });

    test('should generate integrity hashes', () => {
      const testData = { test: 'data', number: 123 };
      const hash = auditLogger.generateIntegrityHash(testData);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hash length
    });

    test('should log session events', async () => {
      const logSpy = jest.spyOn(auditLogger, 'writeAuditLog').mockResolvedValue();

      await auditLogger.logSessionEvent(
        'player-123',
        'session-456',
        'session_created',
        { test: 'data' }
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'AUDIT',
          category: 'session',
          event_type: 'session_created',
          player_id: 'player-123',
          session_id: 'session-456'
        })
      );

      logSpy.mockRestore();
    });

    test('should log state updates', async () => {
      const logSpy = jest.spyOn(auditLogger, 'writeAuditLog').mockResolvedValue();
      const updateChainSpy = jest.spyOn(auditLogger, 'updateAuditChain').mockResolvedValue();

      const stateSnapshot = {
        before: { game_mode: 'base' },
        updates: { game_mode: 'free_spins' },
        after: { game_mode: 'free_spins' }
      };

      await auditLogger.logStateUpdate('player-123', stateSnapshot);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'AUDIT',
          category: 'state',
          event_type: 'state_updated',
          player_id: 'player-123'
        })
      );

      expect(updateChainSpy).toHaveBeenCalled();

      logSpy.mockRestore();
      updateChainSpy.mockRestore();
    });

    test('should get statistics', () => {
      const stats = auditLogger.getStats();

      expect(stats).toBeDefined();
      expect(stats.logsWritten).toBeDefined();
      expect(stats.bytesLogged).toBeDefined();
      expect(stats.buffer_size).toBeDefined();
      expect(stats.config).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should integrate all components correctly', async () => {
      // Test that all components work together
      const testPlayerId = 'integration-player-123';
      const testClientData = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screenResolution: '1920x1080',
        plugins: ['Plugin1'],
        languages: ['en-US']
      };

      // Mock database calls for integration test
      Player.findByPk = jest.fn().mockResolvedValue({
        id: testPlayerId,
        username: 'integrationtest'
      });

      GameState.getCurrentState = jest.fn().mockResolvedValue({
        id: 'state-integration',
        player_id: testPlayerId,
        game_mode: 'base',
        free_spins_remaining: 0,
        accumulated_multiplier: 1.00,
        state_data: {},
        toJSON: () => ({
          id: 'state-integration',
          player_id: testPlayerId,
          game_mode: 'base'
        }),
        getSafeData: () => ({
          id: 'state-integration',
          player_id: testPlayerId,
          game_mode: 'base'
        }),
        save: jest.fn().mockResolvedValue(true)
      });

      Session.create = jest.fn().mockResolvedValue({
        id: 'session-integration',
        player_id: testPlayerId,
        toJSON: () => ({
          id: 'session-integration',
          player_id: testPlayerId
        })
      });

      // Test session creation with all validation layers
      const sessionResult = await stateManager.createOrResumeSession(
        testPlayerId,
        null,
        testClientData
      );

      expect(sessionResult).toBeDefined();
      expect(sessionResult.validationChecks).toBeDefined();
      expect(sessionResult.validationChecks.stateValidation).toBeDefined();
      expect(sessionResult.validationChecks.antiCheatValidation).toBeDefined();

      // Verify that all validation passes for a legitimate session
      expect(sessionResult.validationChecks.stateValidation.valid).toBe(true);
      expect(sessionResult.validationChecks.antiCheatValidation.valid).toBe(true);
    });

    test('should detect and prevent cheating attempts', async () => {
      const suspiciousClientData = {
        userAgent: 'HeadlessChrome/91.0.4472.101',
        screenResolution: '1920x1080',
        webdriver: true,
        automation: true
      };

      const result = await antiCheat.validateSessionStart(
        'cheater-player',
        { game_mode: 'base', accumulated_multiplier: 1.00, free_spins_remaining: 0 },
        suspiciousClientData
      );

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThan(antiCheat.riskThresholds.LOW);
    });

    test('should maintain audit trail consistency', async () => {
      // Test that audit chain maintains integrity
      const testEntry = {
        id: 'test-audit-123',
        timestamp: new Date().toISOString(),
        level: 'AUDIT',
        category: 'test',
        event_type: 'test_audit_chain'
      };

      const initialChainLength = auditLogger.auditChain.length;
      const initialHash = auditLogger.lastAuditHash;

      await auditLogger.updateAuditChain(testEntry);

      expect(auditLogger.auditChain.length).toBe(initialChainLength + 1);
      expect(auditLogger.lastAuditHash).not.toBe(initialHash);

      const latestEntry = auditLogger.auditChain[auditLogger.auditChain.length - 1];
      expect(latestEntry).toBeDefined();
      expect(latestEntry.id).toBe(testEntry.id);
      expect(latestEntry.previous_hash).toBe(initialHash);
    });
  });
});

module.exports = {
  StateManager,
  AntiCheat,
  StateValidator,
  AuditLogger
};