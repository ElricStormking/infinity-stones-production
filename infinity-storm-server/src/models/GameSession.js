/**
 * GameSession.js - Server-side Game Session Model
 * 
 * Manages game session state with cascade synchronization capabilities.
 * Tracks cascade state, pending validations, synchronization status,
 * and provides session recovery mechanisms for the Enhanced Cascade Synchronization system.
 * 
 * This is the server-side Node.js module version.
 */

const crypto = require('crypto');
const SpinResult = require('./SpinResult');
const CascadeStep = require('./CascadeStep');

class GameSession {
    constructor(data = {}) {
        // Basic session data
        this.sessionId = data.sessionId || this.generateSessionId();
        this.playerId = data.playerId || null;
        this.createdAt = data.createdAt || Date.now();
        this.lastActivity = data.lastActivity || Date.now();
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        
        // Task 1.3.1: Add cascade state tracking fields
        this.cascadeState = {
            currentSpinId: data.cascadeState?.currentSpinId || null,
            activeSpinResult: data.cascadeState?.activeSpinResult || null,
            currentCascadeStep: data.cascadeState?.currentCascadeStep || 0,
            totalCascadeSteps: data.cascadeState?.totalCascadeSteps || 0,
            cascadeInProgress: data.cascadeState?.cascadeInProgress || false,
            lastCompletedStep: data.cascadeState?.lastCompletedStep || -1,
            gridStateHistory: data.cascadeState?.gridStateHistory || [],
            cascadeStartTime: data.cascadeState?.cascadeStartTime || null,
            cascadeTimeout: data.cascadeState?.cascadeTimeout || null,
            expectedNextStep: data.cascadeState?.expectedNextStep || 0
        };
        
        // Task 1.3.2: Include pending step validation queue
        this.pendingValidations = {
            stepValidationQueue: data.pendingValidations?.stepValidationQueue || [],
            // Each item structure: {
            //   stepNumber: number,
            //   clientStepData: object,
            //   serverStepData: object,
            //   submittedAt: timestamp,
            //   validationStatus: 'pending' | 'validating' | 'validated' | 'failed',
            //   validationErrors: string[],
            //   retryCount: number
            // }
            gridValidationQueue: data.pendingValidations?.gridValidationQueue || [],
            // Each item structure: {
            //   gridHash: string,
            //   gridState: array,
            //   stepNumber: number,
            //   submittedAt: timestamp,
            //   validationStatus: 'pending' | 'validated' | 'failed'
            // }
            spinValidationQueue: data.pendingValidations?.spinValidationQueue || [],
            // Complete spin validation items
            maxQueueSize: data.pendingValidations?.maxQueueSize || 50,
            validationTimeout: data.pendingValidations?.validationTimeout || 30000, // 30 seconds
            lastValidationTime: data.pendingValidations?.lastValidationTime || null
        };
        
        // Task 1.3.3: Add synchronization status flags
        this.synchronizationStatus = {
            clientServerSync: data.synchronizationStatus?.clientServerSync || 'synchronized', // 'synchronized' | 'desynchronized' | 'recovering'
            lastSyncCheckTime: data.synchronizationStatus?.lastSyncCheckTime || Date.now(),
            syncFailureCount: data.synchronizationStatus?.syncFailureCount || 0,
            maxSyncFailures: data.synchronizationStatus?.maxSyncFailures || 5,
            desyncDetectedAt: data.synchronizationStatus?.desyncDetectedAt || null,
            recoveryAttempts: data.synchronizationStatus?.recoveryAttempts || 0,
            maxRecoveryAttempts: data.synchronizationStatus?.maxRecoveryAttempts || 3,
            lastSuccessfulSync: data.synchronizationStatus?.lastSuccessfulSync || Date.now(),
            syncTolerance: data.synchronizationStatus?.syncTolerance || 1000, // 1 second tolerance
            requiredAcknowledgments: data.synchronizationStatus?.requiredAcknowledgments || [],
            receivedAcknowledgments: data.synchronizationStatus?.receivedAcknowledgments || []
        };
        
        // Session recovery mechanisms (Task 1.3.4 included above in other sections)
        this.recoveryState = {
            recoveryInProgress: data.recoveryState?.recoveryInProgress || false,
            recoveryStartedAt: data.recoveryState?.recoveryStartedAt || null,
            recoveryMethod: data.recoveryState?.recoveryMethod || null, // 'full_resync' | 'partial_replay' | 'checkpoint_restore'
            recoveryCheckpoint: data.recoveryState?.recoveryCheckpoint || null,
            savedGridStates: data.recoveryState?.savedGridStates || {},
            savedSpinResults: data.recoveryState?.savedSpinResults || {},
            emergencyFallback: data.recoveryState?.emergencyFallback || null,
            recoveryLog: data.recoveryState?.recoveryLog || []
        };
        
        // Game state data
        this.gameState = {
            balance: data.gameState?.balance || 0,
            currentBet: data.gameState?.currentBet || 1.00,
            freeSpinsActive: data.gameState?.freeSpinsActive || false,
            freeSpinsRemaining: data.gameState?.freeSpinsRemaining || 0,
            totalSpins: data.gameState?.totalSpins || 0,
            totalWins: data.gameState?.totalWins || 0,
            sessionWinLoss: data.gameState?.sessionWinLoss || 0,
            lastSpinResult: data.gameState?.lastSpinResult || null
        };
        
        // Connection and networking data
        this.connection = {
            socketId: data.connection?.socketId || null,
            ipAddress: data.connection?.ipAddress || null,
            userAgent: data.connection?.userAgent || null,
            lastPing: data.connection?.lastPing || Date.now(),
            connectionQuality: data.connection?.connectionQuality || 'good', // 'excellent' | 'good' | 'poor' | 'unstable'
            latency: data.connection?.latency || 0,
            disconnections: data.connection?.disconnections || 0
        };
        
        // Security and validation
        this.security = {
            sessionHash: data.security?.sessionHash || null,
            validationSalt: data.security?.validationSalt || this.generateSalt(),
            securityLevel: data.security?.securityLevel || 'standard', // 'standard' | 'enhanced' | 'strict'
            suspiciousActivity: data.security?.suspiciousActivity || [],
            fraudScore: data.security?.fraudScore || 0,
            lastSecurityCheck: data.security?.lastSecurityCheck || Date.now()
        };
        
        // Metadata
        this.metadata = {
            serverVersion: '1.0.0',
            sessionType: data.metadata?.sessionType || 'normal', // 'normal' | 'test' | 'recovery'
            clientVersion: data.metadata?.clientVersion || null,
            features: data.metadata?.features || [],
            debugMode: data.metadata?.debugMode || false,
            performanceMetrics: data.metadata?.performanceMetrics || {}
        };
    }
    
    // Minimal async initializer for compatibility with WebSocket handlers/tests
    async initialize() {
        return true;
    }
    
    /**
     * Generates a unique session ID
     * @returns {string} Unique session identifier
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(12).toString('hex');
        return `session_${timestamp}_${random}`;
    }
    
    /**
     * Generates a salt for hash validation
     * @returns {string} Random salt string
     */
    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    /**
     * Updates last activity timestamp
     */
    updateActivity() {
        this.lastActivity = Date.now();
        this.connection.lastPing = Date.now();
    }
    
    /**
     * Starts a new cascade sequence
     * @param {SpinResult} spinResult - The spin result containing cascade steps
     */
    startCascadeSequence(spinResult) {
        this.cascadeState.currentSpinId = spinResult.spinId;
        this.cascadeState.activeSpinResult = spinResult;
        this.cascadeState.currentCascadeStep = 0;
        this.cascadeState.totalCascadeSteps = spinResult.cascadeSteps.length;
        this.cascadeState.cascadeInProgress = true;
        this.cascadeState.lastCompletedStep = -1;
        this.cascadeState.cascadeStartTime = Date.now();
        this.cascadeState.expectedNextStep = 0;
        
        // Clear grid state history and start fresh
        this.cascadeState.gridStateHistory = [{
            stepNumber: -1,
            gridState: spinResult.initialGrid,
            timestamp: Date.now(),
            hash: this.generateGridHash(spinResult.initialGrid)
        }];
        
        // Set cascade timeout
        const estimatedDuration = spinResult.cascadeSteps.reduce((total, step) => {
            return total + (step.timing?.duration || 1000);
        }, 0);
        this.cascadeState.cascadeTimeout = Date.now() + estimatedDuration + 10000; // Extra 10 seconds buffer
        
        this.updateActivity();
    }
    
    /**
     * Advances to the next cascade step
     * @param {number} stepNumber - The step number to advance to
     * @returns {boolean} True if advancement was successful
     */
    advanceCascadeStep(stepNumber) {
        if (!this.cascadeState.cascadeInProgress) {
            return false;
        }
        
        if (stepNumber !== this.cascadeState.expectedNextStep) {
            return false;
        }
        
        this.cascadeState.currentCascadeStep = stepNumber;
        this.cascadeState.lastCompletedStep = stepNumber - 1;
        this.cascadeState.expectedNextStep = stepNumber + 1;
        
        this.updateActivity();
        return true;
    }
    
    /**
     * Completes the current cascade sequence
     */
    completeCascadeSequence() {
        this.cascadeState.cascadeInProgress = false;
        this.cascadeState.lastCompletedStep = this.cascadeState.totalCascadeSteps - 1;
        this.cascadeState.currentCascadeStep = this.cascadeState.totalCascadeSteps;
        this.cascadeState.cascadeTimeout = null;
        
        // Update game state with final results
        if (this.cascadeState.activeSpinResult) {
            this.gameState.lastSpinResult = this.cascadeState.activeSpinResult;
            this.gameState.totalSpins++;
            this.gameState.sessionWinLoss += this.cascadeState.activeSpinResult.getNetResult();
            
            if (this.cascadeState.activeSpinResult.hasWins()) {
                this.gameState.totalWins++;
            }
        }
        
        this.updateActivity();
    }
    
    /**
     * Adds a step validation request to the queue
     * @param {number} stepNumber - Step number to validate
     * @param {Object} clientStepData - Client's step data
     * @param {Object} serverStepData - Server's step data
     */
    addStepValidation(stepNumber, clientStepData, serverStepData) {
        // Check queue size limit
        if (this.pendingValidations.stepValidationQueue.length >= this.pendingValidations.maxQueueSize) {
            // Remove oldest validation
            this.pendingValidations.stepValidationQueue.shift();
        }
        
        const validation = {
            stepNumber: stepNumber,
            clientStepData: clientStepData,
            serverStepData: serverStepData,
            submittedAt: Date.now(),
            validationStatus: 'pending',
            validationErrors: [],
            retryCount: 0
        };
        
        this.pendingValidations.stepValidationQueue.push(validation);
        this.pendingValidations.lastValidationTime = Date.now();
    }
    
    /**
     * Adds a grid validation request to the queue
     * @param {Array} gridState - Grid state to validate
     * @param {number} stepNumber - Associated step number
     */
    addGridValidation(gridState, stepNumber) {
        const gridHash = this.generateGridHash(gridState);
        
        const validation = {
            gridHash: gridHash,
            gridState: gridState,
            stepNumber: stepNumber,
            submittedAt: Date.now(),
            validationStatus: 'pending'
        };
        
        this.pendingValidations.gridValidationQueue.push(validation);
    }
    
    /**
     * Processes pending validations
     * @returns {Object} Validation results
     */
    processPendingValidations() {
        const results = {
            processedSteps: 0,
            validatedSteps: 0,
            failedSteps: 0,
            processedGrids: 0,
            validatedGrids: 0,
            errors: []
        };
        
        // Process step validations
        for (const validation of this.pendingValidations.stepValidationQueue) {
            if (validation.validationStatus === 'pending') {
                validation.validationStatus = 'validating';
                
                const isValid = this.validateStepData(validation.clientStepData, validation.serverStepData);
                
                if (isValid) {
                    validation.validationStatus = 'validated';
                    results.validatedSteps++;
                } else {
                    validation.validationStatus = 'failed';
                    validation.validationErrors.push('Step data mismatch');
                    results.failedSteps++;
                    results.errors.push(`Step ${validation.stepNumber} validation failed`);
                }
                
                results.processedSteps++;
            }
        }
        
        // Process grid validations
        for (const validation of this.pendingValidations.gridValidationQueue) {
            if (validation.validationStatus === 'pending') {
                const currentHash = this.generateGridHash(validation.gridState);
                
                if (currentHash === validation.gridHash) {
                    validation.validationStatus = 'validated';
                    results.validatedGrids++;
                } else {
                    validation.validationStatus = 'failed';
                    results.errors.push(`Grid validation failed for step ${validation.stepNumber}`);
                }
                
                results.processedGrids++;
            }
        }
        
        // Clean up old validations
        this.cleanupValidationQueues();
        
        return results;
    }
    
    /**
     * Validates step data between client and server
     * @param {Object} clientData - Client step data
     * @param {Object} serverData - Server step data
     * @returns {boolean} True if data matches
     */
    validateStepData(clientData, serverData) {
        // Basic validation - can be enhanced with more sophisticated checks
        if (!clientData || !serverData) {
            return false;
        }
        
        // Compare critical fields
        if (clientData.stepNumber !== serverData.stepNumber) {
            return false;
        }
        
        if (JSON.stringify(clientData.gridStateAfter) !== JSON.stringify(serverData.gridStateAfter)) {
            return false;
        }
        
        // Compare matched clusters
        if (clientData.matchedClusters?.length !== serverData.matchedClusters?.length) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Cleans up old validation entries
     */
    cleanupValidationQueues() {
        const now = Date.now();
        const timeout = this.pendingValidations.validationTimeout;
        
        // Remove expired step validations
        this.pendingValidations.stepValidationQueue = 
            this.pendingValidations.stepValidationQueue.filter(validation => 
                now - validation.submittedAt < timeout
            );
        
        // Remove expired grid validations
        this.pendingValidations.gridValidationQueue = 
            this.pendingValidations.gridValidationQueue.filter(validation => 
                now - validation.submittedAt < timeout
            );
    }
    
    /**
     * Detects desynchronization between client and server
     * @returns {boolean} True if desync is detected
     */
    detectDesynchronization() {
        // Check if cascade is taking too long
        if (this.cascadeState.cascadeInProgress && this.cascadeState.cascadeTimeout) {
            if (Date.now() > this.cascadeState.cascadeTimeout) {
                this.markDesynchronized('cascade_timeout');
                return true;
            }
        }
        
        // Check for failed validations
        const failedValidations = this.pendingValidations.stepValidationQueue.filter(
            v => v.validationStatus === 'failed'
        );
        
        if (failedValidations.length > 3) {
            this.markDesynchronized('validation_failures');
            return true;
        }
        
        // Check sync failure count
        if (this.synchronizationStatus.syncFailureCount >= this.synchronizationStatus.maxSyncFailures) {
            this.markDesynchronized('max_failures_reached');
            return true;
        }
        
        return false;
    }
    
    /**
     * Marks the session as desynchronized
     * @param {string} reason - Reason for desynchronization
     */
    markDesynchronized(reason) {
        this.synchronizationStatus.clientServerSync = 'desynchronized';
        this.synchronizationStatus.desyncDetectedAt = Date.now();
        this.synchronizationStatus.syncFailureCount++;
        
        // Log the desync event
        this.recoveryState.recoveryLog.push({
            timestamp: Date.now(),
            event: 'desync_detected',
            reason: reason,
            cascadeState: { ...this.cascadeState }
        });
    }
    
    /**
     * Initiates session recovery
     * @param {string} method - Recovery method to use
     * @returns {boolean} True if recovery was initiated
     */
    initiateRecovery(method = 'partial_replay') {
        if (this.recoveryState.recoveryInProgress) {
            return false; // Recovery already in progress
        }
        
        if (this.synchronizationStatus.recoveryAttempts >= this.synchronizationStatus.maxRecoveryAttempts) {
            return false; // Max recovery attempts reached
        }
        
        this.recoveryState.recoveryInProgress = true;
        this.recoveryState.recoveryStartedAt = Date.now();
        this.recoveryState.recoveryMethod = method;
        this.synchronizationStatus.clientServerSync = 'recovering';
        this.synchronizationStatus.recoveryAttempts++;
        
        // Create recovery checkpoint
        this.createRecoveryCheckpoint();
        
        // Log recovery initiation
        this.recoveryState.recoveryLog.push({
            timestamp: Date.now(),
            event: 'recovery_initiated',
            method: method,
            attempt: this.synchronizationStatus.recoveryAttempts
        });
        
        return true;
    }
    
    /**
     * Creates a recovery checkpoint
     */
    createRecoveryCheckpoint() {
        this.recoveryState.recoveryCheckpoint = {
            timestamp: Date.now(),
            cascadeState: { ...this.cascadeState },
            gameState: { ...this.gameState },
            pendingValidations: {
                stepCount: this.pendingValidations.stepValidationQueue.length,
                gridCount: this.pendingValidations.gridValidationQueue.length
            }
        };
    }
    
    /**
     * Completes session recovery
     * @param {boolean} success - Whether recovery was successful
     */
    completeRecovery(success) {
        this.recoveryState.recoveryInProgress = false;
        
        if (success) {
            this.synchronizationStatus.clientServerSync = 'synchronized';
            this.synchronizationStatus.lastSuccessfulSync = Date.now();
            this.synchronizationStatus.syncFailureCount = 0;
            
            // Log successful recovery
            this.recoveryState.recoveryLog.push({
                timestamp: Date.now(),
                event: 'recovery_completed',
                success: true,
                duration: Date.now() - this.recoveryState.recoveryStartedAt
            });
        } else {
            // Log failed recovery
            this.recoveryState.recoveryLog.push({
                timestamp: Date.now(),
                event: 'recovery_failed',
                success: false,
                attempt: this.synchronizationStatus.recoveryAttempts
            });
        }
        
        this.recoveryState.recoveryStartedAt = null;
        this.recoveryState.recoveryMethod = null;
    }
    
    /**
     * Saves grid state for recovery purposes
     * @param {number} stepNumber - Step number
     * @param {Array} gridState - Grid state to save
     */
    saveGridState(stepNumber, gridState) {
        this.recoveryState.savedGridStates[stepNumber] = {
            gridState: JSON.parse(JSON.stringify(gridState)),
            timestamp: Date.now(),
            hash: this.generateGridHash(gridState)
        };
        
        // Also add to history
        this.cascadeState.gridStateHistory.push({
            stepNumber: stepNumber,
            gridState: JSON.parse(JSON.stringify(gridState)),
            timestamp: Date.now(),
            hash: this.generateGridHash(gridState)
        });
        
        // Limit history size
        if (this.cascadeState.gridStateHistory.length > 20) {
            this.cascadeState.gridStateHistory.shift();
        }
    }
    
    /**
     * Saves spin result for recovery purposes
     * @param {SpinResult} spinResult - Spin result to save
     */
    saveSpinResult(spinResult) {
        this.recoveryState.savedSpinResults[spinResult.spinId] = {
            spinResult: spinResult.toJSON(),
            timestamp: Date.now()
        };
        
        // Limit saved results
        const savedKeys = Object.keys(this.recoveryState.savedSpinResults);
        if (savedKeys.length > 10) {
            // Remove oldest
            const oldest = savedKeys.reduce((oldest, key) => {
                const current = this.recoveryState.savedSpinResults[key];
                const oldestValue = this.recoveryState.savedSpinResults[oldest];
                return current.timestamp < oldestValue.timestamp ? key : oldest;
            });
            delete this.recoveryState.savedSpinResults[oldest];
        }
    }
    
    /**
     * Generates a hash for a grid state
     * @param {Array} gridState - Grid state to hash
     * @returns {string} SHA-256 hash of the grid
     */
    generateGridHash(gridState) {
        const gridString = JSON.stringify(gridState);
        const hash = crypto.createHash('sha256');
        hash.update(gridString + this.security.validationSalt);
        return hash.digest('hex');
    }
    
    /**
     * Generates a session validation hash
     * @returns {string} SHA-256 hash of session state
     */
    generateSessionHash() {
        const dataToHash = {
            sessionId: this.sessionId,
            playerId: this.playerId,
            cascadeState: this.cascadeState,
            gameState: this.gameState,
            timestamp: Date.now(),
            salt: this.security.validationSalt
        };
        
        const jsonString = JSON.stringify(dataToHash);
        const hash = crypto.createHash('sha256');
        hash.update(jsonString);
        return hash.digest('hex');
    }
    
    /**
     * Updates the session validation hash
     */
    updateSessionHash() {
        this.security.sessionHash = this.generateSessionHash();
    }
    
    /**
     * Validates the session structure and state
     * @returns {Object} Validation result with success flag and errors
     */
    validate() {
        const errors = [];
        
        // Basic validation
        if (!this.sessionId || !this.createdAt) {
            errors.push('Missing required session fields');
        }
        
        // Validate cascade state
        if (this.cascadeState.currentCascadeStep < 0) {
            errors.push('Invalid cascade step number');
        }
        
        if (this.cascadeState.cascadeInProgress && !this.cascadeState.currentSpinId) {
            errors.push('Cascade in progress but no spin ID');
        }
        
        // Validate game state
        if (this.gameState.balance < 0) {
            errors.push('Invalid balance');
        }
        
        if (this.gameState.currentBet <= 0) {
            errors.push('Invalid bet amount');
        }
        
        // Validate synchronization status
        const validSyncStates = ['synchronized', 'desynchronized', 'recovering'];
        if (!validSyncStates.includes(this.synchronizationStatus.clientServerSync)) {
            errors.push('Invalid synchronization status');
        }
        
        return {
            success: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Checks if the session has expired
     * @param {number} timeoutMs - Timeout in milliseconds (default: 1 hour)
     * @returns {boolean} True if session has expired
     */
    isExpired(timeoutMs = 3600000) {
        return Date.now() - this.lastActivity > timeoutMs;
    }
    
    /**
     * Checks if the session is in a recoverable state
     * @returns {boolean} True if recoverable
     */
    isRecoverable() {
        if (this.synchronizationStatus.recoveryAttempts >= this.synchronizationStatus.maxRecoveryAttempts) {
            return false;
        }
        
        if (this.isExpired()) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Gets session statistics
     * @returns {Object} Session statistics
     */
    getStatistics() {
        return {
            sessionDuration: Date.now() - this.createdAt,
            totalSpins: this.gameState.totalSpins,
            totalWins: this.gameState.totalWins,
            winRate: this.gameState.totalSpins > 0 ? this.gameState.totalWins / this.gameState.totalSpins : 0,
            sessionWinLoss: this.gameState.sessionWinLoss,
            pendingValidations: this.pendingValidations.stepValidationQueue.length + this.pendingValidations.gridValidationQueue.length,
            syncFailures: this.synchronizationStatus.syncFailureCount,
            recoveryAttempts: this.synchronizationStatus.recoveryAttempts,
            disconnections: this.connection.disconnections,
            lastActivity: this.lastActivity,
            connectionQuality: this.connection.connectionQuality
        };
    }
    
    /**
     * Converts to JSON for network transmission or storage
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            sessionId: this.sessionId,
            playerId: this.playerId,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity,
            isActive: this.isActive,
            cascadeState: this.cascadeState,
            pendingValidations: {
                stepValidationQueue: this.pendingValidations.stepValidationQueue,
                gridValidationQueue: this.pendingValidations.gridValidationQueue,
                maxQueueSize: this.pendingValidations.maxQueueSize,
                validationTimeout: this.pendingValidations.validationTimeout,
                lastValidationTime: this.pendingValidations.lastValidationTime
            },
            synchronizationStatus: this.synchronizationStatus,
            recoveryState: this.recoveryState,
            gameState: this.gameState,
            connection: this.connection,
            security: {
                validationSalt: this.security.validationSalt,
                securityLevel: this.security.securityLevel,
                fraudScore: this.security.fraudScore,
                lastSecurityCheck: this.security.lastSecurityCheck
            },
            metadata: this.metadata
        };
    }
    
    /**
     * Creates a GameSession from JSON data
     * @param {Object} json - JSON data
     * @returns {GameSession} New GameSession instance
     */
    static fromJSON(json) {
        return new GameSession(json);
    }
    
    /**
     * Creates a test session for development
     * @param {string} playerId - Player ID
     * @returns {GameSession} Test session
     */
    static createTestSession(playerId = 'test_player') {
        const session = new GameSession({
            playerId: playerId,
            gameState: {
                balance: 1000,
                currentBet: 1.00
            },
            metadata: {
                sessionType: 'test',
                debugMode: true
            }
        });
        
        session.updateSessionHash();
        return session;
    }
}

module.exports = GameSession;