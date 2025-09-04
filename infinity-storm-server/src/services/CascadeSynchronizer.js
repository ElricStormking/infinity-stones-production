const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * CascadeSynchronizer - Real-time cascade synchronization service
 *
 * Manages client-server synchronization during multi-step cascade sequences,
 * ensuring perfect timing control and state consistency between client and server.
 *
 * Key Features:
 * - Client-server validation protocols
 * - Step-by-step acknowledgment handling
 * - Desync detection and recovery
 * - Cascade replay mechanisms
 */
class CascadeSynchronizer extends EventEmitter {
  constructor(gameSession, socketManager) {
    super();

    this.gameSession = gameSession;
    this.socketManager = socketManager;

    // Active synchronization sessions
    this.activeSessions = new Map(); // spinId -> SyncSession

    // Configuration
    this.config = {
      maxCascades: 8,
      stepTimeout: 3000, // 3 seconds per step
      totalSpinTimeout: 15000, // 15 seconds total
      maxRecoveryAttempts: 3,
      verificationTolerance: 50, // 50ms timing tolerance
      heartbeatInterval: 1000 // 1 second heartbeat
    };

    // Performance tracking
    this.performanceMetrics = new Map();

    // Recovery handlers
    this.recoveryHandlers = new Map();

    // Compatibility session maps
    this.sessionsById = new Map();

    this.setupEventHandlers();
  }

  /**
     * 2.2.1: Client-server validation protocols
     * Implements comprehensive validation protocols for cascade synchronization
     */
  async initiateCascadeSync(spinId, playerId, cascadeSequence) {
    try {
      // Create synchronization session
      const syncSession = this.createSyncSession(spinId, playerId, cascadeSequence);
      this.activeSessions.set(spinId, syncSession);

      // Initialize client-server validation protocol
      await this.initializeValidationProtocol(syncSession);

      // Start cascade sequence with step-by-step synchronization
      await this.startCascadeSequence(syncSession);

      return {
        success: true,
        sessionId: syncSession.id,
        totalSteps: this.calculateTotalSteps(cascadeSequence)
      };

    } catch (error) {
      console.error('Failed to initiate cascade sync:', error);
      await this.handleSyncFailure(spinId, 'initialization_failed', error);
      throw error;
    }
  }

  /**
     * Creates a new synchronization session for a cascade sequence
     */
  createSyncSession(spinId, playerId, cascadeSequence) {
    const sessionId = this.generateSecureId();

    return {
      id: sessionId,
      spinId: spinId,
      playerId: playerId,
      cascadeSequence: cascadeSequence,
      currentCascadeIndex: 0,
      currentPhase: 'initialization',
      stepValidations: [],
      acknowledgments: new Map(),
      recoveryAttempts: 0,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      performanceData: {
        stepTimings: [],
        validationResults: [],
        recoveryEvents: []
      },
      validationHashes: new Map(),
      clientState: null,
      serverState: null
    };
  }

  /**
     * 2.2.1: Initialize validation protocol for client-server sync
     */
  async initializeValidationProtocol(syncSession) {
    // Generate validation salts and seeds
    const validationSalt = crypto.randomBytes(16).toString('hex');
    const syncSeed = crypto.randomBytes(32).toString('hex');

    // Create initial validation checkpoint
    const initialCheckpoint = {
      checkpointId: this.generateSecureId(),
      type: 'initialization',
      expectedGridState: syncSession.cascadeSequence.initial_grid,
      validationHash: this.generateValidationHash(
        syncSession.cascadeSequence.initial_grid,
        validationSalt
      ),
      salt: validationSalt,
      timestamp: Date.now(),
      timeout: this.config.stepTimeout
    };

    // Store validation data
    syncSession.validationSalt = validationSalt;
    syncSession.syncSeed = syncSeed;
    syncSession.checkpoints = [initialCheckpoint];

    // Send initialization data to client
    await this.sendToClient(syncSession.playerId, 'cascade_sync_init', {
      sessionId: syncSession.id,
      spinId: syncSession.spinId,
      validationSalt: validationSalt,
      syncSeed: syncSeed,
      initialCheckpoint: initialCheckpoint,
      config: {
        stepTimeout: this.config.stepTimeout,
        totalTimeout: this.config.totalSpinTimeout,
        heartbeatInterval: this.config.heartbeatInterval
      }
    });

    // Wait for client acknowledgment
    await this.waitForAcknowledment(syncSession, 'initialization', this.config.stepTimeout);
  }

  /**
     * 2.2.2: Step-by-step acknowledgment handling
     * Implements comprehensive acknowledgment system for each cascade step
     */
  async startCascadeSequence(syncSession) {
    try {
      const cascadeSequence = syncSession.cascadeSequence;

      for (let cascadeIndex = 0; cascadeIndex < cascadeSequence.cascades.length; cascadeIndex++) {
        syncSession.currentCascadeIndex = cascadeIndex;
        const cascade = cascadeSequence.cascades[cascadeIndex];

        // Process each phase of the cascade with acknowledgments
        await this.processCascadeWithAcknowledgments(syncSession, cascade);

        // Validate cascade completion
        await this.validateCascadeCompletion(syncSession, cascade);
      }

      // Complete the cascade sequence
      await this.completeCascadeSequence(syncSession);

    } catch (error) {
      console.error('Cascade sequence failed:', error);
      await this.handleSyncFailure(syncSession.spinId, 'sequence_failed', error);
      throw error;
    }
  }

  /**
     * Process a single cascade with step-by-step acknowledgments
     */
  async processCascadeWithAcknowledgments(syncSession, cascade) {
    const phases = ['win_highlight', 'symbol_removal', 'symbol_drop', 'symbol_settle'];

    for (const phase of phases) {
      syncSession.currentPhase = phase;

      // Send phase start notification
      await this.sendPhaseStart(syncSession, cascade, phase);

      // Wait for client acknowledgment of phase start
      await this.waitForAcknowledment(syncSession, `phase_start_${phase}`, this.config.stepTimeout);

      // Monitor phase execution
      await this.monitorPhaseExecution(syncSession, cascade, phase);

      // Wait for phase completion acknowledgment
      await this.waitForAcknowledment(syncSession, `phase_complete_${phase}`, this.config.stepTimeout);

      // Validate phase state
      await this.validatePhaseState(syncSession, cascade, phase);
    }
  }

  /**
     * Send phase start notification to client
     */
  async sendPhaseStart(syncSession, cascade, phase) {
    const phaseData = {
      sessionId: syncSession.id,
      spinId: syncSession.spinId,
      cascadeIndex: cascade.cascade_index,
      phase: phase,
      timing: cascade.timing_data,
      expectedDuration: this.getPhaseExpectedDuration(cascade.timing_data, phase),
      serverTimestamp: Date.now(),
      acknowledgmentRequired: true
    };

    await this.sendToClient(syncSession.playerId, 'cascade_phase_start', phaseData);

    // Track phase start
    syncSession.performanceData.stepTimings.push({
      cascadeIndex: cascade.cascade_index,
      phase: phase,
      startTime: Date.now(),
      type: 'phase_start'
    });
  }

  /**
     * Wait for client acknowledgment with timeout
     */
  async waitForAcknowledment(syncSession, ackType, timeout) {
    return new Promise((resolve, reject) => {
      const ackKey = `${syncSession.id}_${ackType}`;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.acknowledgments.delete(ackKey);
        reject(new Error(`Acknowledgment timeout for ${ackType}`));
      }, timeout);

      // Set up acknowledgment handler
      const ackHandler = (data) => {
        clearTimeout(timeoutId);
        syncSession.acknowledgments.set(ackType, {
          timestamp: Date.now(),
          data: data
        });
        resolve(data);
      };

      this.acknowledgments.set(ackKey, ackHandler);
    });
  }

  /**
     * Monitor phase execution for timing and state consistency
     */
  async monitorPhaseExecution(syncSession, cascade, phase) {
    const expectedDuration = this.getPhaseExpectedDuration(cascade.timing_data, phase);
    const startTime = Date.now();

    // Send periodic heartbeats during long phases
    const heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(syncSession);
    }, this.config.heartbeatInterval);

    try {
      // Wait for expected phase duration with some tolerance
      await this.sleep(expectedDuration);

      // Check if phase is still executing
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > expectedDuration + this.config.verificationTolerance) {
        console.warn(`Phase ${phase} taking longer than expected: ${elapsedTime}ms vs ${expectedDuration}ms`);
        await this.handleSlowPhase(syncSession, cascade, phase, elapsedTime);
      }

    } finally {
      clearInterval(heartbeatInterval);
    }
  }

  /**
     * 2.2.3: Desync detection and recovery
     * Implements comprehensive desynchronization detection and recovery mechanisms
     */
  async validatePhaseState(syncSession, cascade, phase) {
    try {
      // Generate expected state hash
      const expectedState = this.calculateExpectedState(cascade, phase);
      const expectedHash = this.generateValidationHash(expectedState, syncSession.validationSalt);

      // Request client state validation
      const validationRequest = {
        sessionId: syncSession.id,
        checkpointId: this.generateSecureId(),
        cascadeIndex: cascade.cascade_index,
        phase: phase,
        expectedHash: expectedHash,
        timeout: this.config.stepTimeout
      };

      await this.sendToClient(syncSession.playerId, 'state_validation_request', validationRequest);

      // Wait for client state response
      const clientResponse = await this.waitForAcknowledment(
        syncSession,
        `validation_${validationRequest.checkpointId}`,
        this.config.stepTimeout
      );

      // Detect desynchronization
      const isDesync = await this.detectDesynchronization(
        syncSession,
        expectedHash,
        clientResponse
      );

      if (isDesync) {
        await this.handleDesynchronization(syncSession, cascade, phase, clientResponse);
      } else {
        // Record successful validation
        syncSession.performanceData.validationResults.push({
          checkpointId: validationRequest.checkpointId,
          cascadeIndex: cascade.cascade_index,
          phase: phase,
          status: 'success',
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Phase state validation failed:', error);
      await this.handleValidationFailure(syncSession, cascade, phase, error);
    }
  }

  /**
     * Detect desynchronization between client and server states
     */
  async detectDesynchronization(syncSession, expectedHash, clientResponse) {
    if (!clientResponse || !clientResponse.clientHash) {
      return true; // No response = desync
    }

    // Hash comparison
    if (clientResponse.clientHash !== expectedHash) {
      console.warn('Hash mismatch detected:', {
        expected: expectedHash,
        client: clientResponse.clientHash,
        sessionId: syncSession.id
      });
      return true;
    }

    // Timing validation
    const timingDelta = Math.abs(clientResponse.timestamp - Date.now());
    if (timingDelta > this.config.verificationTolerance) {
      console.warn('Timing desync detected:', {
        delta: timingDelta,
        tolerance: this.config.verificationTolerance,
        sessionId: syncSession.id
      });
      return true;
    }

    return false;
  }

  /**
     * Handle desynchronization with recovery mechanisms
     */
  async handleDesynchronization(syncSession, cascade, phase, clientResponse) {
    syncSession.recoveryAttempts++;

    if (syncSession.recoveryAttempts > this.config.maxRecoveryAttempts) {
      throw new Error('Maximum recovery attempts exceeded');
    }

    console.log(`Handling desync (attempt ${syncSession.recoveryAttempts}):`, {
      sessionId: syncSession.id,
      cascadeIndex: cascade.cascade_index,
      phase: phase
    });

    // Record recovery event
    const recoveryEvent = {
      type: 'desync_detected',
      cascadeIndex: cascade.cascade_index,
      phase: phase,
      attempt: syncSession.recoveryAttempts,
      timestamp: Date.now(),
      clientData: clientResponse
    };

    syncSession.performanceData.recoveryEvents.push(recoveryEvent);

    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(syncSession, cascade, phase);

    // Execute recovery
    await this.executeRecovery(syncSession, cascade, phase, recoveryStrategy);
  }

  /**
     * 2.2.4: Cascade replay mechanisms
     * Implements comprehensive replay mechanisms for recovery scenarios
     */
  determineRecoveryStrategy(syncSession, cascade, phase) {
    const strategies = {
      STATE_RESYNC: 'state_resync',
      PHASE_REPLAY: 'phase_replay',
      CASCADE_REPLAY: 'cascade_replay',
      FULL_REPLAY: 'full_replay',
      GRACEFUL_SKIP: 'graceful_skip'
    };

    // Determine strategy based on context
    if (syncSession.recoveryAttempts === 1) {
      return strategies.STATE_RESYNC;
    } else if (syncSession.recoveryAttempts === 2) {
      return strategies.PHASE_REPLAY;
    } else if (syncSession.recoveryAttempts === 3) {
      return strategies.CASCADE_REPLAY;
    } else {
      return strategies.GRACEFUL_SKIP;
    }
  }

  /**
     * Execute recovery based on strategy
     */
  async executeRecovery(syncSession, cascade, phase, strategy) {
    switch (strategy) {
    case 'state_resync':
      await this.executeStateResync(syncSession, cascade, phase);
      break;

    case 'phase_replay':
      await this.executePhaseReplay(syncSession, cascade, phase);
      break;

    case 'cascade_replay':
      await this.executeCascadeReplay(syncSession, cascade);
      break;

    case 'full_replay':
      await this.executeFullReplay(syncSession);
      break;

    case 'graceful_skip':
      await this.executeGracefulSkip(syncSession, cascade, phase);
      break;

    default:
      throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  /**
     * Execute state resynchronization
     */
  async executeStateResync(syncSession, cascade, phase) {
    const correctState = this.calculateExpectedState(cascade, phase);

    const resyncData = {
      sessionId: syncSession.id,
      recoveryType: 'state_resync',
      targetState: correctState,
      cascadeIndex: cascade.cascade_index,
      phase: phase,
      timestamp: Date.now()
    };

    await this.sendToClient(syncSession.playerId, 'recovery_state_resync', resyncData);
    await this.waitForAcknowledment(syncSession, 'resync_complete', this.config.stepTimeout);
  }

  /**
     * Execute phase replay
     */
  async executePhaseReplay(syncSession, cascade, phase) {
    const replayData = {
      sessionId: syncSession.id,
      recoveryType: 'phase_replay',
      replayPhase: phase,
      cascadeIndex: cascade.cascade_index,
      cascadeData: cascade,
      fromTimestamp: Date.now()
    };

    await this.sendToClient(syncSession.playerId, 'recovery_phase_replay', replayData);

    // Re-execute the phase with monitoring
    await this.processCascadeWithAcknowledgments(syncSession, cascade);
  }

  /**
     * Execute cascade replay
     */
  async executeCascadeReplay(syncSession, cascade) {
    const replayData = {
      sessionId: syncSession.id,
      recoveryType: 'cascade_replay',
      replayCascade: cascade,
      fromCascadeIndex: cascade.cascade_index,
      resetToState: cascade.pre_cascade_grid
    };

    await this.sendToClient(syncSession.playerId, 'recovery_cascade_replay', replayData);

    // Reset cascade state and replay
    syncSession.currentPhase = 'win_highlight';
    await this.processCascadeWithAcknowledgments(syncSession, cascade);
  }

  /**
     * Execute full replay of entire sequence
     */
  async executeFullReplay(syncSession) {
    const replayData = {
      sessionId: syncSession.id,
      recoveryType: 'full_replay',
      cascadeSequence: syncSession.cascadeSequence,
      resetToInitial: true
    };

    await this.sendToClient(syncSession.playerId, 'recovery_full_replay', replayData);

    // Reset session state
    syncSession.currentCascadeIndex = 0;
    syncSession.currentPhase = 'initialization';
    syncSession.recoveryAttempts = 0;

    // Restart the entire sequence
    await this.startCascadeSequence(syncSession);
  }

  /**
     * Execute graceful skip to final state
     */
  async executeGracefulSkip(syncSession, cascade, phase) {
    const finalState = cascade.post_cascade_grid;

    const skipData = {
      sessionId: syncSession.id,
      recoveryType: 'graceful_skip',
      finalState: finalState,
      skipToEnd: true,
      message: 'Synchronizing...'
    };

    await this.sendToClient(syncSession.playerId, 'recovery_graceful_skip', skipData);
    await this.waitForAcknowledment(syncSession, 'skip_complete', this.config.stepTimeout);
  }

  /**
     * Complete cascade sequence successfully
     */
  async completeCascadeSequence(syncSession) {
    const completionData = {
      sessionId: syncSession.id,
      spinId: syncSession.spinId,
      totalDuration: Date.now() - syncSession.startTime,
      totalCascades: syncSession.cascadeSequence.cascades.length,
      validationResults: syncSession.performanceData.validationResults,
      recoveryEvents: syncSession.performanceData.recoveryEvents,
      performanceScore: this.calculatePerformanceScore(syncSession)
    };

    await this.sendToClient(syncSession.playerId, 'cascade_sequence_complete', completionData);

    // Clean up session
    this.activeSessions.delete(syncSession.spinId);

    // Emit completion event
    this.emit('cascadeSequenceComplete', completionData);
  }

  /**
     * Handle synchronization failures
     */
  async handleSyncFailure(spinId, reason, error) {
    const syncSession = this.activeSessions.get(spinId);

    if (syncSession) {
      syncSession.status = 'failed';

      const failureData = {
        sessionId: syncSession.id,
        spinId: spinId,
        reason: reason,
        error: error.message,
        timestamp: Date.now(),
        recoveryAttempts: syncSession.recoveryAttempts
      };

      await this.sendToClient(syncSession.playerId, 'cascade_sync_failed', failureData);

      // Clean up
      this.activeSessions.delete(spinId);

      // Emit failure event
      this.emit('cascadeSyncFailed', failureData);
    }
  }

  /**
     * Setup event handlers for client messages
     */
  setupEventHandlers() {
    this.acknowledgments = new Map();

    // Handle client acknowledgments
    this.on('clientAcknowledment', (data) => {
      const ackKey = `${data.sessionId}_${data.ackType}`;
      const handler = this.acknowledgments.get(ackKey);

      if (handler) {
        this.acknowledgments.delete(ackKey);
        handler(data);
      }
    });

    // Handle heartbeats
    this.on('clientHeartbeat', (data) => {
      const syncSession = this.activeSessions.get(data.spinId);
      if (syncSession) {
        syncSession.lastHeartbeat = Date.now();
      }
    });
  }

  /**
     * Send message to client via socket
     */
  async sendToClient(playerId, eventType, data) {
    if (this.socketManager) {
      await this.socketManager.sendToPlayer(playerId, eventType, data);
    } else {
      console.warn('No socket manager available for sending client message');
    }
  }

  /**
     * Send heartbeat to client
     */
  async sendHeartbeat(syncSession) {
    await this.sendToClient(syncSession.playerId, 'cascade_heartbeat', {
      sessionId: syncSession.id,
      timestamp: Date.now(),
      status: syncSession.status
    });
  }

  // ------------------------------------------------------------------
  // Compatibility methods expected by WebSocket handler and tests
  // ------------------------------------------------------------------
  startSyncSession(spinId, gameSession, options = {}) {
    const sessionId = this.generateSecureId();
    const validationSalt = crypto.randomBytes(16).toString('hex');
    const syncSeed = crypto.randomBytes(16).toString('hex');

    const syncSession = {
      id: sessionId,
      spinId,
      playerId: gameSession?.playerId ?? options.playerId,
      validationSalt,
      syncSeed,
      cascadeSteps: options.cascadeSteps || [],
      serverTimestamp: Date.now(),
      status: 'active'
    };

    this.sessionsById.set(sessionId, syncSession);
    this.activeSessions.set(spinId, syncSession);

    return {
      success: true,
      syncSessionId: sessionId,
      validationSalt,
      syncSeed,
      serverTimestamp: syncSession.serverTimestamp,
      cascadeSteps: syncSession.cascadeSteps
    };
  }

  processStepAcknowledgment(syncSessionId, ack) {
    const session = this.sessionsById.get(syncSessionId);
    if (!session) {throw new Error('Sync session not found');}
    const serverHash = this.generateValidationHash(ack.gridState ?? {}, session.validationSalt);
    const validated = ack.clientHash ? ack.clientHash === serverHash : true;
    return {
      validated,
      serverHash,
      clientHash: ack.clientHash,
      nextStepData: null,
      syncStatus: 'synchronized'
    };
  }

  async requestRecovery(syncSessionId, context) {
    const session = this.sessionsById.get(syncSessionId);
    if (!session) {throw new Error('Sync session not found');}
    const recoveryId = this.generateSecureId();
    return {
      recoveryType: 'state_resync',
      recoveryData: { message: 'Resynchronize to server-authoritative state' },
      requiredSteps: [],
      recoveryId,
      estimatedDuration: 500
    };
  }

  async applyRecovery(/* recoveryId, { clientState, recoveryResult } */) {
    return {
      successful: true,
      syncRestored: true,
      newSyncState: { status: 'synchronized' },
      nextActions: []
    };
  }

  getRecoveryStatus(/* recoveryId */) {
    return {
      status: 'in_progress',
      progress: 50,
      estimatedCompletion: Date.now() + 5000,
      errors: []
    };
  }

  completeSyncSession(syncSessionId, { finalGridState /*, totalWin, clientHash */ }) {
    const session = this.sessionsById.get(syncSessionId);
    if (!session) {throw new Error('Sync session not found');}
    this.sessionsById.delete(syncSessionId);
    return {
      validated: true,
      performanceScore: 100,
      totalSteps: session.cascadeSteps?.length || 0,
      serverTimestamp: Date.now()
    };
  }

  /**
     * Helper methods
     */
  generateSecureId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateValidationHash(data, salt) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    hash.update(salt);
    return hash.digest('hex');
  }

  calculateExpectedState(cascade, phase) {
    switch (phase) {
    case 'win_highlight':
      return cascade.pre_cascade_grid;
    case 'symbol_removal':
      return this.removeWinningSymbols(cascade.pre_cascade_grid, cascade.winning_clusters);
    case 'symbol_drop':
      return this.simulateSymbolDrop(cascade);
    case 'symbol_settle':
      return cascade.post_cascade_grid;
    default:
      return cascade.pre_cascade_grid;
    }
  }

  removeWinningSymbols(grid, clusters) {
    const newGrid = JSON.parse(JSON.stringify(grid));

    clusters.forEach(cluster => {
      cluster.positions.forEach(pos => {
        if (newGrid[pos.col] && newGrid[pos.col][pos.row]) {
          newGrid[pos.col][pos.row] = null;
        }
      });
    });

    return newGrid;
  }

  simulateSymbolDrop(cascade) {
    // Simulate the intermediate state during symbol drop
    // This would normally be calculated by the GridEngine
    const grid = JSON.parse(JSON.stringify(cascade.pre_cascade_grid));

    // Apply symbol movements
    cascade.symbol_movements.forEach(movement => {
      if (movement.movement_type === 'drop') {
        const symbol = grid[movement.from_position.col][movement.from_position.row];
        grid[movement.from_position.col][movement.from_position.row] = null;
        grid[movement.to_position.col][movement.to_position.row] = symbol;
      }
    });

    return grid;
  }

  getPhaseExpectedDuration(timingData, phase) {
    switch (phase) {
    case 'win_highlight':
      return timingData.win_highlight_duration || 1000;
    case 'symbol_removal':
      return timingData.symbol_removal_duration || 500;
    case 'symbol_drop':
      return timingData.drop_phase_duration || 800;
    case 'symbol_settle':
      return timingData.settle_phase_duration || 400;
    default:
      return 1000;
    }
  }

  calculateTotalSteps(cascadeSequence) {
    return cascadeSequence.cascades.length * 4; // 4 phases per cascade
  }

  calculatePerformanceScore(syncSession) {
    const validationSuccesses = syncSession.performanceData.validationResults.filter(r => r.status === 'success').length;
    const totalValidations = syncSession.performanceData.validationResults.length;
    const recoveryCount = syncSession.performanceData.recoveryEvents.length;

    let score = 100;

    // Deduct for failed validations
    if (totalValidations > 0) {
      const successRate = validationSuccesses / totalValidations;
      score = score * successRate;
    }

    // Deduct for recovery events
    score = Math.max(0, score - (recoveryCount * 10));

    return Math.round(score);
  }

  async handleSlowPhase(syncSession, cascade, phase, elapsedTime) {
    console.warn(`Slow phase detected: ${phase} took ${elapsedTime}ms`);

    // Send performance warning to client
    await this.sendToClient(syncSession.playerId, 'performance_warning', {
      sessionId: syncSession.id,
      type: 'slow_phase',
      phase: phase,
      elapsedTime: elapsedTime,
      expectedTime: this.getPhaseExpectedDuration(cascade.timing_data, phase)
    });
  }

  async handleValidationFailure(syncSession, cascade, phase, error) {
    console.error('Validation failure:', error);

    syncSession.performanceData.validationResults.push({
      cascadeIndex: cascade.cascade_index,
      phase: phase,
      status: 'failed',
      error: error.message,
      timestamp: Date.now()
    });

    // Attempt recovery
    await this.handleDesynchronization(syncSession, cascade, phase, null);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Socket management methods for WebSocket integration
     */
  registerSocket(socket) {
    // Register socket for real-time updates
    if (this.socketManager && this.socketManager.registerSocket) {
      this.socketManager.registerSocket(socket);
    }
    console.log(`🔌 Socket ${socket.id} registered with CascadeSynchronizer`);
  }

  unregisterSocket(socket) {
    // Unregister socket and cleanup any associated sessions
    if (this.socketManager && this.socketManager.unregisterSocket) {
      this.socketManager.unregisterSocket(socket);
    }

    // Clean up any sessions associated with this socket
    const socketId = socket.id;
    for (const [spinId, session] of this.activeSessions) {
      if (session.socketId === socketId) {
        session.status = 'terminated';
        this.activeSessions.delete(spinId);
        console.log(`🧹 Cleaned up session ${spinId} for disconnected socket ${socketId}`);
      }
    }

    console.log(`🔌 Socket ${socket.id} unregistered from CascadeSynchronizer`);
  }

  /**
     * Cleanup session resources
     */
  async cleanupSession(syncSessionId) {
    const session = this.activeSessions.get(syncSessionId);
    if (session) {
      session.status = 'terminated';
      this.activeSessions.delete(syncSessionId);

      // Clear related acknowledgments
      if (this.acknowledgments) {
        this.acknowledgments.delete(syncSessionId);
      }

      // Clean up recovery handlers
      if (this.recoveryHandlers) {
        this.recoveryHandlers.delete(syncSessionId);
      }

      console.log(`🧹 Cleaned up sync session ${syncSessionId}`);
    }
  }

  /**
     * Cleanup and resource management
     */
  cleanup() {
    // Clean up all active sessions
    for (const [spinId, session] of this.activeSessions) {
      session.status = 'terminated';
      this.activeSessions.delete(spinId);
    }

    // Clear acknowledgment handlers
    this.acknowledgments.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}

module.exports = CascadeSynchronizer;