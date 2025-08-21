// CascadeAPI - Client-side interface for server-side GridEngine communication
// Follows global window pattern for Phaser compatibility

window.CascadeAPI = class CascadeAPI {
    constructor() {
        this.isSpinning = false;
        this.lastSpinResult = null;
        this.fallbackEnabled = true;
        this.requestTimeouts = new Map();
        
        // Enhanced Cascade Synchronization state
        this.syncSessions = new Map();
        this.currentSyncSession = null;
        this.validationHashes = new Map();
        this.stepAcknowledgments = new Map();
        this.desyncDetected = false;
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
        
        // Synchronization configuration
        this.syncConfig = {
            stepTimeoutMs: 5000,
            validationToleranceMs: 1000,
            hashAlgorithm: 'SHA-256',
            enableDesyncDetection: true,
            enableRecovery: true
        };
        
        // Setup WebSocket listeners for real-time spin events
        this.setupWebSocketListeners();
        
        console.log('🎰 CascadeAPI initialized with Enhanced Synchronization');
    }
    
    setupWebSocketListeners() {
        // Listen for cascade step updates during spin
        window.NetworkService.on('cascade_step', (data) => {
            this.handleCascadeStep(data);
        });
        
        // Listen for complete spin results
        window.NetworkService.on('spin_complete', (data) => {
            this.handleSpinComplete(data);
        });
        
        // Listen for server errors
        window.NetworkService.on('server_error', (data) => {
            this.handleServerError(data);
        });
        
        // Enhanced Synchronization event listeners
        window.NetworkService.on('sync_session_start', (data) => {
            this.handleSyncSessionStart(data);
        });
        
        window.NetworkService.on('step_validation_request', (data) => {
            this.handleStepValidationRequest(data);
        });
        
        window.NetworkService.on('desync_detected', (data) => {
            this.handleDesyncDetected(data);
        });
        
        window.NetworkService.on('recovery_data', (data) => {
            this.handleRecoveryData(data);
        });
        
        window.NetworkService.on('sync_session_complete', (data) => {
            this.handleSyncSessionComplete(data);
        });
    }
    
    /**
     * Main spin method - communicates with server-side GridEngine
     * @param {number} betAmount - Bet amount in credits
     * @param {boolean} quickSpinMode - Enable rapid animations
     * @returns {Promise<SpinResult>} Complete spin result with timing data
     */
    async spin(betAmount, quickSpinMode = false) {
        if (this.isSpinning) {
            throw new Error('Spin already in progress');
        }
        
        if (!this.validateBetAmount(betAmount)) {
            throw new Error(`Invalid bet amount: ${betAmount}`);
        }
        
        this.isSpinning = true;
        const requestId = this.generateRequestId();
        
        try {
            // Determine communication method (WebSocket preferred for real-time)
            if (window.NetworkService.isSocketConnected()) {
                return await this.spinViaWebSocket(betAmount, quickSpinMode, requestId);
            } else {
                return await this.spinViaHTTP(betAmount, quickSpinMode, requestId);
            }
        } catch (error) {
            console.error('❌ Spin failed:', error);
            this.isSpinning = false;
            
            // Attempt fallback to client-side logic if enabled
            if (this.fallbackEnabled && this.shouldFallback(error)) {
                console.warn('🔄 Falling back to client-side spin logic');
                return await this.fallbackSpin(betAmount, quickSpinMode);
            }
            
            throw error;
        }
    }
    
    /**
     * WebSocket-based spin for real-time cascade updates
     */
    async spinViaWebSocket(betAmount, quickSpinMode, requestId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.cleanup(requestId);
                this.isSpinning = false;
                reject(new Error('Spin request timeout (WebSocket)'));
            }, 15000); // Longer timeout for complex cascades
            
            this.requestTimeouts.set(requestId, timeout);
            
            // Setup one-time listeners for this specific request
            const handleSpinComplete = (data) => {
                if (data.requestId === requestId) {
                    this.cleanup(requestId);
                    this.isSpinning = false;
                    
                    // Transform server response to SpinResult format
                    const spinResult = this.transformServerResponse(data);
                    this.lastSpinResult = spinResult;
                    
                    resolve(spinResult);
                }
            };
            
            const handleError = (error) => {
                if (error.requestId === requestId || !error.requestId) {
                    this.cleanup(requestId);
                    this.isSpinning = false;
                    reject(new Error(error.message || 'WebSocket spin error'));
                }
            };
            
            // Register listeners
            window.NetworkService.on('spin_complete', handleSpinComplete);
            window.NetworkService.on('server_error', handleError);
            
            // Store listeners for cleanup
            this.requestTimeouts.set(`${requestId}_listeners`, {
                spinComplete: handleSpinComplete,
                error: handleError
            });
            
            // Send spin request via WebSocket
            window.NetworkService.emit('cascade_spin', {
                requestId: requestId,
                betAmount: betAmount,
                quickSpinMode: quickSpinMode,
                timestamp: Date.now()
            });
            
            console.log(`🎰 WebSocket spin request sent: ${requestId}, bet: ${betAmount}`);
        });
    }
    
    /**
     * HTTP-based spin for basic functionality
     */
    async spinViaHTTP(betAmount, quickSpinMode, requestId) {
        try {
            const response = await window.NetworkService.post('/api/spin', {
                requestId: requestId,
                betAmount: betAmount,
                quickSpinMode: quickSpinMode,
                timestamp: Date.now()
            });
            
            this.isSpinning = false;
            
            if (!response.success) {
                throw new Error(response.error || 'HTTP spin request failed');
            }
            
            // Transform server response to SpinResult format
            const spinResult = this.transformServerResponse(response.data);
            this.lastSpinResult = spinResult;
            
            console.log(`✅ HTTP spin completed: ${requestId}`);
            return spinResult;
            
        } catch (error) {
            this.isSpinning = false;
            throw error;
        }
    }
    
    /**
     * Transform server GridEngine response to client SpinResult format
     */
    transformServerResponse(serverData) {
        const { 
            requestId, 
            initialGrid, 
            cascadeSteps, 
            finalGrid, 
            totalWin, 
            totalMultiplier,
            netResult,
            timing,
            metadata 
        } = serverData;
        
        // Create SpinResult object compatible with existing game logic
        const spinResult = {
            requestId: requestId,
            success: true,
            
            // Grid data
            initialGrid: initialGrid,
            finalGrid: finalGrid,
            cascadeSteps: cascadeSteps || [],
            
            // Win data
            totalWin: totalWin || 0,
            totalMultiplier: totalMultiplier || 1,
            netResult: netResult || -serverData.betAmount,
            
            // Timing for synchronized animations
            timing: {
                totalDuration: timing?.totalDuration || 3000,
                stepDuration: timing?.stepDuration || 800,
                dropDelay: timing?.dropDelay || 100,
                winDelay: timing?.winDelay || 500,
                cascadeDelay: timing?.cascadeDelay || 300
            },
            
            // Metadata
            betAmount: serverData.betAmount,
            timestamp: serverData.timestamp || Date.now(),
            quickSpinMode: serverData.quickSpinMode || false,
            
            // Free spins data (if applicable)
            freeSpinsTriggered: metadata?.freeSpinsTriggered || false,
            freeSpinsCount: metadata?.freeSpinsCount || 0,
            freeSpinsRemaining: metadata?.freeSpinsRemaining || 0,
            
            // Server metadata
            serverGenerated: true,
            serverVersion: metadata?.serverVersion || '1.0.0',
            rngSeed: metadata?.rngSeed
        };
        
        return spinResult;
    }
    
    /**
     * Fallback to client-side generation if server unavailable
     */
    async fallbackSpin(betAmount, quickSpinMode) {
        console.log('⚠️ Using client-side fallback spin generation');
        
        // Use existing client-side grid generation
        if (!window.GridManager) {
            throw new Error('GridManager not available for fallback');
        }
        
        // Generate random grid and basic win calculation
        const initialGrid = window.GridManager.generateRandomGrid();
        const winData = window.WinCalculator ? 
            window.WinCalculator.calculateWins(initialGrid, betAmount) : 
            { totalWin: 0, winGroups: [] };
        
        // Simple fallback result
        const fallbackResult = {
            requestId: this.generateRequestId(),
            success: true,
            initialGrid: initialGrid,
            finalGrid: initialGrid, // No cascades in simple fallback
            cascadeSteps: [],
            totalWin: winData.totalWin || 0,
            totalMultiplier: 1,
            netResult: (winData.totalWin || 0) - betAmount,
            timing: {
                totalDuration: quickSpinMode ? 1500 : 3000,
                stepDuration: quickSpinMode ? 400 : 800,
                dropDelay: 50,
                winDelay: 300,
                cascadeDelay: 200
            },
            betAmount: betAmount,
            timestamp: Date.now(),
            quickSpinMode: quickSpinMode,
            freeSpinsTriggered: false,
            freeSpinsCount: 0,
            freeSpinsRemaining: 0,
            serverGenerated: false,
            fallbackMode: true
        };
        
        this.isSpinning = false;
        this.lastSpinResult = fallbackResult;
        
        return fallbackResult;
    }
    
    /**
     * Event handlers for WebSocket events
     */
    handleCascadeStep(data) {
        console.log('🔄 Cascade step received:', data.stepIndex);
        
        // Process step with enhanced synchronization
        this.processStepWithSync(data);
        
        // Emit to game scene for real-time animation
        if (window.gameScene) {
            window.gameScene.events.emit('cascade_step', data);
        }
    }
    
    handleSpinComplete(data) {
        console.log('✅ Spin completed:', data.requestId);
        // Handled by spin promise resolvers
    }
    
    handleServerError(data) {
        console.error('❌ Server error:', data);
        // Handled by spin promise rejecters
    }
    
    /**
     * Enhanced Synchronization event handlers
     */
    handleSyncSessionStart(data) {
        console.log('🔄 Sync session started:', data.sessionId);
        
        const session = {
            sessionId: data.sessionId,
            requestId: data.requestId,
            startTime: Date.now(),
            serverStartTime: data.serverStartTime,
            expectedSteps: data.expectedSteps,
            currentStep: 0,
            validationData: data.validationData,
            isActive: true
        };
        
        this.syncSessions.set(data.sessionId, session);
        this.currentSyncSession = session;
        
        // Send acknowledgment
        this.sendSessionAcknowledgment(data.sessionId);
    }
    
    handleStepValidationRequest(data) {
        console.log('🔍 Step validation requested:', data.stepIndex);
        
        if (this.currentSyncSession) {
            this.validateAndAcknowledgeStep(data);
        }
    }
    
    handleDesyncDetected(data) {
        console.warn('⚠️ Desync detected by server:', data);
        
        this.desyncDetected = true;
        this.reportDesync(data);
        
        if (this.syncConfig.enableRecovery) {
            this.initiateRecovery(data);
        }
    }
    
    handleRecoveryData(data) {
        console.log('🔧 Recovery data received:', data.recoveryType);
        
        this.processRecoveryData(data);
    }
    
    handleSyncSessionComplete(data) {
        console.log('✅ Sync session completed:', data.sessionId);
        
        const session = this.syncSessions.get(data.sessionId);
        if (session) {
            session.isActive = false;
            session.endTime = Date.now();
            session.totalDuration = session.endTime - session.startTime;
        }
        
        this.currentSyncSession = null;
        this.desyncDetected = false;
        this.recoveryAttempts = 0;
    }
    
    /**
     * Utility methods
     */
    validateBetAmount(betAmount) {
        const config = window.GameConfig;
        if (!config) return true; // Skip validation if config not loaded
        
        return betAmount >= config.MIN_BET && 
               betAmount <= config.MAX_BET && 
               (config.BET_LEVELS ? config.BET_LEVELS.includes(betAmount) : true);
    }
    
    shouldFallback(error) {
        // Fallback conditions
        const fallbackErrors = [
            'timeout',
            'network error',
            'connection refused',
            'server unavailable'
        ];
        
        const errorMessage = error.message.toLowerCase();
        return fallbackErrors.some(condition => errorMessage.includes(condition));
    }
    
    generateRequestId() {
        return `spin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    cleanup(requestId) {
        // Clear timeout
        const timeout = this.requestTimeouts.get(requestId);
        if (timeout) {
            clearTimeout(timeout);
            this.requestTimeouts.delete(requestId);
        }
        
        // Remove listeners
        const listeners = this.requestTimeouts.get(`${requestId}_listeners`);
        if (listeners) {
            window.NetworkService.off('spin_complete', listeners.spinComplete);
            window.NetworkService.off('server_error', listeners.error);
            this.requestTimeouts.delete(`${requestId}_listeners`);
        }
    }
    
    /**
     * Public API methods
     */
    isCurrentlySpinning() {
        return this.isSpinning;
    }
    
    getLastSpinResult() {
        return this.lastSpinResult;
    }
    
    setFallbackEnabled(enabled) {
        this.fallbackEnabled = enabled;
        console.log(`🔧 Fallback mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Debug and testing methods
     */
    async testConnection() {
        try {
            const response = await window.NetworkService.get('/api/health');
            console.log('🔍 Server health check:', response);
            return response;
        } catch (error) {
            console.error('❌ Server health check failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    getStats() {
        return {
            isSpinning: this.isSpinning,
            lastSpinResult: this.lastSpinResult ? {
                requestId: this.lastSpinResult.requestId,
                totalWin: this.lastSpinResult.totalWin,
                serverGenerated: this.lastSpinResult.serverGenerated,
                timestamp: this.lastSpinResult.timestamp
            } : null,
            fallbackEnabled: this.fallbackEnabled,
            activeRequests: this.requestTimeouts.size / 2, // Each request has timeout + listeners
            serverConnected: window.NetworkService.isSocketConnected(),
            // Enhanced synchronization stats
            syncStats: {
                activeSyncSessions: this.syncSessions.size,
                currentSessionId: this.currentSyncSession?.sessionId || null,
                desyncDetected: this.desyncDetected,
                recoveryAttempts: this.recoveryAttempts,
                validationHashes: this.validationHashes.size,
                pendingAcknowledgments: this.stepAcknowledgments.size
            }
        };
    }
    
    /**
     * Task 3.1.1: Client-side validation hash verification
     */
    async generateClientValidationHash(gridState, stepData) {
        try {
            // Prepare data for hashing
            const hashData = {
                gridState: gridState,
                stepIndex: stepData.stepIndex,
                timestamp: stepData.timestamp,
                salt: stepData.salt || this.generateSalt()
            };
            
            // Convert to string for hashing
            const dataString = JSON.stringify(hashData, null, 0);
            
            // Generate hash using Web Crypto API
            const encoder = new TextEncoder();
            const data = encoder.encode(dataString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            // Convert to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            console.log('🔒 Generated client validation hash:', hashHex.substring(0, 8) + '...');
            return hashHex;
            
        } catch (error) {
            console.error('❌ Hash generation failed:', error);
            throw new Error(`Hash generation failed: ${error.message}`);
        }
    }
    
    async verifyValidationHash(serverHash, gridState, stepData) {
        try {
            const clientHash = await this.generateClientValidationHash(gridState, stepData);
            const isValid = clientHash === serverHash;
            
            if (isValid) {
                console.log('✅ Validation hash verified');
                this.validationHashes.set(stepData.stepIndex, {
                    serverHash,
                    clientHash,
                    verified: true,
                    timestamp: Date.now()
                });
            } else {
                console.warn('⚠️ Validation hash mismatch!');
                console.warn('Server hash:', serverHash.substring(0, 16) + '...');
                console.warn('Client hash:', clientHash.substring(0, 16) + '...');
                
                this.validationHashes.set(stepData.stepIndex, {
                    serverHash,
                    clientHash,
                    verified: false,
                    timestamp: Date.now()
                });
                
                // Trigger desync detection
                this.detectDesync('hash_mismatch', { stepIndex: stepData.stepIndex, serverHash, clientHash });
            }
            
            return isValid;
            
        } catch (error) {
            console.error('❌ Hash verification failed:', error);
            return false;
        }
    }
    
    /**
     * Task 3.1.2: Step-by-step acknowledgment sending
     */
    async sendStepAcknowledgment(stepData, validationResult) {
        try {
            const acknowledgment = {
                sessionId: this.currentSyncSession?.sessionId,
                stepIndex: stepData.stepIndex,
                requestId: stepData.requestId,
                clientTimestamp: Date.now(),
                serverTimestamp: stepData.timestamp,
                validationResult: validationResult,
                gridStateHash: await this.generateClientValidationHash(stepData.gridState, stepData),
                processingTime: Date.now() - stepData.receivedAt
            };
            
            // Store acknowledgment
            this.stepAcknowledgments.set(stepData.stepIndex, acknowledgment);
            
            // Send via WebSocket
            window.NetworkService.emit('step_acknowledgment', acknowledgment);
            
            console.log(`📤 Step acknowledgment sent: ${stepData.stepIndex}`);
            
            // Set timeout for acknowledgment response
            this.setStepTimeout(stepData.stepIndex, acknowledgment);
            
            return acknowledgment;
            
        } catch (error) {
            console.error('❌ Failed to send step acknowledgment:', error);
            throw error;
        }
    }
    
    sendSessionAcknowledgment(sessionId) {
        const acknowledgment = {
            sessionId: sessionId,
            clientTimestamp: Date.now(),
            status: 'session_started',
            clientReady: true
        };
        
        window.NetworkService.emit('session_acknowledgment', acknowledgment);
        console.log(`📤 Session acknowledgment sent: ${sessionId}`);
    }
    
    setStepTimeout(stepIndex, acknowledgment) {
        const timeoutId = setTimeout(() => {
            console.warn(`⏰ Step acknowledgment timeout: ${stepIndex}`);
            this.handleStepTimeout(stepIndex, acknowledgment);
        }, this.syncConfig.stepTimeoutMs);
        
        this.requestTimeouts.set(`step_${stepIndex}`, timeoutId);
    }
    
    handleStepTimeout(stepIndex, acknowledgment) {
        console.warn(`⚠️ Step ${stepIndex} acknowledgment timed out`);
        
        // Trigger desync detection
        this.detectDesync('step_timeout', { stepIndex, acknowledgment });
    }
    
    /**
     * Task 3.1.3: Desync detection and reporting
     */
    detectDesync(reason, details) {
        if (!this.syncConfig.enableDesyncDetection) {
            return;
        }
        
        console.warn(`🚨 Desync detected: ${reason}`);
        console.warn('Desync details:', details);
        
        this.desyncDetected = true;
        
        const desyncReport = {
            sessionId: this.currentSyncSession?.sessionId,
            reason: reason,
            details: details,
            clientTimestamp: Date.now(),
            clientState: this.captureClientState(),
            recoveryNeeded: true
        };
        
        // Report to server
        this.reportDesync(desyncReport);
        
        // Emit to game scene
        if (window.gameScene) {
            window.gameScene.events.emit('desync_detected', desyncReport);
        }
        
        return desyncReport;
    }
    
    reportDesync(desyncData) {
        try {
            console.log('📤 Reporting desync to server');
            
            const report = {
                ...desyncData,
                reportTimestamp: Date.now(),
                clientVersion: '1.0.0',
                userAgent: navigator.userAgent
            };
            
            // Send via WebSocket
            window.NetworkService.emit('desync_report', report);
            
            // Also log for debugging
            console.error('Desync Report:', report);
            
        } catch (error) {
            console.error('❌ Failed to report desync:', error);
        }
    }
    
    captureClientState() {
        return {
            currentStep: this.currentSyncSession?.currentStep || 0,
            expectedSteps: this.currentSyncSession?.expectedSteps || 0,
            validationHashes: Array.from(this.validationHashes.entries()),
            pendingAcknowledgments: Array.from(this.stepAcknowledgments.keys()),
            gridState: window.GridManager?.getCurrentGrid?.() || null,
            gameState: window.GameStateManager?.getState?.() || null
        };
    }
    
    /**
     * Task 3.1.4: Recovery request mechanisms
     */
    async initiateRecovery(desyncData) {
        if (!this.syncConfig.enableRecovery) {
            console.warn('Recovery disabled, cannot initiate recovery');
            return;
        }
        
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
            console.error('❌ Maximum recovery attempts reached, giving up');
            this.handleRecoveryFailure(desyncData);
            return;
        }
        
        this.recoveryAttempts++;
        console.log(`🔧 Initiating recovery attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts}`);
        
        const recoveryRequest = {
            sessionId: this.currentSyncSession?.sessionId,
            requestId: this.generateRequestId(),
            recoveryType: this.determineRecoveryType(desyncData),
            desyncReason: desyncData.reason,
            clientState: this.captureClientState(),
            requestTimestamp: Date.now(),
            attemptNumber: this.recoveryAttempts
        };
        
        try {
            // Send recovery request
            window.NetworkService.emit('recovery_request', recoveryRequest);
            console.log('📤 Recovery request sent:', recoveryRequest.recoveryType);
            
            // Set recovery timeout
            this.setRecoveryTimeout(recoveryRequest);
            
            return recoveryRequest;
            
        } catch (error) {
            console.error('❌ Failed to initiate recovery:', error);
            this.handleRecoveryFailure(desyncData);
        }
    }
    
    determineRecoveryType(desyncData) {
        switch (desyncData.reason) {
            case 'hash_mismatch':
                return 'state_resync';
            case 'step_timeout':
                return 'step_replay';
            case 'timing_error':
                return 'timing_adjustment';
            case 'grid_inconsistency':
                return 'full_resync';
            default:
                return 'state_resync';
        }
    }
    
    processRecoveryData(recoveryData) {
        console.log(`🔧 Processing recovery: ${recoveryData.recoveryType}`);
        
        try {
            switch (recoveryData.recoveryType) {
                case 'state_resync':
                    this.performStateResync(recoveryData);
                    break;
                case 'step_replay':
                    this.performStepReplay(recoveryData);
                    break;
                case 'timing_adjustment':
                    this.performTimingAdjustment(recoveryData);
                    break;
                case 'full_resync':
                    this.performFullResync(recoveryData);
                    break;
                default:
                    console.warn('Unknown recovery type:', recoveryData.recoveryType);
            }
            
            // Mark recovery as successful
            this.handleRecoverySuccess(recoveryData);
            
        } catch (error) {
            console.error('❌ Recovery processing failed:', error);
            this.handleRecoveryFailure(recoveryData);
        }
    }
    
    performStateResync(recoveryData) {
        console.log('🔄 Performing state resync');
        
        if (recoveryData.correctState && window.GridManager) {
            window.GridManager.setGrid(recoveryData.correctState.gridState);
            console.log('✅ Grid state synchronized');
        }
        
        // Clear validation hashes and start fresh
        this.validationHashes.clear();
        this.stepAcknowledgments.clear();
    }
    
    performStepReplay(recoveryData) {
        console.log('🔄 Performing step replay');
        
        if (recoveryData.replaySteps && window.gameScene) {
            recoveryData.replaySteps.forEach(step => {
                window.gameScene.events.emit('cascade_step', step);
            });
        }
    }
    
    performTimingAdjustment(recoveryData) {
        console.log('🔄 Performing timing adjustment');
        
        if (recoveryData.timingCorrection) {
            // Adjust client timing to match server
            const correction = recoveryData.timingCorrection;
            console.log(`⏰ Timing correction: ${correction}ms`);
            
            // Apply correction to pending animations
            if (window.AnimationManager) {
                window.AnimationManager.adjustTiming(correction);
            }
        }
    }
    
    performFullResync(recoveryData) {
        console.log('🔄 Performing full resync');
        
        // Reset all synchronization state
        this.validationHashes.clear();
        this.stepAcknowledgments.clear();
        this.desyncDetected = false;
        
        // Apply complete state from server
        if (recoveryData.fullState) {
            this.applyFullState(recoveryData.fullState);
        }
    }
    
    applyFullState(fullState) {
        try {
            if (fullState.gridState && window.GridManager) {
                window.GridManager.setGrid(fullState.gridState);
            }
            
            if (fullState.gameState && window.GameStateManager) {
                window.GameStateManager.setState(fullState.gameState);
            }
            
            if (fullState.sessionState && this.currentSyncSession) {
                Object.assign(this.currentSyncSession, fullState.sessionState);
            }
            
            console.log('✅ Full state applied successfully');
            
        } catch (error) {
            console.error('❌ Failed to apply full state:', error);
            throw error;
        }
    }
    
    setRecoveryTimeout(recoveryRequest) {
        const timeoutId = setTimeout(() => {
            console.warn('⏰ Recovery request timeout');
            this.handleRecoveryTimeout(recoveryRequest);
        }, this.syncConfig.stepTimeoutMs * 2); // Longer timeout for recovery
        
        this.requestTimeouts.set(`recovery_${recoveryRequest.requestId}`, timeoutId);
    }
    
    handleRecoverySuccess(recoveryData) {
        console.log('✅ Recovery successful:', recoveryData.recoveryType);
        
        this.desyncDetected = false;
        this.recoveryAttempts = 0;
        
        // Emit recovery success
        if (window.gameScene) {
            window.gameScene.events.emit('recovery_success', recoveryData);
        }
    }
    
    handleRecoveryFailure(recoveryData) {
        console.error('❌ Recovery failed:', recoveryData);
        
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
            console.error('❌ All recovery attempts exhausted, falling back to client-side mode');
            
            // Emit recovery failure
            if (window.gameScene) {
                window.gameScene.events.emit('recovery_failed', recoveryData);
            }
            
            // Force fallback mode
            this.setFallbackEnabled(true);
        }
    }
    
    handleRecoveryTimeout(recoveryRequest) {
        console.warn('⏰ Recovery request timed out');
        this.handleRecoveryFailure(recoveryRequest);
    }
    
    /**
     * Enhanced processing methods
     */
    async processStepWithSync(stepData) {
        try {
            stepData.receivedAt = Date.now();
            
            // Verify validation hash if provided
            if (stepData.validationHash) {
                const hashValid = await this.verifyValidationHash(
                    stepData.validationHash,
                    stepData.gridState,
                    stepData
                );
                
                if (!hashValid) {
                    return; // Desync already triggered in verifyValidationHash
                }
            }
            
            // Update current sync session
            if (this.currentSyncSession) {
                this.currentSyncSession.currentStep = stepData.stepIndex;
            }
            
            // Send acknowledgment
            await this.sendStepAcknowledgment(stepData, {
                hashVerified: !!stepData.validationHash,
                processed: true,
                errors: []
            });
            
        } catch (error) {
            console.error('❌ Failed to process step with sync:', error);
            
            // Send error acknowledgment
            await this.sendStepAcknowledgment(stepData, {
                hashVerified: false,
                processed: false,
                errors: [error.message]
            });
        }
    }
    
    async validateAndAcknowledgeStep(validationData) {
        try {
            const stepIndex = validationData.stepIndex;
            
            // Perform validation
            const isValid = await this.verifyValidationHash(
                validationData.expectedHash,
                validationData.gridState,
                validationData
            );
            
            // Send validation response
            const response = {
                sessionId: this.currentSyncSession?.sessionId,
                stepIndex: stepIndex,
                validationResult: isValid,
                clientTimestamp: Date.now(),
                responseToRequest: validationData.requestId
            };
            
            window.NetworkService.emit('step_validation_response', response);
            console.log(`📤 Step validation response sent: ${stepIndex} - ${isValid ? 'VALID' : 'INVALID'}`);
            
        } catch (error) {
            console.error('❌ Step validation failed:', error);
        }
    }
    
    /**
     * Utility methods for enhanced synchronization
     */
    generateSalt(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let salt = '';
        for (let i = 0; i < length; i++) {
            salt += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return salt;
    }
    
    setSyncConfig(config) {
        this.syncConfig = { ...this.syncConfig, ...config };
        console.log('🔧 Sync configuration updated:', this.syncConfig);
    }
    
    getSyncStatus() {
        return {
            isActive: !!this.currentSyncSession?.isActive,
            sessionId: this.currentSyncSession?.sessionId,
            currentStep: this.currentSyncSession?.currentStep || 0,
            expectedSteps: this.currentSyncSession?.expectedSteps || 0,
            desyncDetected: this.desyncDetected,
            recoveryAttempts: this.recoveryAttempts,
            lastValidationSuccess: this.getLastValidationStatus()
        };
    }
    
    getLastValidationStatus() {
        const lastValidation = Array.from(this.validationHashes.values()).pop();
        return lastValidation ? lastValidation.verified : null;
    }
    
    clearSyncState() {
        this.syncSessions.clear();
        this.currentSyncSession = null;
        this.validationHashes.clear();
        this.stepAcknowledgments.clear();
        this.desyncDetected = false;
        this.recoveryAttempts = 0;
        
        console.log('🧹 Sync state cleared');
    }
};

// Create global instance
window.cascadeAPI = new window.CascadeAPI();

console.log('✅ CascadeAPI loaded and ready');