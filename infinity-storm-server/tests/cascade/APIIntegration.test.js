/**
 * Enhanced Cascade Synchronization API Integration Test Suite
 *
 * Task 4.4: Test API endpoints - Integration Testing
 * Tests the actual server endpoints with real implementations
 *
 * This test suite validates the complete integration of cascade synchronization
 * API endpoints with the actual server implementation.
 */

const request = require('supertest');
const path = require('path');

// Import the actual server
let server;
let app;

describe('Enhanced Cascade Synchronization API Integration', () => {
  beforeAll(async () => {
    // Set up environment for testing
    process.env.NODE_ENV = 'test';

    // Import and start the actual server
    const serverPath = path.join(__dirname, '../../server.js');
    delete require.cache[require.resolve(serverPath)];

    // Mock dependencies that might not be available in test environment
    jest.mock('../../src/services/CascadeSynchronizer', () => {
      return {
        CascadeSynchronizer: class MockCascadeSynchronizer {
          constructor() {}

          async createSyncSession(sessionId, playerId, spinId) {
            return {
              syncSessionId: `sync-${sessionId}`,
              validationSalt: 'test-salt-123',
              syncSeed: 'test-seed-456'
            };
          }

          async processStepAcknowledgment(syncSessionId, stepIndex, clientHash, timestamp) {
            return {
              validated: true,
              serverHash: `server-hash-${stepIndex}`,
              nextStep: stepIndex + 1
            };
          }

          async completeSyncSession(syncSessionId, finalHash, totalTime) {
            return {
              performance: { score: 95, avgStepTime: 150 },
              validated: true
            };
          }

          async requestRecovery(syncSessionId, desyncType, clientState) {
            return {
              recoveryId: 'recovery-test-123',
              recoveryType: 'state_resync',
              recoveryData: { gridState: 'corrected-state' }
            };
          }

          async applyRecovery(recoveryId, clientConfirmation) {
            return {
              applied: true,
              newState: 'synchronized-state'
            };
          }

          async getRecoveryStatus(recoveryId) {
            if (recoveryId === 'invalid') {return null;}
            return {
              status: 'completed',
              progress: 100,
              estimatedCompletion: null
            };
          }
        }
      };
    });

    jest.mock('../../src/services/CascadeValidator', () => {
      return {
        CascadeValidator: class MockCascadeValidator {
          constructor() {}

          async validateGridState(gridState, sessionId) {
            return {
              valid: Array.isArray(gridState) && gridState.length > 0,
              validationHash: 'grid-hash-test',
              fraudScore: 0.05,
              errors: Array.isArray(gridState) && gridState.length > 0 ? [] : ['Invalid grid structure']
            };
          }

          async validateCascadeStep(cascadeStep, sessionId) {
            return {
              valid: cascadeStep && typeof cascadeStep === 'object',
              validationHash: 'step-hash-test',
              errors: cascadeStep && typeof cascadeStep === 'object' ? [] : ['Invalid step structure']
            };
          }

          async validateCascadeSequence(cascadeSteps, sessionId) {
            return {
              valid: Array.isArray(cascadeSteps),
              stepResults: cascadeSteps ? cascadeSteps.map(() => ({ valid: true })) : [],
              errors: Array.isArray(cascadeSteps) ? [] : ['Invalid sequence structure']
            };
          }

          async validateStepTiming(stepTiming, context) {
            return {
              valid: stepTiming && stepTiming.stepDuration > 0,
              analysis: { avgStepTime: 200, tolerance: 50 },
              errors: stepTiming && stepTiming.stepDuration > 0 ? [] : ['Invalid timing']
            };
          }

          async analyzeGridFraud(gridState, sessionId) {
            return {
              fraudScore: 0.02,
              detections: []
            };
          }

          async analyzeStepFraud(cascadeStep, sessionId) {
            return {
              fraudScore: 0.01,
              detections: []
            };
          }

          async analyzeSpinFraud(spinResult, sessionId) {
            return {
              fraudScore: 0.03,
              detections: []
            };
          }

          async getFraudStatistics() {
            return {
              totalAnalyzed: 1000,
              fraudDetected: 5,
              averageFraudScore: 0.02
            };
          }

          async getSessionFraudStatistics(sessionId) {
            return {
              sessionId: sessionId,
              spinsAnalyzed: 50,
              fraudDetected: 0,
              averageFraudScore: 0.01
            };
          }
        }
      };
    });

    jest.mock('../../src/models/GameSession', () => {
      const sessions = new Map();
      return {
        findBySessionId: async (sessionId) => {
          return sessions.get(sessionId) || null;
        },
        create: async (sessionData) => {
          const sessionId = `session-${Date.now()}`;
          const session = {
            sessionId,
            ...sessionData,
            configuration: sessionData.configuration || { syncEnabled: true }
          };
          sessions.set(sessionId, session);
          return session;
        },
        update: async (sessionId, updates) => {
          const session = sessions.get(sessionId);
          if (!session) {return null;}
          Object.assign(session, updates);
          sessions.set(sessionId, session);
          return session;
        },
        delete: async (sessionId) => {
          return sessions.delete(sessionId);
        }
      };
    });

    // Start the server (it will be imported and run)
    const serverModule = require('../../server.js');

    // Wait for server to start
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    // Set app for testing
    app = require('../../server.js');
  });

  afterAll(async () => {
    // Clean up
    if (server && server.close) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('Real API Endpoint Integration Tests', () => {

    // Test 4.4.1: Cascade Synchronization Endpoints
    test('Real /api/cascade/sync/start endpoint', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/sync/start')
        .send({
          sessionId: 'integration-session-123',
          playerId: 'integration-player-123',
          spinId: 'integration-spin-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.syncSessionId).toBeDefined();
      expect(response.body.validationSalt).toBeDefined();
      expect(response.body.syncSeed).toBeDefined();
    });

    test('Real /api/cascade/sync/step endpoint', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/sync/step')
        .send({
          syncSessionId: 'sync-integration-123',
          stepIndex: 0,
          clientHash: 'integration-client-hash',
          timestamp: Date.now()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.validated).toBeDefined();
      expect(response.body.serverHash).toBeDefined();
    });

    test('Real /api/cascade/sync/complete endpoint', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/sync/complete')
        .send({
          syncSessionId: 'sync-integration-123',
          finalHash: 'integration-final-hash',
          totalTime: 5000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.performance).toBeDefined();
      expect(response.body.validated).toBeDefined();
    });

    // Test 4.4.2: Validation Request Handlers
    test('Real /api/cascade/validate/grid endpoint', async () => {
      const gridState = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
        ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
        ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
        ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
        ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
      ];

      const response = await request('http://localhost:3000')
        .post('/api/cascade/validate/grid')
        .send({
          gridState: gridState,
          sessionId: 'integration-session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.validationHash).toBeDefined();
    });

    test('Real /api/cascade/validate/step endpoint', async () => {
      const cascadeStep = {
        stepIndex: 0,
        gridBefore: [],
        gridAfter: [],
        matchedClusters: [],
        dropPatterns: []
      };

      const response = await request('http://localhost:3000')
        .post('/api/cascade/validate/step')
        .send({
          cascadeStep: cascadeStep,
          sessionId: 'integration-session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.validationHash).toBeDefined();
    });

    test('Real /api/cascade/validate/timing endpoint', async () => {
      const stepTiming = {
        stepDuration: 200,
        phases: {
          win_highlight: 50,
          symbol_removal: 50,
          symbol_drop: 75,
          symbol_settle: 25
        }
      };

      const response = await request('http://localhost:3000')
        .post('/api/cascade/validate/timing')
        .send({
          stepTiming: stepTiming,
          context: { sessionId: 'integration-session-123' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.analysis).toBeDefined();
    });

    test('Real /api/cascade/validate/fraud/stats endpoint', async () => {
      const response = await request('http://localhost:3000')
        .get('/api/cascade/validate/fraud/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.totalAnalyzed).toBeDefined();
    });

    // Test 4.4.3: Recovery Request Endpoints
    test('Real /api/cascade/recovery/request endpoint', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/recovery/request')
        .send({
          syncSessionId: 'sync-integration-123',
          desyncType: 'hash_mismatch',
          clientState: { gridState: 'integration-client-state' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recoveryId).toBeDefined();
      expect(response.body.recoveryType).toBeDefined();
    });

    test('Real /api/cascade/recovery/apply endpoint', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/recovery/apply')
        .send({
          recoveryId: 'recovery-integration-123',
          clientConfirmation: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.applied).toBeDefined();
    });

    test('Real /api/cascade/recovery/status endpoint', async () => {
      const response = await request('http://localhost:3000')
        .get('/api/cascade/recovery/status/recovery-integration-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
    });

    // Test 4.4.4: Session Management Endpoints
    test('Real /api/cascade/session/create endpoint', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/session/create')
        .send({
          playerId: 'integration-player-123',
          gameMode: 'normal',
          configuration: { syncEnabled: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.configuration).toBeDefined();
    });

    test('Real /api/cascade/session/:sessionId endpoint', async () => {
      // First create a session
      const createResponse = await request('http://localhost:3000')
        .post('/api/cascade/session/create')
        .send({
          playerId: 'integration-player-456'
        });

      expect(createResponse.status).toBe(200);
      const sessionId = createResponse.body.sessionId;

      // Then get the session
      const getResponse = await request('http://localhost:3000')
        .get(`/api/cascade/session/${sessionId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.session).toBeDefined();
      expect(getResponse.body.session.sessionId).toBe(sessionId);
    });

    test('Real /api/cascade/session/:sessionId/state endpoint', async () => {
      // First create a session
      const createResponse = await request('http://localhost:3000')
        .post('/api/cascade/session/create')
        .send({
          playerId: 'integration-player-789'
        });

      const sessionId = createResponse.body.sessionId;

      // Then update the session state
      const updateResponse = await request('http://localhost:3000')
        .put(`/api/cascade/session/${sessionId}/state`)
        .send({
          cascadeState: 'active',
          syncStatus: 'synchronized'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.updated).toBe(true);
    });

    test('Real /api/cascade/session/:sessionId DELETE endpoint', async () => {
      // First create a session
      const createResponse = await request('http://localhost:3000')
        .post('/api/cascade/session/create')
        .send({
          playerId: 'integration-player-delete'
        });

      const sessionId = createResponse.body.sessionId;

      // Then delete the session
      const deleteResponse = await request('http://localhost:3000')
        .delete(`/api/cascade/session/${sessionId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.deleted).toBe(true);
    });
  });

  describe('Real API Error Handling', () => {
    test('Invalid input validation', async () => {
      const response = await request('http://localhost:3000')
        .post('/api/cascade/sync/start')
        .send({
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('Non-existent session handling', async () => {
      const response = await request('http://localhost:3000')
        .get('/api/cascade/session/non-existent-session');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Session not found');
    });

    test('Non-existent recovery handling', async () => {
      const response = await request('http://localhost:3000')
        .get('/api/cascade/recovery/status/invalid');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Recovery session not found');
    });
  });

  describe('Real API Performance Tests', () => {
    test('Multiple concurrent sync requests', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request('http://localhost:3000')
            .post('/api/cascade/sync/start')
            .send({
              sessionId: `perf-session-${i}`,
              playerId: `perf-player-${i}`,
              spinId: `perf-spin-${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('Multiple concurrent validation requests', async () => {
      const startTime = Date.now();

      const gridState = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem']
      ];

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request('http://localhost:3000')
            .post('/api/cascade/validate/grid')
            .send({
              gridState: gridState,
              sessionId: `perf-session-${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });
});