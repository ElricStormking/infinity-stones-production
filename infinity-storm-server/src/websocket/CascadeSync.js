/**
 * CascadeSync.js - Real-Time Cascade Synchronization WebSocket Handler
 *
 * Provides dedicated WebSocket event handlers for real-time cascade synchronization
 * between client and server. Handles step-by-step cascade progression with
 * validation, acknowledgments, and recovery mechanisms.
 *
 * Task 5.1 Implementation:
 * - 5.1.1: Implement cascade step broadcasting
 * - 5.1.2: Add client acknowledgment handling
 * - 5.1.3: Create synchronization recovery mechanisms
 * - 5.1.4: Add real-time validation feedback
 */

const CascadeSynchronizer = require('../services/CascadeSynchronizer');
const CascadeValidator = require('../services/CascadeValidator');
const GameSession = require('../models/GameSession');

class CascadeSync {
  constructor(io, cascadeSynchronizer, cascadeValidator) {
    this.io = io;
    this.cascadeSynchronizer = cascadeSynchronizer || new CascadeSynchronizer();
    this.cascadeValidator = cascadeValidator || new CascadeValidator();

    // Track active connections and sync sessions
    this.activeSockets = new Map();
    this.activeManagers = new Map();
    this.broadcastQueue = new Map();

    // Performance monitoring
    this.metrics = {
      connectionsCount: 0,
      activeSessions: 0,
      totalBroadcasts: 0,
      acknowledgmentRate: 0,
      averageResponseTime: 0
    };

    // Configuration
    this.config = {
      broadcastTimeout: 5000,      // 5 seconds for step broadcasts
      acknowledgmentTimeout: 3000, // 3 seconds for acknowledgments
      maxRetryAttempts: 3,         // Maximum recovery attempts
      heartbeatInterval: 30000,    // 30 seconds heartbeat
      syncToleranceMs: 1000        // 1 second synchronization tolerance
    };

    console.log('🔄 CascadeSync WebSocket handler initialized');
  }

  /**
     * 5.1.1: Implement cascade step broadcasting
     * Handles real-time broadcasting of cascade steps to connected clients
     */
  setupSocketHandlers(socket) {
    console.log(`🔌 Setting up cascade sync handlers for socket ${socket.id}`);

    // Register socket with tracking
    this.activeSockets.set(socket.id, {
      socket: socket,
      joinedAt: Date.now(),
      syncSessions: new Set(),
      lastHeartbeat: Date.now(),
      metrics: {
        stepsReceived: 0,
        acknowledgmentsSent: 0,
        desyncsDetected: 0,
        recoveryAttempts: 0
      }
    });

    this.metrics.connectionsCount++;

    // Set up heartbeat monitoring
    this.setupHeartbeat(socket);

    // 5.1.1: Cascade step broadcasting handlers
    this.setupStepBroadcastHandlers(socket);

    // 5.1.2: Client acknowledgment handling
    this.setupAcknowledmentHandlers(socket);

    // 5.1.3: Synchronization recovery mechanisms
    this.setupRecoveryHandlers(socket);

    // 5.1.4: Real-time validation feedback
    this.setupValidationHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnect(socket));

    console.log(`✅ Cascade sync handlers ready for socket ${socket.id}`);
  }

  /**
     * Setup step broadcasting handlers for real-time cascade communication
     */
  setupStepBroadcastHandlers(socket) {
    // Initialize cascade sync session
    socket.on('cascade_sync_start', async (data) => {
      try {
        const startTime = Date.now();
        const { spinId, playerId, gridState, enableBroadcast = true } = data;

        console.log(`🎬 CASCADE_SYNC_START: spinId=${spinId}, playerId=${playerId}, broadcast=${enableBroadcast}`);

        // Validate input data
        if (!spinId || !playerId || !gridState) {
          throw new Error('Missing required fields: spinId, playerId, gridState');
        }

        // Create or get game session
        const GameSessionClass = global.GameSession || require('../models/GameSession');
        const gameSession = new GameSessionClass(playerId);
        await gameSession.initialize();

        // Start synchronization session
        const syncSession = await this.cascadeSynchronizer.startSyncSession(spinId, gameSession, {
          initialGridState: gridState,
          clientTimestamp: Date.now(),
          socketId: socket.id,
          broadcastEnabled: enableBroadcast
        });

        // Register session with socket tracking
        const socketData = this.activeSockets.get(socket.id);
        if (socketData) {
          socketData.syncSessions.add(syncSession.syncSessionId);
        }

        // Create cascade step manager for broadcasting
        const stepManager = this.createStepManager(socket, syncSession);
        this.activeManagers.set(syncSession.syncSessionId, stepManager);

        this.metrics.activeSessions++;

        // Emit success response with sync session data
        const responseData = {
          success: true,
          syncSessionId: syncSession.syncSessionId,
          validationSalt: syncSession.validationSalt,
          syncSeed: syncSession.syncSeed,
          serverTimestamp: syncSession.serverTimestamp,
          broadcastEnabled: enableBroadcast,
          processingTime: Date.now() - startTime
        };

        socket.emit('sync_session_start', responseData);

        // Start broadcasting cascade steps if enabled
        if (enableBroadcast && syncSession.cascadeSteps && syncSession.cascadeSteps.length > 0) {
          this.startStepBroadcasting(syncSession.syncSessionId, syncSession.cascadeSteps);
        }

        console.log(`✅ Sync session ${syncSession.syncSessionId} started for socket ${socket.id}`);

      } catch (error) {
        console.error('CASCADE_SYNC_START error:', error);
        socket.emit('sync_session_start', {
          success: false,
          error: 'SYNC_START_FAILED',
          errorMessage: error.message || 'Failed to start cascade synchronization'
        });
      }
    });

    // Handle step progression requests
    socket.on('cascade_step_next', async (data) => {
      try {
        const { syncSessionId, currentStepIndex, readyForNext = true } = data;

        console.log(`⏭️ CASCADE_STEP_NEXT: session=${syncSessionId}, step=${currentStepIndex}, ready=${readyForNext}`);

        const stepManager = this.activeManagers.get(syncSessionId);
        if (!stepManager) {
          throw new Error(`Step manager not found for session ${syncSessionId}`);
        }

        if (readyForNext) {
          await this.broadcastNextStep(syncSessionId, currentStepIndex + 1);
        } else {
          await this.pauseStepBroadcasting(syncSessionId);
        }

      } catch (error) {
        console.error('CASCADE_STEP_NEXT error:', error);
        socket.emit('step_broadcast_error', {
          error: 'STEP_NEXT_FAILED',
          errorMessage: error.message
        });
      }
    });

    // Handle manual step control
    socket.on('cascade_step_control', async (data) => {
      try {
        const { syncSessionId, action, stepIndex } = data;

        console.log(`🎮 CASCADE_STEP_CONTROL: session=${syncSessionId}, action=${action}, step=${stepIndex}`);

        const stepManager = this.activeManagers.get(syncSessionId);
        if (!stepManager) {
          throw new Error(`Step manager not found for session ${syncSessionId}`);
        }

        switch (action) {
        case 'pause':
          await this.pauseStepBroadcasting(syncSessionId);
          break;
        case 'resume':
          await this.resumeStepBroadcasting(syncSessionId);
          break;
        case 'skip_to':
          await this.skipToStep(syncSessionId, stepIndex);
          break;
        case 'restart':
          await this.restartStepBroadcasting(syncSessionId);
          break;
        default:
          throw new Error(`Unknown step control action: ${action}`);
        }

        socket.emit('step_control_response', {
          success: true,
          action: action,
          stepIndex: stepManager.currentStepIndex,
          status: stepManager.status
        });

      } catch (error) {
        console.error('CASCADE_STEP_CONTROL error:', error);
        socket.emit('step_control_response', {
          success: false,
          error: 'STEP_CONTROL_FAILED',
          errorMessage: error.message
        });
      }
    });
  }

  /**
     * 5.1.2: Add client acknowledgment handling
     * Processes client acknowledgments for cascade steps
     */
  setupAcknowledmentHandlers(socket) {
    // Process step validation acknowledgments
    socket.on('step_validation_request', async (data) => {
      try {
        const startTime = Date.now();
        const { syncSessionId, stepIndex, gridState, clientHash, clientTimestamp, phaseType } = data;

        console.log(`✅ STEP_VALIDATION_REQUEST: session=${syncSessionId}, step=${stepIndex}, phase=${phaseType}`);

        // Validate input data
        if (!syncSessionId || stepIndex === undefined || !gridState) {
          throw new Error('Missing required fields: syncSessionId, stepIndex, gridState');
        }

        // Process acknowledgment through CascadeSynchronizer
        const acknowledgment = await this.cascadeSynchronizer.processStepAcknowledgment(syncSessionId, {
          stepIndex,
          gridState,
          clientHash,
          clientTimestamp,
          serverTimestamp: Date.now(),
          phaseType,
          socketId: socket.id
        });

        // Update socket metrics
        const socketData = this.activeSockets.get(socket.id);
        if (socketData) {
          socketData.metrics.acknowledgmentsSent++;
        }

        // Generate real-time validation feedback
        const validationFeedback = await this.generateValidationFeedback(
          acknowledgment,
          stepIndex,
          Date.now() - startTime
        );

        // Emit acknowledgment response
        const responseData = {
          success: true,
          stepIndex,
          phaseType,
          stepValidated: acknowledgment.validated,
          serverHash: acknowledgment.serverHash,
          nextStepData: acknowledgment.nextStepData,
          syncStatus: acknowledgment.syncStatus,
          validationFeedback,
          processingTime: Date.now() - startTime
        };

        socket.emit('step_validation_response', responseData);

        // Update step manager status
        const stepManager = this.activeManagers.get(syncSessionId);
        if (stepManager) {
          stepManager.lastAcknowledgment = Date.now();
          stepManager.acknowledgmentCount++;

          // Auto-advance to next step if acknowledgment successful
          if (acknowledgment.validated && stepManager.autoBroadcast) {
            setTimeout(() => {
              this.broadcastNextStep(syncSessionId, stepIndex + 1);
            }, stepManager.stepInterval || 1000);
          }
        }

        console.log(`✅ Step ${stepIndex} acknowledged for session ${syncSessionId}`);

      } catch (error) {
        console.error('STEP_VALIDATION_REQUEST error:', error);
        socket.emit('step_validation_response', {
          success: false,
          error: 'STEP_VALIDATION_FAILED',
          errorMessage: error.message || 'Failed to validate cascade step'
        });
      }
    });

    // Handle acknowledgment timeouts
    socket.on('acknowledgment_timeout', async (data) => {
      try {
        const { syncSessionId, stepIndex, timeoutReason } = data;

        console.log(`⏰ ACKNOWLEDGMENT_TIMEOUT: session=${syncSessionId}, step=${stepIndex}, reason=${timeoutReason}`);

        const stepManager = this.activeManagers.get(syncSessionId);
        if (stepManager) {
          stepManager.timeoutCount++;

          // Handle timeout based on configuration
          if (stepManager.timeoutCount >= this.config.maxRetryAttempts) {
            await this.initiateRecovery(syncSessionId, 'acknowledgment_timeout', {
              stepIndex,
              timeoutReason,
              timeoutCount: stepManager.timeoutCount
            });
          } else {
            // Retry acknowledgment request
            await this.retryStepAcknowledgment(syncSessionId, stepIndex);
          }
        }

      } catch (error) {
        console.error('ACKNOWLEDGMENT_TIMEOUT error:', error);
      }
    });

    // Handle batch acknowledgment processing
    socket.on('batch_acknowledgment', async (data) => {
      try {
        const { syncSessionId, acknowledgments } = data;

        console.log(`📦 BATCH_ACKNOWLEDGMENT: session=${syncSessionId}, count=${acknowledgments.length}`);

        const results = [];

        for (const ack of acknowledgments) {
          try {
            const result = await this.cascadeSynchronizer.processStepAcknowledgment(syncSessionId, {
              ...ack,
              serverTimestamp: Date.now(),
              socketId: socket.id
            });
            results.push({ stepIndex: ack.stepIndex, success: true, result });
          } catch (error) {
            results.push({ stepIndex: ack.stepIndex, success: false, error: error.message });
          }
        }

        socket.emit('batch_acknowledgment_response', {
          success: true,
          syncSessionId,
          results,
          totalProcessed: results.length
        });

      } catch (error) {
        console.error('BATCH_ACKNOWLEDGMENT error:', error);
        socket.emit('batch_acknowledgment_response', {
          success: false,
          error: 'BATCH_PROCESSING_FAILED',
          errorMessage: error.message
        });
      }
    });
  }

  /**
     * 5.1.3: Create synchronization recovery mechanisms
     * Handles desync detection and recovery coordination
     */
  setupRecoveryHandlers(socket) {
    // Handle desync detection events
    socket.on('desync_detected', async (data) => {
      try {
        const startTime = Date.now();
        const { syncSessionId, desyncType, clientState, stepIndex, desyncDetails } = data;

        console.log(`⚠️ DESYNC_DETECTED: session=${syncSessionId}, type=${desyncType}, step=${stepIndex}`);

        // Update socket metrics
        const socketData = this.activeSockets.get(socket.id);
        if (socketData) {
          socketData.metrics.desyncsDetected++;
        }

        // Request recovery data through CascadeSynchronizer
        const recovery = await this.cascadeSynchronizer.requestRecovery(syncSessionId, {
          desyncType,
          clientState,
          stepIndex,
          desyncDetails,
          requestTimestamp: Date.now(),
          socketId: socket.id
        });

        // Update step manager with recovery status
        const stepManager = this.activeManagers.get(syncSessionId);
        if (stepManager) {
          stepManager.recoveryCount++;
          stepManager.lastRecovery = Date.now();
          stepManager.status = 'recovering';
        }

        // Emit recovery data
        const recoveryData = {
          success: true,
          syncSessionId,
          desyncType,
          recoveryType: recovery.recoveryType,
          recoveryData: recovery.recoveryData,
          requiredSteps: recovery.requiredSteps,
          recoveryId: recovery.recoveryId,
          estimatedDuration: recovery.estimatedDuration,
          processingTime: Date.now() - startTime
        };

        socket.emit('recovery_data', recoveryData);

        // Pause step broadcasting during recovery
        await this.pauseStepBroadcasting(syncSessionId);

        console.log(`🔧 Recovery initiated for session ${syncSessionId}: ${recovery.recoveryType}`);

      } catch (error) {
        console.error('DESYNC_DETECTED error:', error);
        socket.emit('recovery_data', {
          success: false,
          error: 'DESYNC_RECOVERY_FAILED',
          errorMessage: error.message || 'Failed to handle desynchronization'
        });
      }
    });

    // Handle recovery application
    socket.on('recovery_apply', async (data) => {
      try {
        const { recoveryId, clientState, recoveryResult, syncSessionId } = data;

        console.log(`🔧 RECOVERY_APPLY: id=${recoveryId}, session=${syncSessionId}`);

        // Apply recovery through CascadeSynchronizer
        const application = await this.cascadeSynchronizer.applyRecovery(recoveryId, {
          clientState,
          recoveryResult,
          applicationTimestamp: Date.now(),
          socketId: socket.id
        });

        // Update step manager status
        const stepManager = this.activeManagers.get(syncSessionId);
        if (stepManager && application.successful) {
          stepManager.status = 'synchronized';
          stepManager.lastSync = Date.now();

          // Resume broadcasting if recovery successful
          if (stepManager.autoBroadcast) {
            await this.resumeStepBroadcasting(syncSessionId);
          }
        }

        socket.emit('recovery_apply_response', {
          success: true,
          recoveryId,
          recoverySuccessful: application.successful,
          syncRestored: application.syncRestored,
          newSyncState: application.newSyncState,
          nextActions: application.nextActions
        });

        console.log(`✅ Recovery applied for session ${syncSessionId}: ${application.successful ? 'SUCCESS' : 'FAILED'}`);

      } catch (error) {
        console.error('RECOVERY_APPLY error:', error);
        socket.emit('recovery_apply_response', {
          success: false,
          error: 'RECOVERY_APPLY_FAILED',
          errorMessage: error.message
        });
      }
    });

    // Handle recovery status requests
    socket.on('recovery_status', async (data) => {
      try {
        const { recoveryId } = data;

        const status = await this.cascadeSynchronizer.getRecoveryStatus(recoveryId);

        socket.emit('recovery_status_response', {
          success: true,
          recoveryId,
          status: status.status,
          progress: status.progress,
          estimatedCompletion: status.estimatedCompletion,
          errors: status.errors
        });

      } catch (error) {
        console.error('RECOVERY_STATUS error:', error);
        socket.emit('recovery_status_response', {
          success: false,
          error: 'RECOVERY_STATUS_FAILED',
          errorMessage: error.message
        });
      }
    });

    // Handle forced resync requests
    socket.on('force_resync', async (data) => {
      try {
        const { syncSessionId, fromStepIndex = 0 } = data;

        console.log(`🔄 FORCE_RESYNC: session=${syncSessionId}, fromStep=${fromStepIndex}`);

        const stepManager = this.activeManagers.get(syncSessionId);
        if (stepManager) {
          stepManager.currentStepIndex = fromStepIndex;
          stepManager.status = 'resyncing';
          stepManager.lastSync = Date.now();
        }

        // Restart broadcasting from specified step
        await this.restartStepBroadcasting(syncSessionId, fromStepIndex);

        socket.emit('force_resync_response', {
          success: true,
          syncSessionId,
          fromStepIndex,
          newStatus: stepManager ? stepManager.status : 'unknown'
        });

      } catch (error) {
        console.error('FORCE_RESYNC error:', error);
        socket.emit('force_resync_response', {
          success: false,
          error: 'FORCE_RESYNC_FAILED',
          errorMessage: error.message
        });
      }
    });
  }

  /**
     * 5.1.4: Add real-time validation feedback
     * Provides immediate validation feedback for client actions
     */
  setupValidationHandlers(socket) {
    // Handle real-time grid validation
    socket.on('grid_validation_request', async (data) => {
      try {
        const startTime = Date.now();
        const { gridState, expectedHash, salt, syncSessionId } = data;

        console.log(`🔍 GRID_VALIDATION_REQUEST: session=${syncSessionId || 'standalone'}`);

        // Validate grid state using CascadeValidator
        const validation = await this.cascadeValidator.validateGridState(gridState, {
          expectedHash,
          salt
        });

        const feedback = {
          success: true,
          valid: validation.valid,
          generatedHash: validation.hash,
          errors: validation.errors,
          fraudScore: validation.fraudScore,
          validationTime: Date.now() - startTime,
          timestamp: Date.now()
        };

        socket.emit('grid_validation_response', feedback);

        // Send real-time feedback if validation failed
        if (!validation.valid) {
          this.sendValidationAlert(socket, {
            type: 'grid_validation_failed',
            severity: validation.fraudScore > 0.5 ? 'high' : 'medium',
            details: validation.errors,
            syncSessionId
          });
        }

      } catch (error) {
        console.error('GRID_VALIDATION_REQUEST error:', error);
        socket.emit('grid_validation_response', {
          success: false,
          error: 'GRID_VALIDATION_FAILED',
          errorMessage: error.message
        });
      }
    });

    // Handle step validation feedback
    socket.on('step_validation_feedback', async (data) => {
      try {
        const { syncSessionId, stepIndex, validationResult, clientMetrics } = data;

        console.log(`📊 STEP_VALIDATION_FEEDBACK: session=${syncSessionId}, step=${stepIndex}`);

        // Process feedback and update session metrics
        const stepManager = this.activeManagers.get(syncSessionId);
        if (stepManager) {
          stepManager.validationResults = stepManager.validationResults || [];
          stepManager.validationResults.push({
            stepIndex,
            result: validationResult,
            clientMetrics,
            timestamp: Date.now()
          });
        }

        // Generate performance feedback
        const performanceFeedback = this.generatePerformanceFeedback(validationResult, clientMetrics);

        socket.emit('step_validation_feedback_response', {
          success: true,
          stepIndex,
          feedback: performanceFeedback,
          recommendations: this.generateRecommendations(performanceFeedback)
        });

      } catch (error) {
        console.error('STEP_VALIDATION_FEEDBACK error:', error);
      }
    });

    // Handle timing validation
    socket.on('timing_validation_request', async (data) => {
      try {
        const { syncSessionId, stepTimings, clientTimestamp } = data;

        console.log(`⏱️ TIMING_VALIDATION_REQUEST: session=${syncSessionId}`);

        const serverTimestamp = Date.now();
        const networkDelay = serverTimestamp - clientTimestamp;

        // Validate step timings
        const timingValidation = await this.validateStepTimings(stepTimings, networkDelay);

        socket.emit('timing_validation_response', {
          success: true,
          valid: timingValidation.valid,
          networkDelay,
          serverTimestamp,
          timingErrors: timingValidation.errors,
          recommendations: timingValidation.recommendations
        });

      } catch (error) {
        console.error('TIMING_VALIDATION_REQUEST error:', error);
        socket.emit('timing_validation_response', {
          success: false,
          error: 'TIMING_VALIDATION_FAILED',
          errorMessage: error.message
        });
      }
    });

    // Handle session completion validation
    socket.on('sync_session_complete', async (data) => {
      try {
        const startTime = Date.now();
        const { syncSessionId, finalGridState, totalWin, clientHash, sessionMetrics } = data;

        console.log(`🏁 SYNC_SESSION_COMPLETE: session=${syncSessionId}`);

        // Complete synchronization session
        const completion = await this.cascadeSynchronizer.completeSyncSession(syncSessionId, {
          finalGridState,
          totalWin,
          clientHash,
          sessionMetrics,
          clientTimestamp: Date.now()
        });

        // Generate session performance report
        const performanceReport = this.generateSessionReport(syncSessionId, completion, sessionMetrics);

        // Clean up session resources
        await this.cleanupSession(syncSessionId);

        socket.emit('sync_session_complete_response', {
          success: true,
          validated: completion.validated,
          performanceScore: completion.performanceScore,
          totalSteps: completion.totalSteps,
          serverTimestamp: completion.serverTimestamp,
          performanceReport,
          processingTime: Date.now() - startTime
        });

        console.log(`✅ Session ${syncSessionId} completed successfully`);

      } catch (error) {
        console.error('SYNC_SESSION_COMPLETE error:', error);
        socket.emit('sync_session_complete_response', {
          success: false,
          error: 'SYNC_COMPLETE_FAILED',
          errorMessage: error.message || 'Failed to complete cascade synchronization'
        });
      }
    });
  }

  /**
     * Create step manager for handling cascade broadcasting
     */
  createStepManager(socket, syncSession) {
    const manager = {
      socket: socket,
      syncSessionId: syncSession.syncSessionId,
      cascadeSteps: syncSession.cascadeSteps || [],
      currentStepIndex: 0,
      status: 'initialized',
      autoBroadcast: true,
      stepInterval: 1000,
      startTime: Date.now(),
      lastAcknowledgment: Date.now(),
      lastSync: Date.now(),
      lastRecovery: null,
      acknowledgmentCount: 0,
      timeoutCount: 0,
      recoveryCount: 0,
      validationResults: []
    };

    return manager;
  }

  /**
     * Start automatic step broadcasting for a sync session
     */
  async startStepBroadcasting(syncSessionId, cascadeSteps) {
    try {
      console.log(`📡 Starting step broadcasting for session ${syncSessionId}, ${cascadeSteps.length} steps`);

      const stepManager = this.activeManagers.get(syncSessionId);
      if (!stepManager) {
        throw new Error(`Step manager not found for session ${syncSessionId}`);
      }

      stepManager.cascadeSteps = cascadeSteps;
      stepManager.status = 'broadcasting';
      stepManager.startTime = Date.now();

      // Start broadcasting first step
      await this.broadcastNextStep(syncSessionId, 0);

      this.metrics.totalBroadcasts++;

    } catch (error) {
      console.error('Start step broadcasting error:', error);
      throw error;
    }
  }

  /**
     * Broadcast next cascade step to client
     */
  async broadcastNextStep(syncSessionId, stepIndex) {
    try {
      const stepManager = this.activeManagers.get(syncSessionId);
      if (!stepManager) {
        throw new Error(`Step manager not found for session ${syncSessionId}`);
      }

      if (stepIndex >= stepManager.cascadeSteps.length) {
        console.log(`📡 Broadcasting complete for session ${syncSessionId}`);
        stepManager.status = 'completed';
        return;
      }

      const cascadeStep = stepManager.cascadeSteps[stepIndex];
      stepManager.currentStepIndex = stepIndex;
      stepManager.status = 'broadcasting_step';

      console.log(`📡 Broadcasting step ${stepIndex} for session ${syncSessionId}`);

      // Prepare step broadcast data
      const broadcastData = {
        syncSessionId,
        stepIndex,
        cascadeStep: {
          stepNumber: cascadeStep.stepNumber,
          gridBefore: cascadeStep.gridBefore,
          gridAfter: cascadeStep.gridAfter,
          matchedClusters: cascadeStep.matchedClusters,
          dropPattern: cascadeStep.dropPattern,
          animations: cascadeStep.animations,
          stepTiming: cascadeStep.stepTiming,
          validationHash: cascadeStep.validationHash
        },
        serverTimestamp: Date.now(),
        expectedAcknowledgment: true,
        timeout: this.config.acknowledgmentTimeout
      };

      // Queue broadcast data
      this.queueBroadcast(syncSessionId, stepIndex, broadcastData);

      // Emit step broadcast
      stepManager.socket.emit('cascade_step_broadcast', broadcastData);

      // Set timeout for acknowledgment
      this.setAcknowledgmentTimeout(syncSessionId, stepIndex);

    } catch (error) {
      console.error('Broadcast next step error:', error);
      throw error;
    }
  }

  /**
     * Queue broadcast for retry capabilities
     */
  queueBroadcast(syncSessionId, stepIndex, broadcastData) {
    if (!this.broadcastQueue.has(syncSessionId)) {
      this.broadcastQueue.set(syncSessionId, new Map());
    }

    const sessionQueue = this.broadcastQueue.get(syncSessionId);
    sessionQueue.set(stepIndex, {
      data: broadcastData,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  /**
     * Set acknowledgment timeout for step
     */
  setAcknowledgmentTimeout(syncSessionId, stepIndex) {
    setTimeout(async () => {
      const stepManager = this.activeManagers.get(syncSessionId);
      if (stepManager && stepManager.currentStepIndex === stepIndex && stepManager.status === 'broadcasting_step') {
        console.log(`⏰ Acknowledgment timeout for session ${syncSessionId}, step ${stepIndex}`);

        stepManager.timeoutCount++;

        // Try to recover or retry
        if (stepManager.timeoutCount >= this.config.maxRetryAttempts) {
          await this.initiateRecovery(syncSessionId, 'acknowledgment_timeout', {
            stepIndex,
            timeoutCount: stepManager.timeoutCount
          });
        } else {
          await this.retryStepBroadcast(syncSessionId, stepIndex);
        }
      }
    }, this.config.acknowledgmentTimeout);
  }

  /**
     * Retry step broadcast
     */
  async retryStepBroadcast(syncSessionId, stepIndex) {
    try {
      const sessionQueue = this.broadcastQueue.get(syncSessionId);
      if (!sessionQueue || !sessionQueue.has(stepIndex)) {
        throw new Error(`Broadcast data not found for retry: session ${syncSessionId}, step ${stepIndex}`);
      }

      const queuedBroadcast = sessionQueue.get(stepIndex);
      queuedBroadcast.retryCount++;
      queuedBroadcast.data.retryAttempt = queuedBroadcast.retryCount;
      queuedBroadcast.data.serverTimestamp = Date.now();

      const stepManager = this.activeManagers.get(syncSessionId);
      if (stepManager) {
        console.log(`🔄 Retrying step broadcast: session ${syncSessionId}, step ${stepIndex}, attempt ${queuedBroadcast.retryCount}`);
        stepManager.socket.emit('cascade_step_broadcast', queuedBroadcast.data);

        // Set new timeout
        this.setAcknowledgmentTimeout(syncSessionId, stepIndex);
      }

    } catch (error) {
      console.error('Retry step broadcast error:', error);
    }
  }

  /**
     * Pause step broadcasting
     */
  async pauseStepBroadcasting(syncSessionId) {
    const stepManager = this.activeManagers.get(syncSessionId);
    if (stepManager) {
      if (stepManager.status !== 'recovering') {
        stepManager.status = 'paused';
      }
      stepManager.autoBroadcast = false;
      console.log(`⏸️ Step broadcasting paused for session ${syncSessionId}`);
    }
  }

  /**
     * Resume step broadcasting
     */
  async resumeStepBroadcasting(syncSessionId) {
    const stepManager = this.activeManagers.get(syncSessionId);
    if (stepManager) {
      stepManager.status = 'broadcasting';
      stepManager.autoBroadcast = true;
      stepManager.lastSync = Date.now();

      console.log(`▶️ Step broadcasting resumed for session ${syncSessionId}`);

      // Continue from current step
      if (stepManager.currentStepIndex < stepManager.cascadeSteps.length) {
        await this.broadcastNextStep(syncSessionId, stepManager.currentStepIndex);
      }
    }
  }

  /**
     * Skip to specific step
     */
  async skipToStep(syncSessionId, stepIndex) {
    const stepManager = this.activeManagers.get(syncSessionId);
    if (stepManager) {
      stepManager.currentStepIndex = stepIndex;
      console.log(`⏭️ Skipping to step ${stepIndex} for session ${syncSessionId}`);

      if (stepManager.autoBroadcast) {
        await this.broadcastNextStep(syncSessionId, stepIndex);
      }
    }
  }

  /**
     * Restart step broadcasting from beginning or specific step
     */
  async restartStepBroadcasting(syncSessionId, fromStepIndex = 0) {
    const stepManager = this.activeManagers.get(syncSessionId);
    if (stepManager) {
      stepManager.currentStepIndex = fromStepIndex;
      stepManager.status = 'restarting';
      stepManager.timeoutCount = 0;
      stepManager.recoveryCount = 0;
      stepManager.acknowledgmentCount = 0;
      stepManager.startTime = Date.now();

      console.log(`🔄 Restarting step broadcasting for session ${syncSessionId} from step ${fromStepIndex}`);

      // Clear old broadcast queue
      if (this.broadcastQueue.has(syncSessionId)) {
        this.broadcastQueue.get(syncSessionId).clear();
      }

      // Resume broadcasting
      stepManager.autoBroadcast = true;
      stepManager.status = 'broadcasting';
      await this.broadcastNextStep(syncSessionId, fromStepIndex);
    }
  }

  /**
     * Initiate recovery process
     */
  async initiateRecovery(syncSessionId, recoveryReason, context) {
    try {
      console.log(`🔧 Initiating recovery for session ${syncSessionId}: ${recoveryReason}`);

      const stepManager = this.activeManagers.get(syncSessionId);
      if (stepManager) {
        stepManager.status = 'recovery_initiated';
        stepManager.lastRecovery = Date.now();
        stepManager.recoveryCount++;

        // Emit recovery initiation to client
        stepManager.socket.emit('recovery_initiated', {
          syncSessionId,
          recoveryReason,
          context,
          serverTimestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Initiate recovery error:', error);
    }
  }

  /**
     * Generate validation feedback
     */
  async generateValidationFeedback(acknowledgment, stepIndex, processingTime) {
    return {
      validated: acknowledgment.validated,
      stepIndex,
      processingTime,
      hashMatch: acknowledgment.serverHash === acknowledgment.clientHash,
      syncQuality: acknowledgment.validated ? 'excellent' : 'poor',
      recommendations: acknowledgment.validated ? [] : ['Check grid state consistency', 'Verify timing synchronization'],
      timestamp: Date.now()
    };
  }

  /**
     * Generate performance feedback
     */
  generatePerformanceFeedback(validationResult, clientMetrics) {
    return {
      validationScore: validationResult.valid ? 100 : 0,
      performanceScore: this.calculatePerformanceScore(clientMetrics),
      latency: clientMetrics.responseTime || 0,
      stability: clientMetrics.errorCount === 0 ? 'stable' : 'unstable',
      efficiency: clientMetrics.processingTime < 100 ? 'high' : 'medium'
    };
  }

  /**
     * Calculate performance score based on metrics
     */
  calculatePerformanceScore(metrics) {
    let score = 100;

    if (metrics.responseTime > 1000) {score -= 20;}
    if (metrics.errorCount > 0) {score -= 30;}
    if (metrics.retryCount > 2) {score -= 15;}
    if (metrics.memoryUsage > 0.8) {score -= 10;}

    return Math.max(0, score);
  }

  /**
     * Generate recommendations based on performance
     */
  generateRecommendations(performanceFeedback) {
    const recommendations = [];

    if (performanceFeedback.latency > 1000) {
      recommendations.push('Consider optimizing network connection');
    }
    if (performanceFeedback.performanceScore < 70) {
      recommendations.push('Review client-side processing efficiency');
    }
    if (performanceFeedback.stability === 'unstable') {
      recommendations.push('Check for error handling improvements');
    }

    return recommendations;
  }

  /**
     * Validate step timings
     */
  async validateStepTimings(stepTimings, networkDelay) {
    const errors = [];
    const tolerance = this.config.syncToleranceMs;

    for (const timing of stepTimings) {
      const adjustedTime = timing.clientTime + networkDelay;
      const timeDiff = Math.abs(adjustedTime - timing.serverTime);

      if (timeDiff > tolerance) {
        errors.push({
          stepIndex: timing.stepIndex,
          timeDifference: timeDiff,
          tolerance: tolerance,
          severity: timeDiff > tolerance * 2 ? 'high' : 'medium'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      recommendations: errors.length > 0 ? ['Adjust synchronization timing', 'Check network stability'] : []
    };
  }

  /**
     * Send validation alert to client
     */
  sendValidationAlert(socket, alertData) {
    socket.emit('validation_alert', {
      type: alertData.type,
      severity: alertData.severity,
      message: this.getAlertMessage(alertData.type, alertData.severity),
      details: alertData.details,
      timestamp: Date.now(),
      syncSessionId: alertData.syncSessionId
    });
  }

  /**
     * Get alert message based on type and severity
     */
  getAlertMessage(type, severity) {
    const messages = {
      'grid_validation_failed': {
        'high': 'Critical grid validation failure detected',
        'medium': 'Grid validation warning',
        'low': 'Minor grid validation issue'
      },
      'timing_desync': {
        'high': 'Severe timing desynchronization detected',
        'medium': 'Timing synchronization warning',
        'low': 'Minor timing adjustment needed'
      }
    };

    return messages[type] && messages[type][severity] || 'Validation alert';
  }

  /**
     * Generate session performance report
     */
  generateSessionReport(syncSessionId, completion, sessionMetrics) {
    const stepManager = this.activeManagers.get(syncSessionId);

    return {
      sessionId: syncSessionId,
      duration: stepManager ? Date.now() - stepManager.startTime : 0,
      totalSteps: completion.totalSteps,
      acknowledgmentRate: stepManager ? (stepManager.acknowledgmentCount / completion.totalSteps * 100) : 0,
      recoveryCount: stepManager ? stepManager.recoveryCount : 0,
      timeoutCount: stepManager ? stepManager.timeoutCount : 0,
      performanceScore: completion.performanceScore,
      clientMetrics: sessionMetrics,
      recommendations: this.generateSessionRecommendations(stepManager, completion)
    };
  }

  /**
     * Generate session recommendations
     */
  generateSessionRecommendations(stepManager, completion) {
    const recommendations = [];

    if (stepManager && stepManager.timeoutCount > 2) {
      recommendations.push('Consider optimizing acknowledgment handling');
    }
    if (completion.performanceScore < 80) {
      recommendations.push('Review synchronization efficiency');
    }
    if (stepManager && stepManager.recoveryCount > 1) {
      recommendations.push('Investigate frequent desynchronization causes');
    }

    return recommendations;
  }

  /**
     * Setup heartbeat monitoring for socket connection
     */
  setupHeartbeat(socket) {
    const heartbeatInterval = setInterval(() => {
      const socketData = this.activeSockets.get(socket.id);
      if (socketData) {
        const timeSinceLastHeartbeat = Date.now() - socketData.lastHeartbeat;

        if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
          console.log(`💔 Heartbeat timeout for socket ${socket.id}`);
          socket.disconnect();
        } else {
          socket.emit('heartbeat', { timestamp: Date.now() });
        }
      }
    }, this.config.heartbeatInterval);

    socket.on('heartbeat_response', () => {
      const socketData = this.activeSockets.get(socket.id);
      if (socketData) {
        socketData.lastHeartbeat = Date.now();
      }
    });

    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
    });
  }

  /**
     * Handle socket disconnection
     */
  handleDisconnect(socket) {
    console.log(`🔌 Socket ${socket.id} disconnected - cleaning up cascade sync resources`);

    const socketData = this.activeSockets.get(socket.id);
    if (socketData) {
      // Clean up all sync sessions for this socket
      for (const syncSessionId of socketData.syncSessions) {
        this.cleanupSession(syncSessionId);
      }

      this.activeSockets.delete(socket.id);
      this.metrics.connectionsCount--;
    }

    // Unregister from cascade synchronizer
    this.cascadeSynchronizer.unregisterSocket(socket);
  }

  /**
     * Clean up session resources
     */
  async cleanupSession(syncSessionId) {
    try {
      console.log(`🧹 Cleaning up session ${syncSessionId}`);

      // Remove step manager
      this.activeManagers.delete(syncSessionId);

      // Clear broadcast queue
      this.broadcastQueue.delete(syncSessionId);

      // Update metrics
      this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1);

      // Cleanup in cascade synchronizer
      await this.cascadeSynchronizer.cleanupSession(syncSessionId);

    } catch (error) {
      console.error(`Session cleanup error for ${syncSessionId}:`, error);
    }
  }

  /**
     * Get current performance metrics
     */
  getMetrics() {
    return {
      ...this.metrics,
      activeConnections: this.activeSockets.size,
      activeManagers: this.activeManagers.size,
      queuedBroadcasts: Array.from(this.broadcastQueue.values()).reduce((total, queue) => total + queue.size, 0)
    };
  }

  /**
     * Update configuration
     */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 CascadeSync configuration updated:', newConfig);
  }
}

module.exports = CascadeSync;