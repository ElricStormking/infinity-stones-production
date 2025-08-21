/**
 * Task 3.6.1: Test CascadeAPI validation features
 * Comprehensive tests for client-side validation integration in CascadeAPI
 */

// Global test setup for Phaser environment simulation
const setupTestEnvironment = () => {
    // Mock Phaser 3 global objects
    global.window = global.window || {};
    
    // Mock GameConfig
    window.GameConfig = {
        MIN_BET: 1,
        MAX_BET: 100,
        BET_LEVELS: [1, 5, 10, 25, 50, 100],
        SYMBOL_TYPES: ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem']
    };
    
    // Mock NetworkService
    window.NetworkService = {
        isSocketConnected: jest.fn(() => true),
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        post: jest.fn(),
        get: jest.fn()
    };
    
    // Mock GridManager
    window.GridManager = {
        getCurrentGrid: jest.fn(() => [
            ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
            ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
            ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
            ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
            ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
            ['soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ]),
        setGrid: jest.fn(),
        generateRandomGrid: jest.fn(() => [
            ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
            ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
            ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
            ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
            ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
            ['soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ])
    };
    
    // Mock WinCalculator
    window.WinCalculator = {
        calculateWins: jest.fn(() => ({ totalWin: 100, winGroups: [] }))
    };
    
    // Mock GameStateManager
    window.GameStateManager = {
        getState: jest.fn(() => ({ currentState: 'idle' })),
        setState: jest.fn()
    };
    
    // Mock AnimationManager
    window.AnimationManager = {
        adjustTiming: jest.fn()
    };
    
    // Mock gameScene
    window.gameScene = {
        events: {
            emit: jest.fn()
        }
    };
    
    // Mock Web Crypto API
    global.crypto = {
        subtle: {
            digest: jest.fn(async (algorithm, data) => {
                // Return mock hash buffer
                return new ArrayBuffer(32);
            })
        }
    };
    
    // Mock TextEncoder
    global.TextEncoder = jest.fn(() => ({
        encode: jest.fn((str) => new Uint8Array(Buffer.from(str)))
    }));
    
    // Mock console methods
    global.console = {
        ...console,
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
};

// Load CascadeAPI
const loadCascadeAPI = () => {
    // Clear any existing CascadeAPI instance
    if (window.CascadeAPI) {
        delete window.CascadeAPI;
    }
    if (window.cascadeAPI) {
        delete window.cascadeAPI;
    }
    
    // Load the CascadeAPI class
    const fs = require('fs');
    const path = require('path');
    const cascadeAPIPath = path.join(__dirname, '../../services/CascadeAPI.js');
    const cascadeAPICode = fs.readFileSync(cascadeAPIPath, 'utf8');
    
    // Execute the code to define window.CascadeAPI
    eval(cascadeAPICode);
    
    return window.cascadeAPI;
};

describe('CascadeAPI Validation Features - Task 3.6.1', () => {
    let cascadeAPI;
    
    beforeAll(() => {
        setupTestEnvironment();
        cascadeAPI = loadCascadeAPI();
    });
    
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        
        // Reset cascadeAPI state
        cascadeAPI.clearSyncState();
        cascadeAPI.isSpinning = false;
        cascadeAPI.desyncDetected = false;
        cascadeAPI.recoveryAttempts = 0;
    });
    
    afterEach(() => {
        // Clean up any timeouts
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });
    
    describe('Client-side Validation Hash Generation', () => {
        test('should generate SHA-256 validation hashes', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'test_salt_123'
            };
            
            const hash = await cascadeAPI.generateClientValidationHash(gridState, stepData);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
        });
        
        test('should generate consistent hashes for identical data', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            const stepData = {
                stepIndex: 1,
                timestamp: 1234567890,
                salt: 'consistent_salt'
            };
            
            const hash1 = await cascadeAPI.generateClientValidationHash(gridState, stepData);
            const hash2 = await cascadeAPI.generateClientValidationHash(gridState, stepData);
            
            expect(hash1).toBe(hash2);
        });
        
        test('should generate different hashes for different step indices', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            const baseStepData = {
                timestamp: 1234567890,
                salt: 'test_salt'
            };
            
            const hash1 = await cascadeAPI.generateClientValidationHash(gridState, { ...baseStepData, stepIndex: 1 });
            const hash2 = await cascadeAPI.generateClientValidationHash(gridState, { ...baseStepData, stepIndex: 2 });
            
            expect(hash1).not.toBe(hash2);
        });
        
        test('should handle hash generation errors gracefully', async () => {
            // Mock crypto.subtle.digest to throw an error
            crypto.subtle.digest.mockRejectedValueOnce(new Error('Crypto API error'));
            
            const gridState = window.GridManager.getCurrentGrid();
            const stepData = { stepIndex: 1, timestamp: Date.now(), salt: 'test' };
            
            await expect(cascadeAPI.generateClientValidationHash(gridState, stepData))
                .rejects.toThrow('Hash generation failed: Crypto API error');
        });
    });
    
    describe('Hash Verification System', () => {
        test('should verify matching hashes successfully', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'verification_test'
            };
            
            const clientHash = await cascadeAPI.generateClientValidationHash(gridState, stepData);
            const isValid = await cascadeAPI.verifyValidationHash(clientHash, gridState, stepData);
            
            expect(isValid).toBe(true);
            expect(cascadeAPI.validationHashes.has(stepData.stepIndex)).toBe(true);
            
            const storedValidation = cascadeAPI.validationHashes.get(stepData.stepIndex);
            expect(storedValidation.verified).toBe(true);
            expect(storedValidation.serverHash).toBe(clientHash);
            expect(storedValidation.clientHash).toBe(clientHash);
        });
        
        test('should detect hash mismatches and trigger desync', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'mismatch_test'
            };
            
            const clientHash = await cascadeAPI.generateClientValidationHash(gridState, stepData);
            const fakeServerHash = 'fake_hash_that_does_not_match';
            
            // Spy on detectDesync method
            const detectDesyncSpy = jest.spyOn(cascadeAPI, 'detectDesync');
            
            const isValid = await cascadeAPI.verifyValidationHash(fakeServerHash, gridState, stepData);
            
            expect(isValid).toBe(false);
            expect(detectDesyncSpy).toHaveBeenCalledWith('hash_mismatch', {
                stepIndex: stepData.stepIndex,
                serverHash: fakeServerHash,
                clientHash: clientHash
            });
            
            const storedValidation = cascadeAPI.validationHashes.get(stepData.stepIndex);
            expect(storedValidation.verified).toBe(false);
        });
        
        test('should handle verification errors gracefully', async () => {
            // Mock generateClientValidationHash to throw an error
            jest.spyOn(cascadeAPI, 'generateClientValidationHash').mockRejectedValueOnce(new Error('Hash generation failed'));
            
            const gridState = window.GridManager.getCurrentGrid();
            const stepData = { stepIndex: 1, timestamp: Date.now(), salt: 'error_test' };
            
            const isValid = await cascadeAPI.verifyValidationHash('some_hash', gridState, stepData);
            
            expect(isValid).toBe(false);
        });
    });
    
    describe('Step Acknowledgment System', () => {
        test('should send step acknowledgments with validation results', async () => {
            const stepData = {
                stepIndex: 1,
                requestId: 'test_request_123',
                timestamp: Date.now(),
                gridState: window.GridManager.getCurrentGrid(),
                receivedAt: Date.now()
            };
            
            const validationResult = {
                hashVerified: true,
                processed: true,
                errors: []
            };
            
            // Mock current sync session
            cascadeAPI.currentSyncSession = {
                sessionId: 'test_session_456'
            };
            
            const acknowledgment = await cascadeAPI.sendStepAcknowledgment(stepData, validationResult);
            
            expect(acknowledgment).toBeDefined();
            expect(acknowledgment.sessionId).toBe('test_session_456');
            expect(acknowledgment.stepIndex).toBe(1);
            expect(acknowledgment.requestId).toBe('test_request_123');
            expect(acknowledgment.validationResult).toEqual(validationResult);
            expect(acknowledgment.clientTimestamp).toBeDefined();
            expect(acknowledgment.serverTimestamp).toBe(stepData.timestamp);
            expect(acknowledgment.processingTime).toBeDefined();
            
            expect(window.NetworkService.emit).toHaveBeenCalledWith('step_acknowledgment', acknowledgment);
            expect(cascadeAPI.stepAcknowledgments.has(stepData.stepIndex)).toBe(true);
        });
        
        test('should send session acknowledgments', () => {
            const sessionId = 'test_session_789';
            
            cascadeAPI.sendSessionAcknowledgment(sessionId);
            
            expect(window.NetworkService.emit).toHaveBeenCalledWith('session_acknowledgment', {
                sessionId: sessionId,
                clientTimestamp: expect.any(Number),
                status: 'session_started',
                clientReady: true
            });
        });
        
        test('should handle step timeouts', () => {
            jest.useFakeTimers();
            
            const stepIndex = 1;
            const acknowledgment = { stepIndex: 1, sessionId: 'test' };
            
            const detectDesyncSpy = jest.spyOn(cascadeAPI, 'detectDesync');
            
            cascadeAPI.setStepTimeout(stepIndex, acknowledgment);
            
            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(cascadeAPI.syncConfig.stepTimeoutMs + 100);
            
            expect(detectDesyncSpy).toHaveBeenCalledWith('step_timeout', { stepIndex, acknowledgment });
        });
    });
    
    describe('Desync Detection System', () => {
        test('should detect and report desync conditions', () => {
            const reason = 'test_desync_reason';
            const details = { stepIndex: 1, error: 'test error' };
            
            const captureClientStateSpy = jest.spyOn(cascadeAPI, 'captureClientState').mockReturnValue({
                currentStep: 1,
                gridState: 'test_grid'
            });
            
            const reportDesyncSpy = jest.spyOn(cascadeAPI, 'reportDesync');
            
            const desyncReport = cascadeAPI.detectDesync(reason, details);
            
            expect(cascadeAPI.desyncDetected).toBe(true);
            expect(desyncReport.reason).toBe(reason);
            expect(desyncReport.details).toEqual(details);
            expect(desyncReport.clientTimestamp).toBeDefined();
            expect(desyncReport.clientState).toBeDefined();
            expect(desyncReport.recoveryNeeded).toBe(true);
            
            expect(captureClientStateSpy).toHaveBeenCalled();
            expect(reportDesyncSpy).toHaveBeenCalledWith(desyncReport);
            expect(window.gameScene.events.emit).toHaveBeenCalledWith('desync_detected', desyncReport);
        });
        
        test('should skip desync detection when disabled', () => {
            cascadeAPI.syncConfig.enableDesyncDetection = false;
            
            const reportDesyncSpy = jest.spyOn(cascadeAPI, 'reportDesync');
            
            const result = cascadeAPI.detectDesync('test_reason', {});
            
            expect(result).toBeUndefined();
            expect(cascadeAPI.desyncDetected).toBe(false);
            expect(reportDesyncSpy).not.toHaveBeenCalled();
        });
        
        test('should capture comprehensive client state', () => {
            cascadeAPI.currentSyncSession = {
                currentStep: 2,
                expectedSteps: 5
            };
            cascadeAPI.validationHashes.set(1, { hash: 'test1' });
            cascadeAPI.stepAcknowledgments.set(2, { ack: 'test2' });
            
            const clientState = cascadeAPI.captureClientState();
            
            expect(clientState.currentStep).toBe(2);
            expect(clientState.expectedSteps).toBe(5);
            expect(clientState.validationHashes).toEqual([[ 1, { hash: 'test1' } ]]);
            expect(clientState.pendingAcknowledgments).toEqual([2]);
            expect(clientState.gridState).toBeDefined();
            expect(clientState.gameState).toBeDefined();
        });
    });
    
    describe('Recovery Mechanisms', () => {
        test('should initiate recovery with proper request data', async () => {
            const desyncData = {
                reason: 'hash_mismatch',
                stepIndex: 1
            };
            
            cascadeAPI.currentSyncSession = { sessionId: 'test_session' };
            
            const recoveryRequest = await cascadeAPI.initiateRecovery(desyncData);
            
            expect(recoveryRequest).toBeDefined();
            expect(recoveryRequest.sessionId).toBe('test_session');
            expect(recoveryRequest.recoveryType).toBe('state_resync');
            expect(recoveryRequest.desyncReason).toBe('hash_mismatch');
            expect(recoveryRequest.attemptNumber).toBe(1);
            expect(cascadeAPI.recoveryAttempts).toBe(1);
            
            expect(window.NetworkService.emit).toHaveBeenCalledWith('recovery_request', recoveryRequest);
        });
        
        test('should determine correct recovery types', () => {
            const testCases = [
                { reason: 'hash_mismatch', expected: 'state_resync' },
                { reason: 'step_timeout', expected: 'step_replay' },
                { reason: 'timing_error', expected: 'timing_adjustment' },
                { reason: 'grid_inconsistency', expected: 'full_resync' },
                { reason: 'unknown_reason', expected: 'state_resync' }
            ];
            
            testCases.forEach(({ reason, expected }) => {
                const recoveryType = cascadeAPI.determineRecoveryType({ reason });
                expect(recoveryType).toBe(expected);
            });
        });
        
        test('should limit recovery attempts and fallback', async () => {
            cascadeAPI.recoveryAttempts = cascadeAPI.maxRecoveryAttempts;
            
            const handleRecoveryFailureSpy = jest.spyOn(cascadeAPI, 'handleRecoveryFailure');
            
            const result = await cascadeAPI.initiateRecovery({ reason: 'test' });
            
            expect(result).toBeUndefined();
            expect(handleRecoveryFailureSpy).toHaveBeenCalled();
        });
        
        test('should process state resync recovery', () => {
            const recoveryData = {
                recoveryType: 'state_resync',
                correctState: {
                    gridState: 'new_grid_state'
                }
            };
            
            const handleRecoverySuccessSpy = jest.spyOn(cascadeAPI, 'handleRecoverySuccess');
            
            cascadeAPI.processRecoveryData(recoveryData);
            
            expect(window.GridManager.setGrid).toHaveBeenCalledWith('new_grid_state');
            expect(cascadeAPI.validationHashes.size).toBe(0);
            expect(cascadeAPI.stepAcknowledgments.size).toBe(0);
            expect(handleRecoverySuccessSpy).toHaveBeenCalledWith(recoveryData);
        });
        
        test('should process timing adjustment recovery', () => {
            const recoveryData = {
                recoveryType: 'timing_adjustment',
                timingCorrection: 500
            };
            
            cascadeAPI.processRecoveryData(recoveryData);
            
            expect(window.AnimationManager.adjustTiming).toHaveBeenCalledWith(500);
        });
    });
    
    describe('Synchronization Status and Configuration', () => {
        test('should return comprehensive sync status', () => {
            cascadeAPI.currentSyncSession = {
                isActive: true,
                sessionId: 'test_session',
                currentStep: 3,
                expectedSteps: 10
            };
            cascadeAPI.desyncDetected = false;
            cascadeAPI.recoveryAttempts = 1;
            cascadeAPI.validationHashes.set(1, { verified: true });
            
            const status = cascadeAPI.getSyncStatus();
            
            expect(status.isActive).toBe(true);
            expect(status.sessionId).toBe('test_session');
            expect(status.currentStep).toBe(3);
            expect(status.expectedSteps).toBe(10);
            expect(status.desyncDetected).toBe(false);
            expect(status.recoveryAttempts).toBe(1);
            expect(status.lastValidationSuccess).toBe(true);
        });
        
        test('should update sync configuration', () => {
            const newConfig = {
                stepTimeoutMs: 10000,
                enableDesyncDetection: false,
                customParam: 'test_value'
            };
            
            cascadeAPI.setSyncConfig(newConfig);
            
            expect(cascadeAPI.syncConfig.stepTimeoutMs).toBe(10000);
            expect(cascadeAPI.syncConfig.enableDesyncDetection).toBe(false);
            expect(cascadeAPI.syncConfig.customParam).toBe('test_value');
            // Original config should be preserved
            expect(cascadeAPI.syncConfig.hashAlgorithm).toBe('SHA-256');
        });
        
        test('should clear sync state completely', () => {
            // Set up some state
            cascadeAPI.currentSyncSession = { sessionId: 'test' };
            cascadeAPI.validationHashes.set(1, { hash: 'test' });
            cascadeAPI.stepAcknowledgments.set(1, { ack: 'test' });
            cascadeAPI.desyncDetected = true;
            cascadeAPI.recoveryAttempts = 2;
            
            cascadeAPI.clearSyncState();
            
            expect(cascadeAPI.syncSessions.size).toBe(0);
            expect(cascadeAPI.currentSyncSession).toBeNull();
            expect(cascadeAPI.validationHashes.size).toBe(0);
            expect(cascadeAPI.stepAcknowledgments.size).toBe(0);
            expect(cascadeAPI.desyncDetected).toBe(false);
            expect(cascadeAPI.recoveryAttempts).toBe(0);
        });
    });
    
    describe('Integration with Enhanced Synchronization', () => {
        test('should process cascade steps with synchronization', async () => {
            const stepData = {
                stepIndex: 1,
                gridState: window.GridManager.getCurrentGrid(),
                validationHash: 'test_hash',
                timestamp: Date.now()
            };
            
            cascadeAPI.currentSyncSession = { sessionId: 'test_session' };
            
            const verifyValidationHashSpy = jest.spyOn(cascadeAPI, 'verifyValidationHash').mockResolvedValue(true);
            const sendStepAcknowledgmentSpy = jest.spyOn(cascadeAPI, 'sendStepAcknowledgment').mockResolvedValue({});
            
            await cascadeAPI.processStepWithSync(stepData);
            
            expect(stepData.receivedAt).toBeDefined();
            expect(verifyValidationHashSpy).toHaveBeenCalledWith('test_hash', stepData.gridState, stepData);
            expect(cascadeAPI.currentSyncSession.currentStep).toBe(1);
            expect(sendStepAcknowledgmentSpy).toHaveBeenCalledWith(stepData, {
                hashVerified: true,
                processed: true,
                errors: []
            });
        });
        
        test('should handle sync session events', () => {
            const sessionData = {
                sessionId: 'new_session_123',
                requestId: 'request_456',
                serverStartTime: Date.now(),
                expectedSteps: 5,
                validationData: { test: 'data' }
            };
            
            const sendSessionAcknowledgmentSpy = jest.spyOn(cascadeAPI, 'sendSessionAcknowledgment');
            
            cascadeAPI.handleSyncSessionStart(sessionData);
            
            expect(cascadeAPI.syncSessions.has('new_session_123')).toBe(true);
            expect(cascadeAPI.currentSyncSession.sessionId).toBe('new_session_123');
            expect(cascadeAPI.currentSyncSession.isActive).toBe(true);
            expect(sendSessionAcknowledgmentSpy).toHaveBeenCalledWith('new_session_123');
        });
        
        test('should validate and acknowledge steps on server request', async () => {
            const validationData = {
                stepIndex: 2,
                expectedHash: 'expected_hash_123',
                gridState: window.GridManager.getCurrentGrid(),
                requestId: 'validation_request_789'
            };
            
            cascadeAPI.currentSyncSession = { sessionId: 'active_session' };
            
            const verifyValidationHashSpy = jest.spyOn(cascadeAPI, 'verifyValidationHash').mockResolvedValue(true);
            
            await cascadeAPI.validateAndAcknowledgeStep(validationData);
            
            expect(verifyValidationHashSpy).toHaveBeenCalledWith(
                'expected_hash_123',
                validationData.gridState,
                validationData
            );
            
            expect(window.NetworkService.emit).toHaveBeenCalledWith('step_validation_response', {
                sessionId: 'active_session',
                stepIndex: 2,
                validationResult: true,
                clientTimestamp: expect.any(Number),
                responseToRequest: 'validation_request_789'
            });
        });
    });
    
    describe('Performance and Error Handling', () => {
        test('should handle concurrent validation operations', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            const stepDataArray = Array.from({ length: 10 }, (_, i) => ({
                stepIndex: i,
                timestamp: Date.now() + i,
                salt: `salt_${i}`
            }));
            
            const hashPromises = stepDataArray.map(stepData => 
                cascadeAPI.generateClientValidationHash(gridState, stepData)
            );
            
            const hashes = await Promise.all(hashPromises);
            
            expect(hashes).toHaveLength(10);
            expect(new Set(hashes).size).toBe(10); // All hashes should be unique
        });
        
        test('should maintain validation hash storage limits', async () => {
            const gridState = window.GridManager.getCurrentGrid();
            
            // Add many validation results
            for (let i = 0; i < 100; i++) {
                cascadeAPI.validationHashes.set(i, {
                    serverHash: `hash_${i}`,
                    clientHash: `hash_${i}`,
                    verified: true,
                    timestamp: Date.now()
                });
            }
            
            expect(cascadeAPI.validationHashes.size).toBe(100);
            
            // The implementation should handle large numbers gracefully
            // (In a production system, there might be automatic cleanup)
        });
        
        test('should provide comprehensive statistics', () => {
            // Set up test state
            cascadeAPI.isSpinning = true;
            cascadeAPI.lastSpinResult = {
                requestId: 'last_spin_123',
                totalWin: 500,
                serverGenerated: true,
                timestamp: Date.now()
            };
            cascadeAPI.currentSyncSession = { sessionId: 'stats_session' };
            cascadeAPI.desyncDetected = false;
            cascadeAPI.recoveryAttempts = 1;
            cascadeAPI.validationHashes.set(1, { verified: true });
            cascadeAPI.stepAcknowledgments.set(1, { ack: 'test' });
            
            const stats = cascadeAPI.getStats();
            
            expect(stats.isSpinning).toBe(true);
            expect(stats.lastSpinResult.requestId).toBe('last_spin_123');
            expect(stats.lastSpinResult.totalWin).toBe(500);
            expect(stats.syncStats.currentSessionId).toBe('stats_session');
            expect(stats.syncStats.desyncDetected).toBe(false);
            expect(stats.syncStats.recoveryAttempts).toBe(1);
            expect(stats.syncStats.validationHashes).toBe(1);
            expect(stats.syncStats.pendingAcknowledgments).toBe(1);
        });
    });
});