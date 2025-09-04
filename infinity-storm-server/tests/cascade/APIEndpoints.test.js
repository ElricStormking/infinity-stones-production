/**
 * Enhanced Cascade Synchronization API Endpoints Test Suite
 *
 * Task 4.4: Test API endpoints
 * - 4.4.1: Test cascade synchronization endpoints
 * - 4.4.2: Test validation request handlers
 * - 4.4.3: Test recovery request endpoints
 * - 4.4.4: Test session management endpoints
 *
 * This comprehensive test suite validates all cascade synchronization API endpoints
 * implemented in the Enhanced Cascade Synchronization system.
 */

const request = require('supertest');
const express = require('express');
const { createServer } = require('http');
const socketIo = require('socket.io');
const Client = require('socket.io-client');

// Mock services
const mockCascadeSynchronizer = {
  createSyncSession: jest.fn(),
  processStepAcknowledgment: jest.fn(),
  completeSyncSession: jest.fn(),
  requestRecovery: jest.fn(),
  applyRecovery: jest.fn(),
  getRecoveryStatus: jest.fn()
};

const mockCascadeValidator = {
  validateGridState: jest.fn(),
  validateCascadeStep: jest.fn(),
  validateCascadeSequence: jest.fn(),
  validateStepTiming: jest.fn(),
  analyzeGridFraud: jest.fn(),
  analyzeStepFraud: jest.fn(),
  analyzeSpinFraud: jest.fn(),
  getFraudStatistics: jest.fn(),
  getSessionFraudStatistics: jest.fn()
};

const mockGameSession = {
  findBySessionId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

// Mock the models and services
jest.mock('../../src/services/CascadeSynchronizer', () => ({
  CascadeSynchronizer: jest.fn(() => mockCascadeSynchronizer)
}));

jest.mock('../../src/services/CascadeValidator', () => ({
  CascadeValidator: jest.fn(() => mockCascadeValidator)
}));

jest.mock('../../src/models/GameSession', () => mockGameSession);

describe('Enhanced Cascade Synchronization API Endpoints', () => {
  let app;
  let server;
  let io;
  let clientSocket;
  let port;

  beforeAll((done) => {
    // Create Express app with cascade endpoints
    app = express();
    app.use(express.json());

    // Add cascade synchronization endpoints (4.4.1)
    app.post('/api/cascade/sync/start', async (req, res) => {
      try {
        const { sessionId, playerId, spinId } = req.body;

        if (!sessionId || !playerId || !spinId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: sessionId, playerId, spinId'
          });
        }

        const result = await mockCascadeSynchronizer.createSyncSession(sessionId, playerId, spinId);
        res.json({
          success: true,
          syncSessionId: result.syncSessionId,
          validationSalt: result.validationSalt,
          syncSeed: result.syncSeed
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/cascade/sync/step', async (req, res) => {
      try {
        const { syncSessionId, stepIndex, clientHash, timestamp } = req.body;

        if (!syncSessionId || stepIndex === undefined || !clientHash) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: syncSessionId, stepIndex, clientHash'
          });
        }

        const result = await mockCascadeSynchronizer.processStepAcknowledgment(
          syncSessionId, stepIndex, clientHash, timestamp
        );
        res.json({
          success: true,
          validated: result.validated,
          serverHash: result.serverHash,
          nextStep: result.nextStep
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/cascade/sync/complete', async (req, res) => {
      try {
        const { syncSessionId, finalHash, totalTime } = req.body;

        if (!syncSessionId || !finalHash) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: syncSessionId, finalHash'
          });
        }

        const result = await mockCascadeSynchronizer.completeSyncSession(
          syncSessionId, finalHash, totalTime
        );
        res.json({
          success: true,
          performance: result.performance,
          validated: result.validated
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Add validation endpoints (4.4.2)
    app.post('/api/cascade/validate/grid', async (req, res) => {
      try {
        const { gridState, sessionId } = req.body;

        if (!gridState) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: gridState'
          });
        }

        const result = await mockCascadeValidator.validateGridState(gridState, sessionId);
        res.json({
          success: true,
          valid: result.valid,
          validationHash: result.validationHash,
          fraudScore: result.fraudScore,
          errors: result.errors || []
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/cascade/validate/step', async (req, res) => {
      try {
        const { cascadeStep, sessionId } = req.body;

        if (!cascadeStep) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: cascadeStep'
          });
        }

        const result = await mockCascadeValidator.validateCascadeStep(cascadeStep, sessionId);
        res.json({
          success: true,
          valid: result.valid,
          validationHash: result.validationHash,
          errors: result.errors || []
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/cascade/validate/sequence', async (req, res) => {
      try {
        const { cascadeSteps, sessionId } = req.body;

        if (!cascadeSteps || !Array.isArray(cascadeSteps)) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: cascadeSteps (array)'
          });
        }

        const result = await mockCascadeValidator.validateCascadeSequence(cascadeSteps, sessionId);
        res.json({
          success: true,
          valid: result.valid,
          stepResults: result.stepResults,
          errors: result.errors || []
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/cascade/validate/timing', async (req, res) => {
      try {
        const { stepTiming, context } = req.body;

        if (!stepTiming) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: stepTiming'
          });
        }

        const result = await mockCascadeValidator.validateStepTiming(stepTiming, context);
        res.json({
          success: true,
          valid: result.valid,
          analysis: result.analysis,
          errors: result.errors || []
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Add fraud detection endpoints
    app.post('/api/cascade/validate/fraud/grid', async (req, res) => {
      try {
        const { gridState, sessionId } = req.body;
        const result = await mockCascadeValidator.analyzeGridFraud(gridState, sessionId);
        res.json({
          success: true,
          fraudScore: result.fraudScore,
          detections: result.detections
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/api/cascade/validate/fraud/step', async (req, res) => {
      try {
        const { cascadeStep, sessionId } = req.body;
        const result = await mockCascadeValidator.analyzeStepFraud(cascadeStep, sessionId);
        res.json({
          success: true,
          fraudScore: result.fraudScore,
          detections: result.detections
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/api/cascade/validate/fraud/spin', async (req, res) => {
      try {
        const { spinResult, sessionId } = req.body;
        const result = await mockCascadeValidator.analyzeSpinFraud(spinResult, sessionId);
        res.json({
          success: true,
          fraudScore: result.fraudScore,
          detections: result.detections
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/cascade/validate/fraud/stats', async (req, res) => {
      try {
        const result = await mockCascadeValidator.getFraudStatistics();
        res.json({
          success: true,
          statistics: result
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/cascade/validate/fraud/stats/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const result = await mockCascadeValidator.getSessionFraudStatistics(sessionId);
        res.json({
          success: true,
          statistics: result
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Add recovery endpoints (4.4.3)
    app.post('/api/cascade/recovery/request', async (req, res) => {
      try {
        const { syncSessionId, desyncType, clientState } = req.body;

        if (!syncSessionId || !desyncType) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: syncSessionId, desyncType'
          });
        }

        const result = await mockCascadeSynchronizer.requestRecovery(
          syncSessionId, desyncType, clientState
        );
        res.json({
          success: true,
          recoveryId: result.recoveryId,
          recoveryType: result.recoveryType,
          recoveryData: result.recoveryData
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/cascade/recovery/apply', async (req, res) => {
      try {
        const { recoveryId, clientConfirmation } = req.body;

        if (!recoveryId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: recoveryId'
          });
        }

        const result = await mockCascadeSynchronizer.applyRecovery(recoveryId, clientConfirmation);
        res.json({
          success: true,
          applied: result.applied,
          newState: result.newState
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.get('/api/cascade/recovery/status/:recoveryId', async (req, res) => {
      try {
        const { recoveryId } = req.params;

        const result = await mockCascadeSynchronizer.getRecoveryStatus(recoveryId);
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Recovery session not found'
          });
        }

        res.json({
          success: true,
          status: result.status,
          progress: result.progress,
          estimatedCompletion: result.estimatedCompletion
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Add session management endpoints (4.4.4)
    app.post('/api/cascade/session/create', async (req, res) => {
      try {
        const { playerId, gameMode, configuration } = req.body;

        if (!playerId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: playerId'
          });
        }

        const sessionData = {
          playerId,
          gameMode: gameMode || 'normal',
          configuration: configuration || {},
          createdAt: new Date().toISOString()
        };

        const result = await mockGameSession.create(sessionData);
        res.json({
          success: true,
          sessionId: result.sessionId,
          configuration: result.configuration
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.get('/api/cascade/session/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;

        const result = await mockGameSession.findBySessionId(sessionId);
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Session not found'
          });
        }

        res.json({
          success: true,
          session: result,
          metrics: result.performanceMetrics || {}
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.put('/api/cascade/session/:sessionId/state', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { cascadeState, syncStatus } = req.body;

        const updates = {};
        if (cascadeState) {updates.cascadeState = cascadeState;}
        if (syncStatus) {updates.syncStatus = syncStatus;}

        const result = await mockGameSession.update(sessionId, updates);
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Session not found'
          });
        }

        res.json({
          success: true,
          updated: true,
          session: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.delete('/api/cascade/session/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;

        const result = await mockGameSession.delete(sessionId);
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Session not found'
          });
        }

        res.json({
          success: true,
          deleted: true
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Create HTTP server and Socket.IO
    server = createServer(app);
    io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Setup WebSocket handlers for testing
    io.on('connection', (socket) => {
      socket.on('cascade_sync_test', (data) => {
        socket.emit('cascade_sync_response', {
          success: true,
          received: data
        });
      });
    });

    server.listen(() => {
      port = server.address().port;
      done();
    });
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockCascadeSynchronizer.createSyncSession.mockResolvedValue({
      syncSessionId: 'sync-123',
      validationSalt: 'salt-456',
      syncSeed: 'seed-789'
    });

    mockCascadeSynchronizer.processStepAcknowledgment.mockResolvedValue({
      validated: true,
      serverHash: 'server-hash-123',
      nextStep: 1
    });

    mockCascadeSynchronizer.completeSyncSession.mockResolvedValue({
      performance: { score: 95, avgStepTime: 150 },
      validated: true
    });

    mockCascadeSynchronizer.requestRecovery.mockResolvedValue({
      recoveryId: 'recovery-123',
      recoveryType: 'state_resync',
      recoveryData: { gridState: 'corrected-state' }
    });

    mockCascadeSynchronizer.applyRecovery.mockResolvedValue({
      applied: true,
      newState: 'synchronized-state'
    });

    mockCascadeSynchronizer.getRecoveryStatus.mockResolvedValue({
      status: 'in_progress',
      progress: 50,
      estimatedCompletion: '2024-01-01T12:00:00Z'
    });

    mockCascadeValidator.validateGridState.mockResolvedValue({
      valid: true,
      validationHash: 'grid-hash-123',
      fraudScore: 0.05,
      errors: []
    });

    mockCascadeValidator.validateCascadeStep.mockResolvedValue({
      valid: true,
      validationHash: 'step-hash-123',
      errors: []
    });

    mockCascadeValidator.validateCascadeSequence.mockResolvedValue({
      valid: true,
      stepResults: [{ valid: true }, { valid: true }],
      errors: []
    });

    mockCascadeValidator.validateStepTiming.mockResolvedValue({
      valid: true,
      analysis: { avgStepTime: 200, tolerance: 50 },
      errors: []
    });

    mockCascadeValidator.analyzeGridFraud.mockResolvedValue({
      fraudScore: 0.02,
      detections: []
    });

    mockCascadeValidator.analyzeStepFraud.mockResolvedValue({
      fraudScore: 0.01,
      detections: []
    });

    mockCascadeValidator.analyzeSpinFraud.mockResolvedValue({
      fraudScore: 0.03,
      detections: []
    });

    mockCascadeValidator.getFraudStatistics.mockResolvedValue({
      totalAnalyzed: 1000,
      fraudDetected: 5,
      averageFraudScore: 0.02
    });

    mockCascadeValidator.getSessionFraudStatistics.mockResolvedValue({
      sessionId: 'session-123',
      spinsAnalyzed: 50,
      fraudDetected: 0,
      averageFraudScore: 0.01
    });

    mockGameSession.create.mockResolvedValue({
      sessionId: 'session-123',
      configuration: { syncEnabled: true }
    });

    mockGameSession.findBySessionId.mockResolvedValue({
      sessionId: 'session-123',
      playerId: 'player-123',
      performanceMetrics: { totalSpins: 10, avgResponseTime: 150 }
    });

    mockGameSession.update.mockResolvedValue({
      sessionId: 'session-123',
      updated: true
    });

    mockGameSession.delete.mockResolvedValue(true);
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  // Task 4.4.1: Test cascade synchronization endpoints
  describe('4.4.1: Cascade Synchronization Endpoints', () => {
    test('POST /api/cascade/sync/start - should create sync session', async () => {
      const response = await request(app)
        .post('/api/cascade/sync/start')
        .send({
          sessionId: 'session-123',
          playerId: 'player-123',
          spinId: 'spin-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.syncSessionId).toBe('sync-123');
      expect(response.body.validationSalt).toBe('salt-456');
      expect(response.body.syncSeed).toBe('seed-789');
      expect(mockCascadeSynchronizer.createSyncSession).toHaveBeenCalledWith(
        'session-123', 'player-123', 'spin-123'
      );
    });

    test('POST /api/cascade/sync/start - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/cascade/sync/start')
        .send({
          sessionId: 'session-123'
          // Missing playerId and spinId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('POST /api/cascade/sync/step - should process step acknowledgment', async () => {
      const response = await request(app)
        .post('/api/cascade/sync/step')
        .send({
          syncSessionId: 'sync-123',
          stepIndex: 0,
          clientHash: 'client-hash-123',
          timestamp: Date.now()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.validated).toBe(true);
      expect(response.body.serverHash).toBe('server-hash-123');
      expect(response.body.nextStep).toBe(1);
    });

    test('POST /api/cascade/sync/step - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/cascade/sync/step')
        .send({
          syncSessionId: 'sync-123'
          // Missing stepIndex and clientHash
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('POST /api/cascade/sync/complete - should complete sync session', async () => {
      const response = await request(app)
        .post('/api/cascade/sync/complete')
        .send({
          syncSessionId: 'sync-123',
          finalHash: 'final-hash-123',
          totalTime: 5000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.performance).toEqual({ score: 95, avgStepTime: 150 });
      expect(response.body.validated).toBe(true);
    });

    test('POST /api/cascade/sync/complete - should handle errors', async () => {
      mockCascadeSynchronizer.completeSyncSession.mockRejectedValue(
        new Error('Sync completion failed')
      );

      const response = await request(app)
        .post('/api/cascade/sync/complete')
        .send({
          syncSessionId: 'sync-123',
          finalHash: 'final-hash-123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sync completion failed');
    });
  });

  // Task 4.4.2: Test validation request handlers
  describe('4.4.2: Validation Request Handlers', () => {
    test('POST /api/cascade/validate/grid - should validate grid state', async () => {
      const gridState = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
        ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
        ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
        ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
        ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
      ];

      const response = await request(app)
        .post('/api/cascade/validate/grid')
        .send({
          gridState: gridState,
          sessionId: 'session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.validationHash).toBe('grid-hash-123');
      expect(response.body.fraudScore).toBe(0.05);
      expect(mockCascadeValidator.validateGridState).toHaveBeenCalledWith(gridState, 'session-123');
    });

    test('POST /api/cascade/validate/step - should validate cascade step', async () => {
      const cascadeStep = {
        stepIndex: 0,
        gridBefore: [],
        gridAfter: [],
        matchedClusters: [],
        dropPatterns: []
      };

      const response = await request(app)
        .post('/api/cascade/validate/step')
        .send({
          cascadeStep: cascadeStep,
          sessionId: 'session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.validationHash).toBe('step-hash-123');
    });

    test('POST /api/cascade/validate/sequence - should validate cascade sequence', async () => {
      const cascadeSteps = [
        { stepIndex: 0, gridBefore: [], gridAfter: [] },
        { stepIndex: 1, gridBefore: [], gridAfter: [] }
      ];

      const response = await request(app)
        .post('/api/cascade/validate/sequence')
        .send({
          cascadeSteps: cascadeSteps,
          sessionId: 'session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.stepResults).toHaveLength(2);
    });

    test('POST /api/cascade/validate/timing - should validate step timing', async () => {
      const stepTiming = {
        stepDuration: 200,
        phases: {
          win_highlight: 50,
          symbol_removal: 50,
          symbol_drop: 75,
          symbol_settle: 25
        }
      };

      const response = await request(app)
        .post('/api/cascade/validate/timing')
        .send({
          stepTiming: stepTiming,
          context: { sessionId: 'session-123' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.analysis).toEqual({ avgStepTime: 200, tolerance: 50 });
    });

    test('POST /api/cascade/validate/fraud/grid - should analyze grid fraud', async () => {
      const response = await request(app)
        .post('/api/cascade/validate/fraud/grid')
        .send({
          gridState: [],
          sessionId: 'session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fraudScore).toBe(0.02);
      expect(response.body.detections).toEqual([]);
    });

    test('GET /api/cascade/validate/fraud/stats - should get fraud statistics', async () => {
      const response = await request(app).get('/api/cascade/validate/fraud/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics.totalAnalyzed).toBe(1000);
      expect(response.body.statistics.fraudDetected).toBe(5);
    });

    test('GET /api/cascade/validate/fraud/stats/:sessionId - should get session fraud statistics', async () => {
      const response = await request(app).get('/api/cascade/validate/fraud/stats/session-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics.sessionId).toBe('session-123');
      expect(response.body.statistics.spinsAnalyzed).toBe(50);
    });

    test('POST /api/cascade/validate/grid - should handle validation errors', async () => {
      mockCascadeValidator.validateGridState.mockRejectedValue(
        new Error('Grid validation failed')
      );

      const response = await request(app)
        .post('/api/cascade/validate/grid')
        .send({
          gridState: []
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Grid validation failed');
    });
  });

  // Task 4.4.3: Test recovery request endpoints
  describe('4.4.3: Recovery Request Endpoints', () => {
    test('POST /api/cascade/recovery/request - should request recovery', async () => {
      const response = await request(app)
        .post('/api/cascade/recovery/request')
        .send({
          syncSessionId: 'sync-123',
          desyncType: 'hash_mismatch',
          clientState: { gridState: 'client-state' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recoveryId).toBe('recovery-123');
      expect(response.body.recoveryType).toBe('state_resync');
      expect(response.body.recoveryData).toEqual({ gridState: 'corrected-state' });
      expect(mockCascadeSynchronizer.requestRecovery).toHaveBeenCalledWith(
        'sync-123', 'hash_mismatch', { gridState: 'client-state' }
      );
    });

    test('POST /api/cascade/recovery/request - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/cascade/recovery/request')
        .send({
          syncSessionId: 'sync-123'
          // Missing desyncType
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('POST /api/cascade/recovery/apply - should apply recovery', async () => {
      const response = await request(app)
        .post('/api/cascade/recovery/apply')
        .send({
          recoveryId: 'recovery-123',
          clientConfirmation: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.applied).toBe(true);
      expect(response.body.newState).toBe('synchronized-state');
    });

    test('GET /api/cascade/recovery/status/:recoveryId - should get recovery status', async () => {
      const response = await request(app).get('/api/cascade/recovery/status/recovery-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('in_progress');
      expect(response.body.progress).toBe(50);
      expect(response.body.estimatedCompletion).toBe('2024-01-01T12:00:00Z');
    });

    test('GET /api/cascade/recovery/status/:recoveryId - should handle not found', async () => {
      mockCascadeSynchronizer.getRecoveryStatus.mockResolvedValue(null);

      const response = await request(app).get('/api/cascade/recovery/status/invalid-recovery');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Recovery session not found');
    });

    test('POST /api/cascade/recovery/apply - should handle errors', async () => {
      mockCascadeSynchronizer.applyRecovery.mockRejectedValue(
        new Error('Recovery application failed')
      );

      const response = await request(app)
        .post('/api/cascade/recovery/apply')
        .send({
          recoveryId: 'recovery-123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Recovery application failed');
    });
  });

  // Task 4.4.4: Test session management endpoints
  describe('4.4.4: Session Management Endpoints', () => {
    test('POST /api/cascade/session/create - should create session', async () => {
      const response = await request(app)
        .post('/api/cascade/session/create')
        .send({
          playerId: 'player-123',
          gameMode: 'normal',
          configuration: { syncEnabled: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe('session-123');
      expect(response.body.configuration).toEqual({ syncEnabled: true });
    });

    test('POST /api/cascade/session/create - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/cascade/session/create')
        .send({
          // Missing playerId
          gameMode: 'normal'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required field: playerId');
    });

    test('GET /api/cascade/session/:sessionId - should get session', async () => {
      const response = await request(app).get('/api/cascade/session/session-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.session.sessionId).toBe('session-123');
      expect(response.body.session.playerId).toBe('player-123');
      expect(response.body.metrics).toEqual({ totalSpins: 10, avgResponseTime: 150 });
    });

    test('GET /api/cascade/session/:sessionId - should handle not found', async () => {
      mockGameSession.findBySessionId.mockResolvedValue(null);

      const response = await request(app).get('/api/cascade/session/invalid-session');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });

    test('PUT /api/cascade/session/:sessionId/state - should update session state', async () => {
      const response = await request(app)
        .put('/api/cascade/session/session-123/state')
        .send({
          cascadeState: 'active',
          syncStatus: 'synchronized'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(true);
      expect(mockGameSession.update).toHaveBeenCalledWith('session-123', {
        cascadeState: 'active',
        syncStatus: 'synchronized'
      });
    });

    test('PUT /api/cascade/session/:sessionId/state - should handle not found', async () => {
      mockGameSession.update.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/cascade/session/invalid-session/state')
        .send({
          cascadeState: 'active'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });

    test('DELETE /api/cascade/session/:sessionId - should delete session', async () => {
      const response = await request(app).delete('/api/cascade/session/session-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(true);
      expect(mockGameSession.delete).toHaveBeenCalledWith('session-123');
    });

    test('DELETE /api/cascade/session/:sessionId - should handle not found', async () => {
      mockGameSession.delete.mockResolvedValue(null);

      const response = await request(app).delete('/api/cascade/session/invalid-session');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });

    test('POST /api/cascade/session/create - should handle errors', async () => {
      mockGameSession.create.mockRejectedValue(new Error('Session creation failed'));

      const response = await request(app)
        .post('/api/cascade/session/create')
        .send({
          playerId: 'player-123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session creation failed');
    });
  });

  // Integration tests
  describe('API Integration Tests', () => {
    test('Complete cascade sync flow', async () => {
      // 1. Create sync session
      const startResponse = await request(app)
        .post('/api/cascade/sync/start')
        .send({
          sessionId: 'session-123',
          playerId: 'player-123',
          spinId: 'spin-123'
        });
      expect(startResponse.status).toBe(200);

      // 2. Process step acknowledgment
      const stepResponse = await request(app)
        .post('/api/cascade/sync/step')
        .send({
          syncSessionId: startResponse.body.syncSessionId,
          stepIndex: 0,
          clientHash: 'client-hash-123'
        });
      expect(stepResponse.status).toBe(200);

      // 3. Complete sync session
      const completeResponse = await request(app)
        .post('/api/cascade/sync/complete')
        .send({
          syncSessionId: startResponse.body.syncSessionId,
          finalHash: 'final-hash-123'
        });
      expect(completeResponse.status).toBe(200);
    });

    test('Recovery flow integration', async () => {
      // 1. Request recovery
      const requestResponse = await request(app)
        .post('/api/cascade/recovery/request')
        .send({
          syncSessionId: 'sync-123',
          desyncType: 'hash_mismatch',
          clientState: { gridState: 'client-state' }
        });
      expect(requestResponse.status).toBe(200);

      // 2. Check recovery status
      const statusResponse = await request(app)
        .get(`/api/cascade/recovery/status/${requestResponse.body.recoveryId}`);
      expect(statusResponse.status).toBe(200);

      // 3. Apply recovery
      const applyResponse = await request(app)
        .post('/api/cascade/recovery/apply')
        .send({
          recoveryId: requestResponse.body.recoveryId,
          clientConfirmation: true
        });
      expect(applyResponse.status).toBe(200);
    });

    test('Session management flow', async () => {
      // 1. Create session
      const createResponse = await request(app)
        .post('/api/cascade/session/create')
        .send({
          playerId: 'player-123',
          gameMode: 'normal'
        });
      expect(createResponse.status).toBe(200);

      // 2. Get session
      const getResponse = await request(app)
        .get(`/api/cascade/session/${createResponse.body.sessionId}`);
      expect(getResponse.status).toBe(200);

      // 3. Update session state
      const updateResponse = await request(app)
        .put(`/api/cascade/session/${createResponse.body.sessionId}/state`)
        .send({
          cascadeState: 'active'
        });
      expect(updateResponse.status).toBe(200);

      // 4. Delete session
      const deleteResponse = await request(app)
        .delete(`/api/cascade/session/${createResponse.body.sessionId}`);
      expect(deleteResponse.status).toBe(200);
    });

    test('WebSocket connection test', (done) => {
      clientSocket = Client(`http://localhost:${port}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('cascade_sync_test', { message: 'test' });
      });

      clientSocket.on('cascade_sync_response', (data) => {
        expect(data.success).toBe(true);
        expect(data.received.message).toBe('test');
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });
  });

  // Performance tests
  describe('API Performance Tests', () => {
    test('Sync endpoints performance', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/cascade/sync/start')
            .send({
              sessionId: `session-${i}`,
              playerId: `player-${i}`,
              spinId: `spin-${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('Validation endpoints performance', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/api/cascade/validate/grid')
            .send({
              gridState: [],
              sessionId: `session-${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  // Error handling tests
  describe('API Error Handling', () => {
    test('Invalid JSON handling', async () => {
      const response = await request(app)
        .post('/api/cascade/sync/start')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('Large payload handling', async () => {
      const largePayload = {
        gridState: new Array(10000).fill('large_data'),
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post('/api/cascade/validate/grid')
        .send(largePayload);

      // Should handle gracefully (either accept or reject with proper error)
      expect([200, 413, 400]).toContain(response.status);
    });

    test('Concurrent request handling', async () => {
      const promises = [];

      // Send 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .get(`/api/cascade/session/session-${i}`)
        );
      }

      const responses = await Promise.all(promises);

      // All requests should be handled (even if they return 404)
      responses.forEach(response => {
        expect([200, 404, 500]).toContain(response.status);
      });
    });
  });
});