/**
 * gameEvents.js - Enhanced WebSocket Event Handlers for Cascade Synchronization
 * 
 * Implements comprehensive WebSocket event handling for the Enhanced Cascade Synchronization
 * system. Provides modular event handlers that can be integrated with the main server's
 * Socket.io instance.
 * 
 * Task 5.2 Implementation:
 * - 5.2.1: Add CASCADE_STEP_START event handling
 * - 5.2.2: Implement CASCADE_STEP_COMPLETE validation
 * - 5.2.3: Add CASCADE_DESYNC_DETECTED recovery
 * - 5.2.4: Create SYNC_REQUEST response handling
 */

const CascadeSynchronizer = require('../services/CascadeSynchronizer');
const CascadeValidator = require('../services/CascadeValidator');
const GameSession = require('../models/GameSession');
const SpinResult = require('../models/SpinResult');
const crypto = require('crypto');

class GameEvents {
    constructor(io, gridEngine, cascadeSynchronizer, cascadeValidator) {
        this.io = io;
        this.gridEngine = gridEngine;
        this.cascadeSynchronizer = cascadeSynchronizer || new CascadeSynchronizer();
        this.cascadeValidator = cascadeValidator || new CascadeValidator();
        
        // Track active cascade sessions and their states
        this.activeCascadeSessions = new Map();
        this.pendingValidations = new Map();
        this.recoveryAttempts = new Map();
        
        // Performance metrics
        this.metrics = {
            totalStepsStarted: 0,
            totalStepsCompleted: 0,
            totalDesyncsDetected: 0,
            totalSyncRequests: 0,
            averageStepDuration: 0,
            validationSuccessRate: 0
        };
        
        // Configuration
        this.config = {
            stepTimeout: 5000,           // 5 seconds for step completion
            validationTimeout: 3000,     // 3 seconds for validation
            maxRecoveryAttempts: 3,      // Maximum recovery attempts
            syncToleranceMs: 1000,       // 1 second tolerance for timing
            debugMode: process.env.DEBUG_MODE === 'true'
        };
        
        console.log('🎮 GameEvents WebSocket handler initialized');
    }

    /**
     * Register all WebSocket event handlers for a socket connection
     */
    registerSocketEvents(socket) {
        console.log(`📡 Registering game events for socket ${socket.id}`);
        
        // Task 5.2.1: CASCADE_STEP_START event handling
        this.registerCascadeStepStart(socket);
        
        // Task 5.2.2: CASCADE_STEP_COMPLETE validation
        this.registerCascadeStepComplete(socket);
        
        // Task 5.2.3: CASCADE_DESYNC_DETECTED recovery
        this.registerCascadeDesyncDetected(socket);
        
        // Task 5.2.4: SYNC_REQUEST response handling
        this.registerSyncRequest(socket);
        
        // Additional event handlers
        this.registerDisconnectionHandler(socket);
        this.registerErrorHandler(socket);
        
        console.log(`✅ Game events registered for socket ${socket.id}`);
    }

    /**
     * Task 5.2.1: Add CASCADE_STEP_START event handling
     * Handles the start of a cascade step with validation and acknowledgment
     */
    registerCascadeStepStart(socket) {
        socket.on('CASCADE_STEP_START', async (data) => {
            const startTime = Date.now();
            
            try {
                const { 
                    sessionId, 
                    spinId, 
                    stepIndex, 
                    gridState, 
                    expectedHash,
                    clientTimestamp,
                    phase = 'cascade_step'
                } = data;
                
                console.log(`🎬 CASCADE_STEP_START: Session ${sessionId}, Step ${stepIndex}, Phase ${phase}`);
                
                this.metrics.totalStepsStarted++;
                
                // Validate required fields
                if (!sessionId || !spinId || stepIndex === undefined || !gridState) {
                    socket.emit('CASCADE_STEP_ERROR', {
                        error: 'INVALID_STEP_DATA',
                        message: 'Missing required step data',
                        sessionId,
                        stepIndex
                    });
                    return;
                }
                
                // Track cascade session
                if (!this.activeCascadeSessions.has(sessionId)) {
                    this.activeCascadeSessions.set(sessionId, {
                        spinId,
                        startedAt: Date.now(),
                        currentStep: 0,
                        totalSteps: 0,
                        validationResults: [],
                        lastActivity: Date.now()
                    });
                }
                
                const cascadeSession = this.activeCascadeSessions.get(sessionId);
                cascadeSession.currentStep = stepIndex;
                cascadeSession.lastActivity = Date.now();
                
                // Generate server validation hash
                const serverHash = this.cascadeValidator.generateGridHash(gridState, {
                    stepIndex,
                    spinId,
                    timestamp: Date.now()
                });
                
                // Validate client hash if provided
                let validationResult = {
                    valid: true,
                    hashMatch: true,
                    timingValid: true
                };
                
                if (expectedHash) {
                    validationResult.hashMatch = (serverHash === expectedHash);
                    if (!validationResult.hashMatch) {
                        console.warn(`⚠️ Hash mismatch for step ${stepIndex}: client=${expectedHash}, server=${serverHash}`);
                        validationResult.valid = false;
                    }
                }
                
                // Validate timing
                const timingDelta = Math.abs(Date.now() - clientTimestamp);
                if (timingDelta > this.config.syncToleranceMs) {
                    console.warn(`⚠️ Timing desync for step ${stepIndex}: ${timingDelta}ms delta`);
                    validationResult.timingValid = false;
                    validationResult.valid = false;
                }
                
                // Store validation pending completion
                this.pendingValidations.set(`${sessionId}_${stepIndex}`, {
                    startTime,
                    gridState,
                    serverHash,
                    validationResult,
                    phase
                });
                
                // Send acknowledgment
                socket.emit('CASCADE_STEP_ACK', {
                    sessionId,
                    stepIndex,
                    serverTimestamp: Date.now(),
                    serverHash,
                    validationResult,
                    processingTime: Date.now() - startTime,
                    phase,
                    nextAction: validationResult.valid ? 'continue' : 'validate'
                });
                
                // If validation failed, trigger recovery process
                if (!validationResult.valid) {
                    this.handleValidationFailure(socket, sessionId, stepIndex, validationResult);
                }
                
                // Broadcast to other connected clients (for spectator mode)
                if (this.config.debugMode) {
                    socket.broadcast.emit('CASCADE_STEP_STATUS', {
                        sessionId,
                        stepIndex,
                        phase,
                        status: 'started',
                        validationResult
                    });
                }
                
            } catch (error) {
                console.error('CASCADE_STEP_START error:', error);
                socket.emit('CASCADE_STEP_ERROR', {
                    error: 'STEP_START_FAILED',
                    message: error.message,
                    sessionId: data.sessionId,
                    stepIndex: data.stepIndex
                });
            }
        });
    }

    /**
     * Task 5.2.2: Implement CASCADE_STEP_COMPLETE validation
     * Validates completed cascade steps and updates session state
     */
    registerCascadeStepComplete(socket) {
        socket.on('CASCADE_STEP_COMPLETE', async (data) => {
            const completeTime = Date.now();
            
            try {
                const {
                    sessionId,
                    stepIndex,
                    finalGridState,
                    matchedClusters,
                    dropPattern,
                    winAmount,
                    multiplier,
                    stepDuration,
                    clientHash
                } = data;
                
                console.log(`✅ CASCADE_STEP_COMPLETE: Session ${sessionId}, Step ${stepIndex}, Win $${winAmount}`);
                
                this.metrics.totalStepsCompleted++;
                
                // Retrieve pending validation
                const pendingKey = `${sessionId}_${stepIndex}`;
                const pendingValidation = this.pendingValidations.get(pendingKey);
                
                if (!pendingValidation) {
                    socket.emit('CASCADE_STEP_ERROR', {
                        error: 'NO_PENDING_VALIDATION',
                        message: 'Step was not started properly',
                        sessionId,
                        stepIndex
                    });
                    return;
                }
                
                // Calculate step processing time
                const totalStepTime = completeTime - pendingValidation.startTime;
                
                // Update average step duration metric
                this.metrics.averageStepDuration = 
                    (this.metrics.averageStepDuration * (this.metrics.totalStepsCompleted - 1) + totalStepTime) / 
                    this.metrics.totalStepsCompleted;
                
                // Validate final grid state
                const finalValidation = await this.validateStepCompletion({
                    sessionId,
                    stepIndex,
                    initialGridState: pendingValidation.gridState,
                    finalGridState,
                    matchedClusters,
                    dropPattern,
                    winAmount,
                    multiplier,
                    stepDuration,
                    clientHash
                });
                
                // Update cascade session
                const cascadeSession = this.activeCascadeSessions.get(sessionId);
                if (cascadeSession) {
                    cascadeSession.validationResults.push({
                        stepIndex,
                        valid: finalValidation.valid,
                        processingTime: totalStepTime,
                        winAmount,
                        multiplier
                    });
                    
                    // Update validation success rate
                    const validCount = cascadeSession.validationResults.filter(r => r.valid).length;
                    this.metrics.validationSuccessRate = validCount / cascadeSession.validationResults.length;
                }
                
                // Clean up pending validation
                this.pendingValidations.delete(pendingKey);
                
                // Send completion acknowledgment
                socket.emit('CASCADE_STEP_VALIDATED', {
                    sessionId,
                    stepIndex,
                    validationResult: finalValidation,
                    serverTimestamp: Date.now(),
                    processingTime: totalStepTime,
                    metrics: {
                        averageStepDuration: this.metrics.averageStepDuration,
                        validationSuccessRate: this.metrics.validationSuccessRate
                    }
                });
                
                // Check if cascade is complete
                if (finalValidation.cascadeComplete) {
                    this.handleCascadeCompletion(socket, sessionId, cascadeSession);
                }
                
            } catch (error) {
                console.error('CASCADE_STEP_COMPLETE error:', error);
                socket.emit('CASCADE_STEP_ERROR', {
                    error: 'STEP_COMPLETE_FAILED',
                    message: error.message,
                    sessionId: data.sessionId,
                    stepIndex: data.stepIndex
                });
            }
        });
    }

    /**
     * Task 5.2.3: Add CASCADE_DESYNC_DETECTED recovery
     * Handles desynchronization detection and initiates recovery
     */
    registerCascadeDesyncDetected(socket) {
        socket.on('CASCADE_DESYNC_DETECTED', async (data) => {
            try {
                const {
                    sessionId,
                    stepIndex,
                    desyncType,
                    clientState,
                    expectedState,
                    errorDetails,
                    recoveryAttempt = 0
                } = data;
                
                console.log(`⚠️ CASCADE_DESYNC_DETECTED: Session ${sessionId}, Step ${stepIndex}, Type ${desyncType}`);
                
                this.metrics.totalDesyncsDetected++;
                
                // Track recovery attempts
                const recoveryKey = `${sessionId}_${stepIndex}`;
                const currentAttempts = this.recoveryAttempts.get(recoveryKey) || 0;
                
                if (currentAttempts >= this.config.maxRecoveryAttempts) {
                    console.error(`❌ Max recovery attempts reached for session ${sessionId}`);
                    socket.emit('CASCADE_RECOVERY_FAILED', {
                        sessionId,
                        stepIndex,
                        reason: 'MAX_ATTEMPTS_EXCEEDED',
                        message: 'Maximum recovery attempts exceeded',
                        fallbackAction: 'client_takeover'
                    });
                    return;
                }
                
                this.recoveryAttempts.set(recoveryKey, currentAttempts + 1);
                
                // Determine recovery strategy based on desync type
                const recoveryStrategy = this.determineRecoveryStrategy(desyncType, recoveryAttempt);
                
                // Generate recovery data
                const recoveryData = await this.generateRecoveryData({
                    sessionId,
                    stepIndex,
                    desyncType,
                    clientState,
                    expectedState,
                    recoveryStrategy
                });
                
                // Send recovery instructions
                socket.emit('CASCADE_RECOVERY_DATA', {
                    sessionId,
                    stepIndex,
                    recoveryId: crypto.randomBytes(8).toString('hex'),
                    strategy: recoveryStrategy,
                    recoveryData,
                    attemptNumber: currentAttempts + 1,
                    maxAttempts: this.config.maxRecoveryAttempts,
                    serverTimestamp: Date.now()
                });
                
                // Log recovery attempt
                if (this.config.debugMode) {
                    console.log(`🔧 Recovery strategy ${recoveryStrategy} sent for session ${sessionId}`);
                }
                
            } catch (error) {
                console.error('CASCADE_DESYNC_DETECTED error:', error);
                socket.emit('CASCADE_RECOVERY_ERROR', {
                    error: 'RECOVERY_GENERATION_FAILED',
                    message: error.message,
                    sessionId: data.sessionId,
                    stepIndex: data.stepIndex
                });
            }
        });
    }

    /**
     * Task 5.2.4: Create SYNC_REQUEST response handling
     * Handles synchronization requests from clients
     */
    registerSyncRequest(socket) {
        socket.on('SYNC_REQUEST', async (data) => {
            try {
                const {
                    sessionId,
                    spinId,
                    requestType = 'full_sync',
                    currentStep,
                    clientGridState,
                    lastValidatedStep
                } = data;
                
                console.log(`🔄 SYNC_REQUEST: Session ${sessionId}, Type ${requestType}, Step ${currentStep}`);
                
                this.metrics.totalSyncRequests++;
                
                // Validate session exists
                const cascadeSession = this.activeCascadeSessions.get(sessionId);
                if (!cascadeSession && requestType !== 'init_sync') {
                    socket.emit('SYNC_RESPONSE', {
                        sessionId,
                        requestType,
                        success: false,
                        error: 'SESSION_NOT_FOUND',
                        message: 'No active cascade session found'
                    });
                    return;
                }
                
                // Handle different sync request types
                let syncResponse;
                
                switch (requestType) {
                    case 'init_sync':
                        syncResponse = await this.handleInitSync(socket, {
                            sessionId,
                            spinId,
                            clientGridState
                        });
                        break;
                        
                    case 'step_sync':
                        syncResponse = await this.handleStepSync(socket, {
                            sessionId,
                            currentStep,
                            clientGridState,
                            cascadeSession
                        });
                        break;
                        
                    case 'full_sync':
                        syncResponse = await this.handleFullSync(socket, {
                            sessionId,
                            spinId,
                            currentStep,
                            lastValidatedStep,
                            cascadeSession
                        });
                        break;
                        
                    case 'state_sync':
                        syncResponse = await this.handleStateSync(socket, {
                            sessionId,
                            currentStep,
                            clientGridState,
                            cascadeSession
                        });
                        break;
                        
                    default:
                        syncResponse = {
                            success: false,
                            error: 'UNKNOWN_REQUEST_TYPE',
                            message: `Unknown sync request type: ${requestType}`
                        };
                }
                
                // Send sync response
                socket.emit('SYNC_RESPONSE', {
                    sessionId,
                    requestType,
                    serverTimestamp: Date.now(),
                    ...syncResponse
                });
                
            } catch (error) {
                console.error('SYNC_REQUEST error:', error);
                socket.emit('SYNC_RESPONSE', {
                    sessionId: data.sessionId,
                    requestType: data.requestType,
                    success: false,
                    error: 'SYNC_REQUEST_FAILED',
                    message: error.message
                });
            }
        });
    }

    /**
     * Helper: Validate step completion
     */
    async validateStepCompletion(stepData) {
        const {
            sessionId,
            stepIndex,
            initialGridState,
            finalGridState,
            matchedClusters,
            dropPattern,
            winAmount,
            multiplier,
            stepDuration,
            clientHash
        } = stepData;
        
        // Validate grid transition
        const gridValidation = this.cascadeValidator.validateGridState(finalGridState);
        
        // Validate matches
        const matchValidation = matchedClusters ? 
            this.cascadeValidator.validateMatches(matchedClusters, finalGridState) :
            { valid: true };
        
        // Validate win calculation
        const winValidation = {
            valid: true,
            winAccurate: true
        };
        
        if (winAmount !== undefined && winAmount > 0) {
            // Simplified win validation - in production, this would verify against payout tables
            winValidation.winAccurate = winAmount >= 0 && winAmount <= 10000;
        }
        
        // Generate final hash
        const serverHash = this.cascadeValidator.generateGridHash(finalGridState, {
            stepIndex,
            sessionId,
            timestamp: Date.now()
        });
        
        // Check if cascade is complete (no more matches)
        const cascadeComplete = !matchedClusters || matchedClusters.length === 0;
        
        return {
            valid: gridValidation.valid && matchValidation.valid && winValidation.valid,
            gridValid: gridValidation.valid,
            matchesValid: matchValidation.valid,
            winValid: winValidation.valid,
            serverHash,
            clientHashMatch: clientHash === serverHash,
            cascadeComplete,
            details: {
                gridValidation,
                matchValidation,
                winValidation
            }
        };
    }

    /**
     * Helper: Handle validation failure
     */
    handleValidationFailure(socket, sessionId, stepIndex, validationResult) {
        console.warn(`⚠️ Validation failure for session ${sessionId}, step ${stepIndex}`);
        
        // Emit validation failure event
        socket.emit('CASCADE_VALIDATION_FAILED', {
            sessionId,
            stepIndex,
            validationResult,
            serverTimestamp: Date.now(),
            recoveryHint: this.determineRecoveryHint(validationResult)
        });
    }

    /**
     * Helper: Handle cascade completion
     */
    handleCascadeCompletion(socket, sessionId, cascadeSession) {
        console.log(`🎉 Cascade complete for session ${sessionId}`);
        
        // Calculate final metrics
        const totalValidSteps = cascadeSession.validationResults.filter(r => r.valid).length;
        const totalWin = cascadeSession.validationResults.reduce((sum, r) => sum + (r.winAmount || 0), 0);
        const finalMultiplier = cascadeSession.validationResults[cascadeSession.validationResults.length - 1]?.multiplier || 1;
        
        // Send completion event
        socket.emit('CASCADE_COMPLETE', {
            sessionId,
            totalSteps: cascadeSession.validationResults.length,
            validSteps: totalValidSteps,
            totalWin,
            finalMultiplier,
            duration: Date.now() - cascadeSession.startedAt,
            validationSuccessRate: totalValidSteps / cascadeSession.validationResults.length,
            serverTimestamp: Date.now()
        });
        
        // Clean up session
        this.activeCascadeSessions.delete(sessionId);
    }

    /**
     * Helper: Determine recovery strategy based on desync type
     */
    determineRecoveryStrategy(desyncType, attemptNumber) {
        const strategies = {
            'hash_mismatch': ['state_resync', 'step_replay', 'full_resync'],
            'timing_desync': ['timing_adjustment', 'step_replay', 'full_resync'],
            'grid_inconsistency': ['grid_correction', 'cascade_replay', 'full_resync'],
            'validation_failure': ['step_replay', 'cascade_replay', 'full_resync']
        };
        
        const availableStrategies = strategies[desyncType] || strategies['validation_failure'];
        const strategyIndex = Math.min(attemptNumber, availableStrategies.length - 1);
        
        return availableStrategies[strategyIndex];
    }

    /**
     * Helper: Generate recovery data based on strategy
     */
    async generateRecoveryData(options) {
        const { sessionId, stepIndex, desyncType, clientState, expectedState, recoveryStrategy } = options;
        
        const recoveryData = {
            strategy: recoveryStrategy,
            timestamp: Date.now()
        };
        
        switch (recoveryStrategy) {
            case 'state_resync':
                recoveryData.correctState = expectedState;
                recoveryData.stateHash = this.cascadeValidator.generateGridHash(expectedState, {
                    stepIndex,
                    sessionId,
                    timestamp: Date.now()
                });
                break;
                
            case 'step_replay':
                // In production, fetch step data from database
                recoveryData.replayFromStep = Math.max(0, stepIndex - 1);
                recoveryData.stepData = {
                    gridState: expectedState,
                    stepIndex: recoveryData.replayFromStep
                };
                break;
                
            case 'full_resync':
                // Full cascade replay from beginning
                recoveryData.fullReplay = true;
                recoveryData.initialState = expectedState;
                recoveryData.cascadeSteps = []; // Would be populated from database
                break;
                
            case 'timing_adjustment':
                recoveryData.timingOffset = 0; // Calculate actual offset
                recoveryData.newTolerance = this.config.syncToleranceMs * 2;
                break;
                
            case 'grid_correction':
                recoveryData.corrections = this.calculateGridCorrections(clientState, expectedState);
                break;
                
            case 'cascade_replay':
                recoveryData.replayFromCascade = 0;
                recoveryData.cascadeData = {}; // Would be populated from database
                break;
        }
        
        return recoveryData;
    }

    /**
     * Helper: Calculate grid corrections
     */
    calculateGridCorrections(clientGrid, serverGrid) {
        const corrections = [];
        
        // Simple grid comparison - in production, this would be more sophisticated
        if (!clientGrid || !serverGrid) return corrections;
        
        for (let col = 0; col < 6; col++) {
            for (let row = 0; row < 5; row++) {
                if (clientGrid[col]?.[row] !== serverGrid[col]?.[row]) {
                    corrections.push({
                        position: { col, row },
                        currentValue: clientGrid[col]?.[row],
                        correctValue: serverGrid[col]?.[row]
                    });
                }
            }
        }
        
        return corrections;
    }

    /**
     * Helper: Determine recovery hint based on validation result
     */
    determineRecoveryHint(validationResult) {
        if (!validationResult.hashMatch) {
            return 'Grid state mismatch - requesting state resync';
        }
        if (!validationResult.timingValid) {
            return 'Timing desynchronization - adjusting tolerance';
        }
        return 'Validation failure - requesting step replay';
    }

    /**
     * Sync request handlers
     */
    async handleInitSync(socket, data) {
        const { sessionId, spinId, clientGridState } = data;
        
        // Create new cascade session
        this.activeCascadeSessions.set(sessionId, {
            spinId,
            startedAt: Date.now(),
            currentStep: 0,
            totalSteps: 0,
            validationResults: [],
            lastActivity: Date.now()
        });
        
        // Generate initial validation data
        const validationSalt = crypto.randomBytes(16).toString('hex');
        const syncSeed = crypto.randomBytes(8).toString('hex');
        
        return {
            success: true,
            syncData: {
                validationSalt,
                syncSeed,
                serverTimestamp: Date.now(),
                initialGridHash: this.cascadeValidator.generateGridHash(clientGridState, {
                    sessionId,
                    spinId,
                    timestamp: Date.now()
                })
            }
        };
    }

    async handleStepSync(socket, data) {
        const { sessionId, currentStep, clientGridState, cascadeSession } = data;
        
        // Validate current step
        const expectedStep = cascadeSession.currentStep + 1;
        if (currentStep !== expectedStep) {
            return {
                success: false,
                error: 'STEP_MISMATCH',
                expectedStep,
                currentStep
            };
        }
        
        // Generate step validation data
        const stepHash = this.cascadeValidator.generateGridHash(clientGridState, {
            sessionId,
            stepIndex: currentStep,
            timestamp: Date.now()
        });
        
        return {
            success: true,
            stepData: {
                stepIndex: currentStep,
                serverHash: stepHash,
                validated: true
            }
        };
    }

    async handleFullSync(socket, data) {
        const { sessionId, spinId, currentStep, lastValidatedStep, cascadeSession } = data;
        
        // In production, fetch complete cascade data from database
        const cascadeData = {
            sessionId,
            spinId,
            totalSteps: cascadeSession?.totalSteps || 0,
            currentStep: cascadeSession?.currentStep || 0,
            validationResults: cascadeSession?.validationResults || []
        };
        
        return {
            success: true,
            fullSyncData: cascadeData,
            resumeFromStep: lastValidatedStep || 0
        };
    }

    async handleStateSync(socket, data) {
        const { sessionId, currentStep, clientGridState, cascadeSession } = data;
        
        // Generate expected state (in production, from database)
        const expectedState = clientGridState; // Placeholder
        
        const stateHash = this.cascadeValidator.generateGridHash(expectedState, {
            sessionId,
            stepIndex: currentStep,
            timestamp: Date.now()
        });
        
        return {
            success: true,
            stateData: {
                expectedState,
                stateHash,
                currentStep
            }
        };
    }

    /**
     * Additional event handlers
     */
    registerDisconnectionHandler(socket) {
        socket.on('disconnect', () => {
            console.log(`👋 Socket ${socket.id} disconnected`);
            
            // Clean up any active sessions for this socket
            this.cleanupSocketSessions(socket.id);
        });
    }

    registerErrorHandler(socket) {
        socket.on('error', (error) => {
            console.error(`❌ Socket ${socket.id} error:`, error);
        });
    }

    /**
     * Helper: Clean up sessions for disconnected socket
     */
    cleanupSocketSessions(socketId) {
        // In production, this would properly handle session cleanup
        // For now, just log the cleanup
        console.log(`🧹 Cleaning up sessions for socket ${socketId}`);
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeSessions: this.activeCascadeSessions.size,
            pendingValidations: this.pendingValidations.size,
            activeRecoveries: this.recoveryAttempts.size
        };
    }

    /**
     * Reset metrics (for testing)
     */
    resetMetrics() {
        this.metrics = {
            totalStepsStarted: 0,
            totalStepsCompleted: 0,
            totalDesyncsDetected: 0,
            totalSyncRequests: 0,
            averageStepDuration: 0,
            validationSuccessRate: 0
        };
    }
}

module.exports = GameEvents;