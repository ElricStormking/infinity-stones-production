/**
 * WebSocketCascadeEvents.test.js - Comprehensive WebSocket Cascade Event Testing
 *
 * Custom Task 4.5: Test WebSocket cascade events
 * - 4.5.1: Test real-time cascade broadcasting
 * - 4.5.2: Test step acknowledgment events
 * - 4.5.3: Test desync detection events
 * - 4.5.4: Test recovery coordination events
 *
 * This test suite validates all WebSocket cascade synchronization functionality
 * including real-time broadcasting, acknowledgments, desync detection, and recovery.
 */

const io = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const CascadeSync = require('../../src/websocket/CascadeSync');
const CascadeSynchronizer = require('../../src/services/CascadeSynchronizer');
const CascadeValidator = require('../../src/services/CascadeValidator');
const GameSession = require('../../src/models/GameSession');

describe('WebSocket Cascade Events Testing', () => {
  let httpServer;
  let serverSocket;
  let clientSocket;
  let cascadeSync;
  let cascadeSynchronizer;
  let cascadeValidator;

  // Test configuration
  const TEST_CONFIG = {
    broadcastTimeout: 1000,
    acknowledgmentTimeout: 500,
    maxRetryAttempts: 2,
    heartbeatInterval: 5000,
    syncToleranceMs: 100
  };

  // Mock data for testing
  const mockSpinId = 'test-spin-123';
  const mockPlayerId = 'test-player-456';
  const mockGridState = [
    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
    ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
    ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
    ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
    ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
  ];

  const mockCascadeSteps = [
    {
      stepNumber: 0,
      gridBefore: mockGridState,
      gridAfter: mockGridState,
      matchedClusters: [{ positions: [[0,0], [0,1], [1,0], [1,1], [2,0], [2,1], [3,0], [3,1]], symbol: 'time_gem', winAmount: 100 }],
      dropPattern: { columns: [{ column: 0, drops: [{ from: -1, to: 3, symbol: 'soul_gem' }] }] },
      animations: { phase: 'win_highlight', duration: 500 },
      stepTiming: { serverTimestamp: Date.now(), stepDuration: 1000 },
      validationHash: 'mock-hash-step-0'
    },
    {
      stepNumber: 1,
      gridBefore: mockGridState,
      gridAfter: mockGridState,
      matchedClusters: [],
      dropPattern: { columns: [] },
      animations: { phase: 'symbol_settle', duration: 300 },
      stepTiming: { serverTimestamp: Date.now(), stepDuration: 800 },
      validationHash: 'mock-hash-step-1'
    }
  ];

  beforeEach(async () => {
    // Create HTTP server and Socket.io server
    httpServer = createServer();
    const ioServer = new Server(httpServer);

    // Initialize services
    cascadeSynchronizer = new CascadeSynchronizer();
    cascadeValidator = new CascadeValidator();
    cascadeSync = new CascadeSync(ioServer, cascadeSynchronizer, cascadeValidator);
    cascadeSync.updateConfig(TEST_CONFIG);

    // Setup Socket.io handlers
    ioServer.on('connection', (socket) => {
      serverSocket = socket;
      cascadeSync.setupSocketHandlers(socket);
    });

    // Start server
    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });

    const port = httpServer.address().port;

    // Create client socket
    clientSocket = io(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });

    // Wait for connection
    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Wait for server socket to be available
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }
  });

  /**
     * Task 4.5.1: Test real-time cascade broadcasting
     */
  describe('4.5.1: Real-Time Cascade Broadcasting', () => {
    test('should initiate cascade sync session successfully', async () => {
      const syncStartData = {
        spinId: mockSpinId,
        playerId: mockPlayerId,
        gridState: mockGridState,
        enableBroadcast: true
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('sync_session_start', resolve);
      });

      clientSocket.emit('cascade_sync_start', syncStartData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.syncSessionId).toBeDefined();
      expect(response.validationSalt).toBeDefined();
      expect(response.syncSeed).toBeDefined();
      expect(response.serverTimestamp).toBeDefined();
      expect(response.broadcastEnabled).toBe(true);
      expect(response.processingTime).toBeGreaterThan(0);
    });

    test('should broadcast cascade steps automatically', async () => {
      // First start sync session
      const syncStartData = {
        spinId: mockSpinId,
        playerId: mockPlayerId,
        gridState: mockGridState,
        enableBroadcast: true
      };

      const sessionStartPromise = new Promise((resolve) => {
        clientSocket.on('sync_session_start', resolve);
      });

      clientSocket.emit('cascade_sync_start', syncStartData);
      const sessionResponse = await sessionStartPromise;

      // Mock cascade steps in the session
      const stepManager = cascadeSync.activeManagers.get(sessionResponse.syncSessionId);
      if (stepManager) {
        stepManager.cascadeSteps = mockCascadeSteps;
      }

      // Listen for step broadcast
      const broadcastPromise = new Promise((resolve) => {
        clientSocket.on('cascade_step_broadcast', resolve);
      });

      // Start broadcasting
      await cascadeSync.startStepBroadcasting(sessionResponse.syncSessionId, mockCascadeSteps);

      const broadcast = await broadcastPromise;

      expect(broadcast.syncSessionId).toBe(sessionResponse.syncSessionId);
      expect(broadcast.stepIndex).toBe(0);
      expect(broadcast.cascadeStep).toBeDefined();
      expect(broadcast.cascadeStep.stepNumber).toBe(0);
      expect(broadcast.cascadeStep.gridBefore).toEqual(mockGridState);
      expect(broadcast.expectedAcknowledgment).toBe(true);
      expect(broadcast.timeout).toBe(TEST_CONFIG.acknowledgmentTimeout);
    });

    test('should handle step progression requests', async () => {
      // Setup sync session first
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      const nextStepData = {
        syncSessionId,
        currentStepIndex: 0,
        readyForNext: true
      };

      // Mock broadcastNextStep to avoid actual broadcasting
      const originalBroadcast = cascadeSync.broadcastNextStep;
      cascadeSync.broadcastNextStep = jest.fn().mockResolvedValue();

      clientSocket.emit('cascade_step_next', nextStepData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cascadeSync.broadcastNextStep).toHaveBeenCalledWith(syncSessionId, 1);

      // Restore original method
      cascadeSync.broadcastNextStep = originalBroadcast;
    });

    test('should handle manual step control commands', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      const controlData = {
        syncSessionId,
        action: 'pause',
        stepIndex: 0
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('step_control_response', resolve);
      });

      clientSocket.emit('cascade_step_control', controlData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.action).toBe('pause');
      expect(stepManager.status).toBe('paused');
      expect(stepManager.autoBroadcast).toBe(false);
    });

    test('should handle broadcasting errors gracefully', async () => {
      const invalidControlData = {
        syncSessionId: 'non-existent-session',
        action: 'pause'
      };

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('step_control_response', resolve);
      });

      clientSocket.emit('cascade_step_control', invalidControlData);

      const errorResponse = await errorPromise;

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('STEP_CONTROL_FAILED');
      expect(errorResponse.errorMessage).toContain('Step manager not found');
    });
  });

  /**
     * Task 4.5.2: Test step acknowledgment events
     */
  describe('4.5.2: Step Acknowledgment Events', () => {
    test('should process step validation acknowledgments', async () => {
      const syncSessionId = 'test-session-' + Date.now();

      // Mock acknowledgment processing
      cascadeSynchronizer.processStepAcknowledgment = jest.fn().mockResolvedValue({
        validated: true,
        serverHash: 'server-hash-123',
        clientHash: 'client-hash-123',
        nextStepData: { stepIndex: 1 },
        syncStatus: 'synchronized'
      });

      const acknowledgmentData = {
        syncSessionId,
        stepIndex: 0,
        gridState: mockGridState,
        clientHash: 'client-hash-123',
        clientTimestamp: Date.now(),
        phaseType: 'win_highlight'
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('step_validation_response', resolve);
      });

      clientSocket.emit('step_validation_request', acknowledgmentData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.stepIndex).toBe(0);
      expect(response.phaseType).toBe('win_highlight');
      expect(response.stepValidated).toBe(true);
      expect(response.serverHash).toBe('server-hash-123');
      expect(response.syncStatus).toBe('synchronized');
      expect(response.validationFeedback).toBeDefined();
      expect(response.processingTime).toBeGreaterThan(0);

      expect(cascadeSynchronizer.processStepAcknowledgment).toHaveBeenCalledWith(
        syncSessionId,
        expect.objectContaining({
          stepIndex: 0,
          gridState: mockGridState,
          clientHash: 'client-hash-123',
          phaseType: 'win_highlight'
        })
      );
    });

    test('should handle acknowledgment timeouts', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      const timeoutData = {
        syncSessionId,
        stepIndex: 0,
        timeoutReason: 'client_not_responding'
      };

      // Mock recovery initiation
      cascadeSync.initiateRecovery = jest.fn().mockResolvedValue();
      cascadeSync.retryStepAcknowledgment = jest.fn().mockResolvedValue();

      clientSocket.emit('acknowledgment_timeout', timeoutData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(stepManager.timeoutCount).toBe(1);
      expect(cascadeSync.retryStepAcknowledgment).toHaveBeenCalledWith(syncSessionId, 0);
    });

    test('should process batch acknowledgments', async () => {
      const syncSessionId = 'test-session-' + Date.now();

      const acknowledgments = [
        {
          stepIndex: 0,
          gridState: mockGridState,
          clientHash: 'hash-0',
          clientTimestamp: Date.now()
        },
        {
          stepIndex: 1,
          gridState: mockGridState,
          clientHash: 'hash-1',
          clientTimestamp: Date.now()
        }
      ];

      // Mock batch processing
      cascadeSynchronizer.processStepAcknowledgment = jest.fn()
        .mockResolvedValueOnce({ validated: true })
        .mockResolvedValueOnce({ validated: true });

      const batchData = {
        syncSessionId,
        acknowledgments
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('batch_acknowledgment_response', resolve);
      });

      clientSocket.emit('batch_acknowledgment', batchData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.syncSessionId).toBe(syncSessionId);
      expect(response.results).toHaveLength(2);
      expect(response.results[0].success).toBe(true);
      expect(response.results[1].success).toBe(true);
      expect(response.totalProcessed).toBe(2);
    });

    test('should handle acknowledgment errors in batch processing', async () => {
      const syncSessionId = 'test-session-' + Date.now();

      const acknowledgments = [
        {
          stepIndex: 0,
          gridState: mockGridState,
          clientHash: 'hash-0'
        }
      ];

      // Mock error in processing
      cascadeSynchronizer.processStepAcknowledgment = jest.fn()
        .mockRejectedValue(new Error('Validation failed'));

      const batchData = {
        syncSessionId,
        acknowledgments
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('batch_acknowledgment_response', resolve);
      });

      clientSocket.emit('batch_acknowledgment', batchData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.results).toHaveLength(1);
      expect(response.results[0].success).toBe(false);
      expect(response.results[0].error).toBe('Validation failed');
    });

    test('should auto-advance to next step after successful acknowledgment', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      stepManager.autoBroadcast = true;
      stepManager.stepInterval = 100;
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock successful acknowledgment
      cascadeSynchronizer.processStepAcknowledgment = jest.fn().mockResolvedValue({
        validated: true,
        serverHash: 'server-hash-123',
        syncStatus: 'synchronized'
      });

      // Mock broadcastNextStep
      cascadeSync.broadcastNextStep = jest.fn().mockResolvedValue();

      const acknowledgmentData = {
        syncSessionId,
        stepIndex: 0,
        gridState: mockGridState,
        clientHash: 'client-hash-123'
      };

      clientSocket.emit('step_validation_request', acknowledgmentData);

      // Wait for auto-advance timing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(cascadeSync.broadcastNextStep).toHaveBeenCalledWith(syncSessionId, 1);
    });
  });

  /**
     * Task 4.5.3: Test desync detection events
     */
  describe('4.5.3: Desync Detection Events', () => {
    test('should handle desync detection and request recovery', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock recovery request
      cascadeSynchronizer.requestRecovery = jest.fn().mockResolvedValue({
        recoveryType: 'state_resync',
        recoveryData: { correctedGridState: mockGridState },
        requiredSteps: ['reset_grid', 'replay_step'],
        recoveryId: 'recovery-123',
        estimatedDuration: 2000
      });

      const desyncData = {
        syncSessionId,
        desyncType: 'hash_mismatch',
        clientState: { gridState: mockGridState },
        stepIndex: 1,
        desyncDetails: { expectedHash: 'expected-123', actualHash: 'actual-456' }
      };

      const recoveryPromise = new Promise((resolve) => {
        clientSocket.on('recovery_data', resolve);
      });

      clientSocket.emit('desync_detected', desyncData);

      const recoveryResponse = await recoveryPromise;

      expect(recoveryResponse.success).toBe(true);
      expect(recoveryResponse.syncSessionId).toBe(syncSessionId);
      expect(recoveryResponse.desyncType).toBe('hash_mismatch');
      expect(recoveryResponse.recoveryType).toBe('state_resync');
      expect(recoveryResponse.recoveryId).toBe('recovery-123');
      expect(recoveryResponse.estimatedDuration).toBe(2000);

      expect(stepManager.recoveryCount).toBe(1);
      expect(stepManager.status).toBe('recovering');

      expect(cascadeSynchronizer.requestRecovery).toHaveBeenCalledWith(
        syncSessionId,
        expect.objectContaining({
          desyncType: 'hash_mismatch',
          stepIndex: 1,
          desyncDetails: expect.any(Object)
        })
      );
    });

    test('should track desync metrics on socket', async () => {
      const syncSessionId = 'test-session-' + Date.now();

      // Mock recovery request
      cascadeSynchronizer.requestRecovery = jest.fn().mockResolvedValue({
        recoveryType: 'phase_replay',
        recoveryData: {},
        recoveryId: 'recovery-456'
      });

      const desyncData = {
        syncSessionId,
        desyncType: 'timing_error',
        clientState: {},
        stepIndex: 0
      };

      clientSocket.emit('desync_detected', desyncData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const socketData = cascadeSync.activeSockets.get(clientSocket.id);
      expect(socketData.metrics.desyncsDetected).toBe(1);
    });

    test('should pause step broadcasting during recovery', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      stepManager.autoBroadcast = true;
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock recovery request
      cascadeSynchronizer.requestRecovery = jest.fn().mockResolvedValue({
        recoveryType: 'cascade_replay',
        recoveryData: {},
        recoveryId: 'recovery-789'
      });

      const desyncData = {
        syncSessionId,
        desyncType: 'grid_inconsistency',
        clientState: {},
        stepIndex: 2
      };

      clientSocket.emit('desync_detected', desyncData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(stepManager.status).toBe('recovering');
      expect(stepManager.autoBroadcast).toBe(false);
    });

    test('should handle desync detection errors', async () => {
      const syncSessionId = 'non-existent-session';

      // Mock error in recovery request
      cascadeSynchronizer.requestRecovery = jest.fn().mockRejectedValue(
        new Error('Session not found')
      );

      const desyncData = {
        syncSessionId,
        desyncType: 'unknown_error',
        clientState: {},
        stepIndex: 0
      };

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('recovery_data', resolve);
      });

      clientSocket.emit('desync_detected', desyncData);

      const errorResponse = await errorPromise;

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('DESYNC_RECOVERY_FAILED');
      expect(errorResponse.errorMessage).toContain('Session not found');
    });
  });

  /**
     * Task 4.5.4: Test recovery coordination events
     */
  describe('4.5.4: Recovery Coordination Events', () => {
    test('should handle recovery application successfully', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const recoveryId = 'recovery-123';
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      stepManager.status = 'recovering';
      stepManager.autoBroadcast = false;
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock successful recovery application
      cascadeSynchronizer.applyRecovery = jest.fn().mockResolvedValue({
        successful: true,
        syncRestored: true,
        newSyncState: { gridState: mockGridState, stepIndex: 1 },
        nextActions: ['resume_broadcasting']
      });

      const recoveryData = {
        recoveryId,
        clientState: { gridState: mockGridState },
        recoveryResult: { success: true, restoredState: mockGridState },
        syncSessionId
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('recovery_apply_response', resolve);
      });

      clientSocket.emit('recovery_apply', recoveryData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.recoveryId).toBe(recoveryId);
      expect(response.recoverySuccessful).toBe(true);
      expect(response.syncRestored).toBe(true);
      expect(response.newSyncState).toBeDefined();
      expect(response.nextActions).toContain('resume_broadcasting');

      expect(stepManager.status).toBe('synchronized');
      expect(stepManager.autoBroadcast).toBe(true);

      expect(cascadeSynchronizer.applyRecovery).toHaveBeenCalledWith(
        recoveryId,
        expect.objectContaining({
          clientState: expect.any(Object),
          recoveryResult: expect.any(Object)
        })
      );
    });

    test('should handle failed recovery application', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const recoveryId = 'recovery-456';
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      stepManager.status = 'recovering';
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock failed recovery application
      cascadeSynchronizer.applyRecovery = jest.fn().mockResolvedValue({
        successful: false,
        syncRestored: false,
        newSyncState: null,
        nextActions: ['retry_recovery', 'fallback_to_client']
      });

      const recoveryData = {
        recoveryId,
        clientState: {},
        recoveryResult: { success: false },
        syncSessionId
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('recovery_apply_response', resolve);
      });

      clientSocket.emit('recovery_apply', recoveryData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.recoverySuccessful).toBe(false);
      expect(response.syncRestored).toBe(false);
      expect(response.nextActions).toContain('retry_recovery');

      // Status should remain recovering since recovery failed
      expect(stepManager.status).toBe('recovering');
      expect(stepManager.autoBroadcast).toBe(false);
    });

    test('should provide recovery status monitoring', async () => {
      const recoveryId = 'recovery-789';

      // Mock recovery status
      cascadeSynchronizer.getRecoveryStatus = jest.fn().mockResolvedValue({
        status: 'in_progress',
        progress: 75,
        estimatedCompletion: Date.now() + 1000,
        errors: []
      });

      const statusData = {
        recoveryId
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('recovery_status_response', resolve);
      });

      clientSocket.emit('recovery_status', statusData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.recoveryId).toBe(recoveryId);
      expect(response.status).toBe('in_progress');
      expect(response.progress).toBe(75);
      expect(response.estimatedCompletion).toBeGreaterThan(Date.now());
      expect(response.errors).toEqual([]);

      expect(cascadeSynchronizer.getRecoveryStatus).toHaveBeenCalledWith(recoveryId);
    });

    test('should handle forced resync requests', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      stepManager.currentStepIndex = 5;
      stepManager.status = 'broadcasting';
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock restart broadcasting
      cascadeSync.restartStepBroadcasting = jest.fn().mockResolvedValue();

      const resyncData = {
        syncSessionId,
        fromStepIndex: 2
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('force_resync_response', resolve);
      });

      clientSocket.emit('force_resync', resyncData);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.syncSessionId).toBe(syncSessionId);
      expect(response.fromStepIndex).toBe(2);
      expect(response.newStatus).toBe('resyncing');

      expect(stepManager.currentStepIndex).toBe(2);
      expect(stepManager.status).toBe('resyncing');

      expect(cascadeSync.restartStepBroadcasting).toHaveBeenCalledWith(syncSessionId, 2);
    });

    test('should handle recovery coordination errors', async () => {
      const recoveryData = {
        recoveryId: 'invalid-recovery',
        clientState: {},
        recoveryResult: {},
        syncSessionId: 'test-session'
      };

      // Mock error in recovery application
      cascadeSynchronizer.applyRecovery = jest.fn().mockRejectedValue(
        new Error('Recovery not found')
      );

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('recovery_apply_response', resolve);
      });

      clientSocket.emit('recovery_apply', recoveryData);

      const errorResponse = await errorPromise;

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('RECOVERY_APPLY_FAILED');
      expect(errorResponse.errorMessage).toContain('Recovery not found');
    });

    test('should resume broadcasting after successful recovery', async () => {
      const syncSessionId = 'test-session-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      stepManager.status = 'recovering';
      stepManager.autoBroadcast = false;
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Mock successful recovery with resume capability
      cascadeSynchronizer.applyRecovery = jest.fn().mockResolvedValue({
        successful: true,
        syncRestored: true,
        newSyncState: { stepIndex: 1 },
        nextActions: ['resume_broadcasting']
      });

      // Mock resume broadcasting
      cascadeSync.resumeStepBroadcasting = jest.fn().mockResolvedValue();

      const recoveryData = {
        recoveryId: 'recovery-resume-test',
        clientState: {},
        recoveryResult: { success: true },
        syncSessionId
      };

      clientSocket.emit('recovery_apply', recoveryData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(stepManager.status).toBe('synchronized');
      expect(stepManager.autoBroadcast).toBe(true);
      expect(cascadeSync.resumeStepBroadcasting).toHaveBeenCalledWith(syncSessionId);
    });
  });

  /**
     * Additional Integration Tests
     */
  describe('Integration and Performance Tests', () => {
    test('should handle complete cascade synchronization workflow', async () => {
      // 1. Start sync session
      const syncStartData = {
        spinId: mockSpinId,
        playerId: mockPlayerId,
        gridState: mockGridState,
        enableBroadcast: true
      };

      const sessionPromise = new Promise((resolve) => {
        clientSocket.on('sync_session_start', resolve);
      });

      clientSocket.emit('cascade_sync_start', syncStartData);
      const sessionResponse = await sessionPromise;

      expect(sessionResponse.success).toBe(true);

      // 2. Simulate step broadcasting and acknowledgment
      const stepManager = cascadeSync.activeManagers.get(sessionResponse.syncSessionId);
      stepManager.cascadeSteps = mockCascadeSteps;

      cascadeSynchronizer.processStepAcknowledgment = jest.fn().mockResolvedValue({
        validated: true,
        serverHash: 'test-hash',
        syncStatus: 'synchronized'
      });

      const broadcastPromise = new Promise((resolve) => {
        clientSocket.on('cascade_step_broadcast', resolve);
      });

      await cascadeSync.startStepBroadcasting(sessionResponse.syncSessionId, mockCascadeSteps);
      await broadcastPromise;

      // 3. Send acknowledgment
      const ackData = {
        syncSessionId: sessionResponse.syncSessionId,
        stepIndex: 0,
        gridState: mockGridState,
        clientHash: 'client-test-hash'
      };

      const ackPromise = new Promise((resolve) => {
        clientSocket.on('step_validation_response', resolve);
      });

      clientSocket.emit('step_validation_request', ackData);
      const ackResponse = await ackPromise;

      expect(ackResponse.success).toBe(true);
      expect(ackResponse.stepValidated).toBe(true);

      // 4. Complete session
      cascadeSynchronizer.completeSyncSession = jest.fn().mockResolvedValue({
        validated: true,
        performanceScore: 95,
        totalSteps: 2,
        serverTimestamp: Date.now()
      });

      const completionData = {
        syncSessionId: sessionResponse.syncSessionId,
        finalGridState: mockGridState,
        totalWin: 500,
        clientHash: 'final-hash',
        sessionMetrics: { totalTime: 2000, errorCount: 0 }
      };

      const completionPromise = new Promise((resolve) => {
        clientSocket.on('sync_session_complete_response', resolve);
      });

      clientSocket.emit('sync_session_complete', completionData);
      const completionResponse = await completionPromise;

      expect(completionResponse.success).toBe(true);
      expect(completionResponse.validated).toBe(true);
      expect(completionResponse.performanceScore).toBe(95);
    });

    test('should handle high-frequency acknowledgments', async () => {
      const syncSessionId = 'high-freq-test-' + Date.now();

      cascadeSynchronizer.processStepAcknowledgment = jest.fn().mockResolvedValue({
        validated: true,
        serverHash: 'hash-test',
        syncStatus: 'synchronized'
      });

      const acknowledgmentPromises = [];
      const acknowledgmentCount = 20;

      for (let i = 0; i < acknowledgmentCount; i++) {
        const ackData = {
          syncSessionId,
          stepIndex: i,
          gridState: mockGridState,
          clientHash: `hash-${i}`
        };

        const promise = new Promise((resolve) => {
          const handler = (response) => {
            if (response.stepIndex === i) {
              clientSocket.off('step_validation_response', handler);
              resolve(response);
            }
          };
          clientSocket.on('step_validation_response', handler);
        });

        acknowledgmentPromises.push(promise);
        clientSocket.emit('step_validation_request', ackData);
      }

      const startTime = Date.now();
      const responses = await Promise.all(acknowledgmentPromises);
      const processingTime = Date.now() - startTime;

      expect(responses).toHaveLength(acknowledgmentCount);
      expect(responses.every(r => r.success)).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain connection stability during WebSocket events', async () => {
      let heartbeatReceived = false;
      let connectionStable = true;

      clientSocket.on('heartbeat', () => {
        heartbeatReceived = true;
        clientSocket.emit('heartbeat_response');
      });

      clientSocket.on('disconnect', () => {
        connectionStable = false;
      });

      // Simulate various WebSocket events
      const events = [
        { event: 'cascade_sync_start', data: { spinId: 'test', playerId: 'test', gridState: mockGridState } },
        { event: 'step_validation_request', data: { syncSessionId: 'test', stepIndex: 0, gridState: mockGridState } },
        { event: 'grid_validation_request', data: { gridState: mockGridState } }
      ];

      for (const { event, data } of events) {
        clientSocket.emit(event, data);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Wait for potential heartbeat
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(connectionStable).toBe(true);
      expect(clientSocket.connected).toBe(true);
    });

    test('should cleanup resources on disconnect', async () => {
      const syncSessionId = 'cleanup-test-' + Date.now();
      const stepManager = cascadeSync.createStepManager(serverSocket, {
        syncSessionId,
        cascadeSteps: mockCascadeSteps
      });
      cascadeSync.activeManagers.set(syncSessionId, stepManager);

      // Add session to socket tracking
      const socketData = cascadeSync.activeSockets.get(clientSocket.id);
      if (socketData) {
        socketData.syncSessions.add(syncSessionId);
      }

      // Mock cleanup method
      cascadeSynchronizer.cleanupSession = jest.fn().mockResolvedValue();
      cascadeSynchronizer.unregisterSocket = jest.fn();

      const initialConnectionCount = cascadeSync.metrics.connectionsCount;

      // Disconnect client
      clientSocket.disconnect();

      // Wait for cleanup processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(cascadeSync.activeManagers.has(syncSessionId)).toBe(false);
      expect(cascadeSync.activeSockets.has(clientSocket.id)).toBe(false);
      expect(cascadeSync.metrics.connectionsCount).toBe(initialConnectionCount - 1);
      expect(cascadeSynchronizer.cleanupSession).toHaveBeenCalledWith(syncSessionId);
    });
  });

  /**
     * Error Handling and Edge Cases
     */
  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed event data', async () => {
      const malformedData = {
        // Missing required fields
        invalidField: 'test'
      };

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('sync_session_start', resolve);
      });

      clientSocket.emit('cascade_sync_start', malformedData);

      const errorResponse = await errorPromise;

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('SYNC_START_FAILED');
      expect(errorResponse.errorMessage).toContain('Missing required fields');
    });

    test('should handle large payload data gracefully', async () => {
      const largeGridState = Array(100).fill(null).map(() =>
        Array(100).fill('time_gem')
      );

      const largeData = {
        spinId: mockSpinId,
        playerId: mockPlayerId,
        gridState: largeGridState
      };

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('sync_session_start', resolve);
      });

      clientSocket.emit('cascade_sync_start', largeData);

      const response = await responsePromise;

      // Should handle large data without crashing
      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
    });

    test('should handle concurrent session operations', async () => {
      const concurrentSessions = 5;
      const sessionPromises = [];

      for (let i = 0; i < concurrentSessions; i++) {
        const syncData = {
          spinId: `test-spin-${i}`,
          playerId: `test-player-${i}`,
          gridState: mockGridState
        };

        const promise = new Promise((resolve) => {
          const handler = (response) => {
            if (response.success) {
              clientSocket.off('sync_session_start', handler);
              resolve(response);
            }
          };
          clientSocket.on('sync_session_start', handler);
        });

        sessionPromises.push(promise);
        clientSocket.emit('cascade_sync_start', syncData);
      }

      const responses = await Promise.all(sessionPromises);

      expect(responses).toHaveLength(concurrentSessions);
      expect(responses.every(r => r.success)).toBe(true);
      expect(new Set(responses.map(r => r.syncSessionId)).size).toBe(concurrentSessions);
    });
  });
});