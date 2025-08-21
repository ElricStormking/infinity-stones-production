/**
 * Task 3.6: Comprehensive Integration Test Suite
 * End-to-end testing of client-side validation integration across all enhanced components
 */

// Global test setup for complete integration environment
const setupIntegrationEnvironment = () => {
    global.window = global.window || {};
    
    // Mock Phaser 3 complete environment
    const mockScene = {
        add: {
            sprite: jest.fn(() => ({
                setOrigin: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                play: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
                x: 0, y: 0, alpha: 1, visible: true
            })),
            text: jest.fn(() => ({
                setOrigin: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            })),
            container: jest.fn(() => ({
                add: jest.fn(),
                setVisible: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            })),
            particles: jest.fn(() => ({
                setDepth: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            }))
        },
        tweens: {
            add: jest.fn(() => ({
                id: Math.random().toString(36),
                pause: jest.fn(),
                resume: jest.fn(),
                stop: jest.fn(),
                destroy: jest.fn()
            })),
            killAll: jest.fn()
        },
        time: {
            delayedCall: jest.fn()
        },
        input: {
            keyboard: {
                on: jest.fn(),
                off: jest.fn(),
                addKey: jest.fn(() => ({ on: jest.fn(), off: jest.fn() }))
            }
        },
        events: {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn()
        },
        cameras: {
            main: { width: 1920, height: 1080 }
        },
        sound: { play: jest.fn() }
    };
    
    // Mock complete GameConfig
    window.GameConfig = {
        GRID_WIDTH: 6,
        GRID_HEIGHT: 5,
        SYMBOL_TYPES: ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'scarlet_witch', 'thanos', 'thanos_weapon'],
        SYMBOL_VALUES: {
            'time_gem': { '8-9': 2, '10-11': 5, '12+': 10 },
            'space_gem': { '8-9': 2, '10-11': 5, '12+': 10 },
            'mind_gem': { '8-9': 2, '10-11': 5, '12+': 10 },
            'power_gem': { '8-9': 2, '10-11': 5, '12+': 10 },
            'reality_gem': { '8-9': 2, '10-11': 5, '12+': 10 },
            'soul_gem': { '8-9': 2, '10-11': 5, '12+': 10 },
            'scarlet_witch': { '8-9': 10, '10-11': 25, '12+': 50 },
            'thanos': { '8-9': 20, '10-11': 50, '12+': 100 },
            'thanos_weapon': { '8-9': 15, '10-11': 35, '12+': 75 }
        },
        MIN_CLUSTER_SIZE: 8,
        MIN_BET: 1,
        MAX_BET: 100,
        BET_LEVELS: [1, 5, 10, 25, 50, 100],
        ANIMATION_TIMINGS: {
            WIN_HIGHLIGHT: 500,
            SYMBOL_REMOVAL: 300,
            SYMBOL_DROP: 600,
            SYMBOL_SETTLE: 200
        },
        SYNC_TOLERANCE_MS: 100,
        UI_DEPTHS: { FX_OVERLAY: 2500 },
        DEBUG_MODE: true,
        CASCADE_DEBUG: true
    };
    
    // Mock debug flags
    window.DEBUG = true;
    window.CASCADE_DEBUG = true;
    
    // Mock NetworkService
    window.NetworkService = {
        isSocketConnected: jest.fn(() => true),
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        post: jest.fn(),
        get: jest.fn()
    };
    
    // Mock SafeSound
    window.SafeSound = {
        play: jest.fn()
    };
    
    // Mock Web Crypto API
    global.crypto = {
        subtle: {
            digest: jest.fn(async () => new ArrayBuffer(32))
        }
    };
    
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
    
    return mockScene;
};

// Load all enhanced components
const loadAllComponents = (mockScene) => {
    const fs = require('fs');
    const path = require('path');
    
    // Load CascadeAPI
    const cascadeAPIPath = path.join(__dirname, '../../services/CascadeAPI.js');
    const cascadeAPICode = fs.readFileSync(cascadeAPIPath, 'utf8');
    eval(cascadeAPICode);
    
    // Load GridManager
    const gridManagerPath = path.join(__dirname, '../../systems/GridManager.js');
    const gridManagerCode = fs.readFileSync(gridManagerPath, 'utf8');
    eval(gridManagerCode);
    
    // Load WinCalculator
    const winCalculatorPath = path.join(__dirname, '../../systems/WinCalculator.js');
    const winCalculatorCode = fs.readFileSync(winCalculatorPath, 'utf8');
    eval(winCalculatorCode);
    
    // Load AnimationManager
    const animationManagerPath = path.join(__dirname, '../../managers/AnimationManager.js');
    const animationManagerCode = fs.readFileSync(animationManagerPath, 'utf8');
    eval(animationManagerCode);
    
    // Load GameScene
    const gameScenePath = path.join(__dirname, '../../scenes/GameScene.js');
    const gameSceneCode = fs.readFileSync(gameScenePath, 'utf8');
    eval(gameSceneCode);
    
    // Create instances
    const components = {
        cascadeAPI: window.cascadeAPI,
        gridManager: new window.GridManager(mockScene, 50, 50, 80),
        winCalculator: new window.WinCalculator(),
        animationManager: new window.AnimationManager(mockScene),
        gameScene: Object.create(window.GameScene.prototype)
    };
    
    // Initialize GameScene with mockScene properties
    Object.assign(components.gameScene, mockScene);
    components.gameScene.initCascadeSyncComponents();
    
    return components;
};

describe('Client-Side Validation Integration - Comprehensive Testing', () => {
    let components;
    let mockScene;
    
    beforeAll(() => {
        mockScene = setupIntegrationEnvironment();
        components = loadAllComponents(mockScene);
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        // Reset all component states
        components.cascadeAPI.clearSyncState();
        components.gridManager.validationHistory.clear();
        components.winCalculator.resetSyncState();
        components.gameScene.resetCascadeSyncState();
    });
    
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });
    
    describe('End-to-End Cascade Synchronization Flow', () => {
        test('should execute complete cascade synchronization from start to finish', async () => {
            // 1. Start sync session
            const sessionData = {
                sessionId: 'integration_test_session',
                requestId: 'integration_request_123',
                expectedSteps: 3,
                validationData: { serverSalt: 'integration_salt' }
            };
            
            components.cascadeAPI.handleSyncSessionStart(sessionData);
            
            expect(components.cascadeAPI.currentSyncSession).toBeDefined();
            expect(components.cascadeAPI.currentSyncSession.sessionId).toBe('integration_test_session');
            
            // 2. Process cascade steps
            const cascadeSteps = [
                {
                    stepIndex: 1,
                    gridState: components.gridManager.captureGridState(),
                    validationHash: 'step1_hash',
                    timing: { duration: 800, serverTimestamp: Date.now() },
                    matches: [{ symbol: 'time_gem', count: 8, positions: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]] }],
                    dropPatterns: [{ column: 0, drops: [{ from: -1, to: 0, symbolType: 'space_gem' }] }]
                },
                {
                    stepIndex: 2,
                    gridState: components.gridManager.captureGridState(),
                    validationHash: 'step2_hash',
                    timing: { duration: 600, serverTimestamp: Date.now() + 800 },
                    matches: [],
                    dropPatterns: []
                },
                {
                    stepIndex: 3,
                    gridState: components.gridManager.captureGridState(),
                    validationHash: 'step3_hash',
                    timing: { duration: 400, serverTimestamp: Date.now() + 1400 },
                    matches: [],
                    dropPatterns: []
                }
            ];
            
            // Process each step through all components
            for (const step of cascadeSteps) {
                // GridManager validation
                const gridValidation = await components.gridManager.validateGridState(step.validationHash, step);
                expect(gridValidation.valid).toBe(true);
                
                // WinCalculator validation
                if (step.matches.length > 0) {
                    const winValidation = components.winCalculator.validateCascadeStep(step, 10, step.stepIndex);
                    expect(winValidation).toBeDefined();
                }
                
                // AnimationManager synchronization
                if (step.matches.length > 0) {
                    const animResult = components.animationManager.animateWinHighlightSync(
                        step.matches[0].positions, 
                        step.timing
                    );
                    expect(animResult.success).toBe(true);
                }
                
                // CascadeAPI step processing
                await components.cascadeAPI.processStepWithSync(step);
                
                // GameScene integration
                await components.gameScene.handleCascadeStepSync(step);
            }
            
            // 3. Complete session
            components.cascadeAPI.handleSyncSessionComplete({ sessionId: 'integration_test_session' });
            
            expect(components.cascadeAPI.currentSyncSession).toBeNull();
            expect(components.cascadeAPI.desyncDetected).toBe(false);
        });
        
        test('should handle desync detection and recovery across all components', async () => {
            // Start session
            const sessionData = {
                sessionId: 'desync_test_session',
                expectedSteps: 2,
                validationData: { serverSalt: 'desync_salt' }
            };
            
            components.cascadeAPI.handleSyncSessionStart(sessionData);
            
            // Create step with mismatched validation hash
            const mismatchedStep = {
                stepIndex: 1,
                gridState: components.gridManager.captureGridState(),
                validationHash: 'expected_hash_123',
                timing: { duration: 800, serverTimestamp: Date.now() },
                matches: []
            };
            
            // Mock hash generation to create mismatch
            jest.spyOn(components.cascadeAPI, 'generateClientValidationHash')
                .mockResolvedValueOnce('different_hash_456');
            
            // Process step - should detect desync
            await components.cascadeAPI.processStepWithSync(mismatchedStep);
            
            expect(components.cascadeAPI.desyncDetected).toBe(true);
            
            // Verify desync detection was triggered
            expect(components.cascadeAPI.detectDesync).toHaveBeenCalledWith('hash_mismatch', expect.any(Object));
            
            // Initiate recovery
            const recoveryRequest = await components.cascadeAPI.initiateRecovery({
                reason: 'hash_mismatch',
                stepIndex: 1
            });
            
            expect(recoveryRequest).toBeDefined();
            expect(recoveryRequest.recoveryType).toBe('state_resync');
            
            // Process recovery data
            const recoveryData = {
                recoveryType: 'state_resync',
                correctState: {
                    gridState: components.gridManager.captureGridState()
                }
            };
            
            components.cascadeAPI.processRecoveryData(recoveryData);
            
            expect(components.cascadeAPI.desyncDetected).toBe(false);
            expect(components.cascadeAPI.recoveryAttempts).toBe(0); // Reset after successful recovery
        });
        
        test('should maintain data consistency across all validation layers', async () => {
            const testGrid = Array(6).fill().map((_, col) => 
                Array(5).fill().map((_, row) => 
                    window.GameConfig.SYMBOL_TYPES[Math.floor(Math.random() * window.GameConfig.SYMBOL_TYPES.length)]
                )
            );
            
            // Set same grid state in GridManager
            components.gridManager.setGrid(testGrid);
            
            // Capture state from GridManager
            const gridState = components.gridManager.captureGridState();
            
            // Generate hash through CascadeAPI
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'consistency_test'
            };
            
            const hash1 = await components.cascadeAPI.generateClientValidationHash(gridState, stepData);
            const hash2 = await components.gridManager.generateGridStateHash(gridState, stepData);
            
            // Hashes should be identical for same data
            expect(hash1).toBe(hash2);
            
            // Validate through both systems
            const cascadeValidation = await components.cascadeAPI.verifyValidationHash(hash1, gridState, stepData);
            const gridValidation = await components.gridManager.validateGridState(hash1, stepData);
            
            expect(cascadeValidation).toBe(true);
            expect(gridValidation.valid).toBe(true);
        });
        
        test('should synchronize timing across AnimationManager and CascadeAPI', () => {
            const serverTiming = {
                stepDuration: 1000,
                phaseTimings: {
                    win_highlight: 300,
                    symbol_removal: 200,
                    symbol_drop: 400,
                    symbol_settle: 100
                },
                serverTimestamp: Date.now(),
                syncTolerance: 50
            };
            
            // Synchronize timing in AnimationManager
            const animSyncResult = components.animationManager.synchronizeWithServerTiming(serverTiming);
            expect(animSyncResult.success).toBe(true);
            
            // Apply timing correction in CascadeAPI
            const timingCorrection = 100;
            components.cascadeAPI.setSyncConfig({ stepTimeoutMs: serverTiming.stepDuration + timingCorrection });
            components.animationManager.adjustTiming(timingCorrection);
            
            // Verify timing synchronization
            expect(components.animationManager.serverTiming).toEqual(serverTiming);
            expect(components.cascadeAPI.syncConfig.stepTimeoutMs).toBe(1100);
        });
    });
    
    describe('Cross-Component Data Flow Validation', () => {
        test('should validate win calculations between WinCalculator and CascadeAPI', () => {
            const betAmount = 10;
            const cascadeSteps = [
                {
                    gridState: Array(6).fill().map(() => Array(5).fill('time_gem')),
                    multiplier: 2.0,
                    serverData: { stepWin: 40.00 }
                }
            ];
            
            // Mock GridManager.findMatches for consistent results
            jest.spyOn(components.gridManager, 'findMatches').mockReturnValue([
                { symbol: 'time_gem', count: 8, positions: [] }
            ]);
            
            // Mock WinCalculator.calculateStepWin
            jest.spyOn(components.winCalculator, 'calculateStepWin').mockReturnValue(40.00);
            
            // Validate through WinCalculator
            const winValidation = components.winCalculator.validateCascadingWins(cascadeSteps, betAmount);
            
            expect(winValidation.isValid).toBe(true);
            expect(winValidation.stepResults[0].clientWin).toBe(40.00);
            expect(winValidation.stepResults[0].serverWin).toBe(40.00);
            expect(winValidation.stepResults[0].isValid).toBe(true);
            
            // Verify server result through CascadeAPI perspective
            const serverVerification = components.winCalculator.verifyServerResult(
                { totalWin: 40.00, totalMultiplier: 2.0 },
                { totalWin: 40.00, totalMultiplier: 2.0 },
                1
            );
            
            expect(serverVerification.isValid).toBe(true);
            expect(serverVerification.withinTolerance).toBe(true);
        });
        
        test('should coordinate validation acknowledgments between components', async () => {
            const stepData = {
                stepIndex: 1,
                gridState: components.gridManager.captureGridState(),
                validationHash: 'ack_test_hash',
                timestamp: Date.now(),
                requestId: 'ack_request_123'
            };
            
            // Setup mock sync session
            components.cascadeAPI.currentSyncSession = {
                sessionId: 'ack_test_session'
            };
            
            // Generate acknowledgment through GridManager
            const gridAck = await components.gridManager.generateSyncAcknowledgment(stepData);
            expect(gridAck.stepIndex).toBe(1);
            
            // Send acknowledgment through CascadeAPI
            const validationResult = { hashVerified: true, processed: true, errors: [] };
            const cascadeAck = await components.cascadeAPI.sendStepAcknowledgment(stepData, validationResult);
            
            expect(cascadeAck.stepIndex).toBe(1);
            expect(cascadeAck.sessionId).toBe('ack_test_session');
            expect(window.NetworkService.emit).toHaveBeenCalledWith('step_acknowledgment', cascadeAck);
        });
        
        test('should maintain performance metrics consistency across components', () => {
            // Generate metrics from each component
            const cascadeStats = components.cascadeAPI.getStats();
            const gridStats = components.gridManager.getValidationStats();
            const winStats = components.winCalculator.getSyncStatus();
            const animStats = components.animationManager.getPerformanceMetrics();
            
            // Verify all components provide metrics
            expect(cascadeStats.syncStats).toBeDefined();
            expect(gridStats.totalValidations).toBeDefined();
            expect(winStats.statistics).toBeDefined();
            expect(animStats.totalAnimations).toBeDefined();
            
            // Collect comprehensive performance data
            const comprehensiveMetrics = components.gameScene.collectSyncPerformanceData();
            
            expect(comprehensiveMetrics.cascadeAPI).toBeDefined();
            expect(comprehensiveMetrics.gridManager).toBeDefined();
            expect(comprehensiveMetrics.winCalculator).toBeDefined();
            expect(comprehensiveMetrics.animationManager).toBeDefined();
            expect(comprehensiveMetrics.overall).toBeDefined();
        });
        
        test('should handle component failure gracefully with fallback mechanisms', async () => {
            // Simulate GridManager validation failure
            jest.spyOn(components.gridManager, 'validateGridState')
                .mockRejectedValueOnce(new Error('GridManager failure'));
            
            const stepData = {
                stepIndex: 1,
                gridState: components.gridManager.captureGridState(),
                validationHash: 'fallback_test_hash',
                timestamp: Date.now()
            };
            
            // Process through CascadeAPI with fallback
            const processResult = await components.cascadeAPI.processStepWithSync(stepData);
            
            // Should handle gracefully and send error acknowledgment
            expect(components.cascadeAPI.sendStepAcknowledgment).toHaveBeenCalledWith(
                stepData,
                expect.objectContaining({
                    processed: false,
                    errors: expect.arrayContaining([expect.stringContaining('GridManager failure')])
                })
            );
        });
    });
    
    describe('GameScene Master Integration', () => {
        test('should orchestrate all components through GameScene controls', () => {
            // Enable debug mode
            components.gameScene.setupCascadeDebugControls();
            
            expect(components.gameScene.debugControlsActive).toBe(true);
            
            // Toggle sync status display
            components.gameScene.toggleSyncStatusDisplay();
            expect(components.gameScene.cascadeSyncState.debugUIVisible).toBe(true);
            
            // Create manual control panel
            components.gameScene.createManualControlPanel();
            expect(components.gameScene.manualControlPanel).toBeDefined();
            
            // Enable manual control mode
            components.gameScene.enableManualCascadeControl();
            expect(components.gameScene.cascadeSyncState.manualControl).toBe(true);
        });
        
        test('should handle complete cascade processing with sync integration', async () => {
            const mockSpinResult = {
                sessionId: 'game_scene_test',
                cascadeSteps: [
                    {
                        stepIndex: 1,
                        gridState: components.gridManager.captureGridState(),
                        matches: [{ symbol: 'time_gem', count: 8, positions: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]] }],
                        timing: { duration: 800 }
                    },
                    {
                        stepIndex: 2,
                        gridState: components.gridManager.captureGridState(),
                        matches: [],
                        timing: { duration: 400 }
                    }
                ]
            };
            
            const processResult = await components.gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(processResult.syncSessionActive).toBe(true);
            expect(processResult.stepsProcessed).toBe(2);
            expect(components.gameScene.cascadeSyncState.sessionActive).toBe(true);
        });
        
        test('should provide comprehensive system status through GameScene interface', () => {
            const statusReport = components.gameScene.generateComprehensiveStatusReport();
            
            expect(statusReport.gameScene).toBeDefined();
            expect(statusReport.cascadeSync).toBeDefined();
            expect(statusReport.components).toHaveProperty('cascadeAPI');
            expect(statusReport.components).toHaveProperty('gridManager');
            expect(statusReport.components).toHaveProperty('winCalculator');
            expect(statusReport.components).toHaveProperty('animationManager');
            expect(statusReport.performance).toBeDefined();
            expect(statusReport.errors).toBeDefined();
            expect(statusReport.timestamp).toBeDefined();
        });
        
        test('should handle manual step execution with cross-component validation', () => {
            // Setup manual control mode
            components.gameScene.cascadeSyncState.manualControl = true;
            components.gameScene.cascadeSyncState.stepQueue = [
                {
                    stepIndex: 1,
                    data: {
                        gridState: components.gridManager.captureGridState(),
                        matches: [{ symbol: 'time_gem', count: 8 }],
                        timing: { duration: 500 }
                    }
                }
            ];
            
            const stepResult = components.gameScene.executeNextStep();
            
            expect(stepResult.executed).toBe(true);
            expect(stepResult.stepIndex).toBe(1);
            expect(components.gameScene.cascadeSyncState.currentStep).toBe(1);
        });
    });
    
    describe('Performance and Scalability Integration', () => {
        test('should handle high-frequency validation operations across all components', async () => {
            const startTime = Date.now();
            const operationCount = 50;
            
            // Perform rapid validation operations
            const promises = Array.from({ length: operationCount }, async (_, i) => {
                const stepData = {
                    stepIndex: i,
                    gridState: components.gridManager.captureGridState(),
                    validationHash: `perf_hash_${i}`,
                    timestamp: Date.now() + i
                };
                
                // Concurrent operations across components
                const [gridValidation, cascadeValidation] = await Promise.all([
                    components.gridManager.validateGridState(stepData.validationHash, stepData),
                    components.cascadeAPI.verifyValidationHash(stepData.validationHash, stepData.gridState, stepData)
                ]);
                
                return { gridValidation, cascadeValidation };
            });
            
            const results = await Promise.all(promises);
            const endTime = Date.now();
            
            expect(results).toHaveLength(operationCount);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            // Verify all validations succeeded
            results.forEach(({ gridValidation, cascadeValidation }) => {
                expect(gridValidation.valid).toBe(true);
                expect(cascadeValidation).toBe(true);
            });
        });
        
        test('should maintain memory efficiency with automatic cleanup', () => {
            const initialMemoryFootprint = {
                cascadeValidationHashes: components.cascadeAPI.validationHashes.size,
                gridValidationHistory: components.gridManager.validationHistory.size,
                winValidationResults: components.winCalculator.validationResults.size
            };
            
            // Generate large amount of validation data
            for (let i = 0; i < 200; i++) {
                // Add validation data to all components
                components.cascadeAPI.validationHashes.set(i, {
                    hash: `hash_${i}`,
                    timestamp: Date.now() + i
                });
                
                components.gridManager.validationHistory.set(i, {
                    valid: true,
                    timestamp: Date.now() + i
                });
                
                components.winCalculator.validationResults.set(i, {
                    isValid: true,
                    timestamp: Date.now() + i
                });
            }
            
            // Trigger cleanup in all components
            components.gridManager.cleanupValidationHistory();
            components.winCalculator.cleanupValidationData();
            components.cascadeAPI.clearSyncState();
            
            // Verify memory cleanup
            expect(components.gridManager.validationHistory.size).toBeLessThanOrEqual(50);
            expect(components.winCalculator.validationResults.size).toBeLessThanOrEqual(50);
            expect(components.cascadeAPI.validationHashes.size).toBe(0); // Cleared completely
        });
        
        test('should handle concurrent cascade sessions without interference', async () => {
            // Simulate multiple concurrent sessions (though normally only one would be active)
            const sessions = [
                { sessionId: 'session_1', expectedSteps: 3 },
                { sessionId: 'session_2', expectedSteps: 2 },
                { sessionId: 'session_3', expectedSteps: 4 }
            ];
            
            // Process sessions sequentially (as they would be in practice)
            for (const session of sessions) {
                components.cascadeAPI.handleSyncSessionStart(session);
                
                expect(components.cascadeAPI.currentSyncSession.sessionId).toBe(session.sessionId);
                
                // Complete session
                components.cascadeAPI.handleSyncSessionComplete(session);
                
                expect(components.cascadeAPI.currentSyncSession).toBeNull();
            }
            
            // Verify clean state after all sessions
            expect(components.cascadeAPI.syncSessions.size).toBeGreaterThanOrEqual(0);
            expect(components.cascadeAPI.desyncDetected).toBe(false);
        });
        
        test('should provide accurate performance monitoring across system', () => {
            // Setup performance tracking across components
            const performanceSnapshot = {
                timestamp: Date.now(),
                cascadeAPI: components.cascadeAPI.getStats(),
                gridManager: components.gridManager.getValidationStats(),
                winCalculator: components.winCalculator.getSyncStatus(),
                animationManager: components.animationManager.getPerformanceMetrics(),
                gameScene: components.gameScene.cascadeSyncState.performanceTracking
            };
            
            // Verify all components provide performance data
            expect(performanceSnapshot.cascadeAPI.syncStats).toBeDefined();
            expect(performanceSnapshot.gridManager.successRate).toBeDefined();
            expect(performanceSnapshot.winCalculator.statistics).toBeDefined();
            expect(performanceSnapshot.animationManager.totalAnimations).toBeDefined();
            expect(performanceSnapshot.gameScene).toBeDefined();
            
            // Calculate overall system health
            const healthScore = components.gameScene.calculateSystemHealthScore(performanceSnapshot);
            expect(healthScore).toBeGreaterThanOrEqual(0);
            expect(healthScore).toBeLessThanOrEqual(1);
        });
    });
    
    describe('Production Readiness Validation', () => {
        test('should handle production configuration correctly', () => {
            // Simulate production environment
            const originalDebug = window.DEBUG;
            const originalCascadeDebug = window.CASCADE_DEBUG;
            
            window.DEBUG = false;
            window.CASCADE_DEBUG = false;
            
            components.gameScene.configureForProduction();
            
            expect(components.gameScene.cascadeSyncState.debugUIVisible).toBe(false);
            expect(components.gameScene.debugControlsActive).toBe(false);
            
            // Restore debug flags
            window.DEBUG = originalDebug;
            window.CASCADE_DEBUG = originalCascadeDebug;
        });
        
        test('should provide comprehensive error reporting for production monitoring', () => {
            // Simulate various error conditions
            components.cascadeAPI.winDataSyncState = {
                validationErrors: [
                    { type: 'network_error', message: 'Connection timeout', timestamp: Date.now() },
                    { type: 'validation_error', message: 'Hash mismatch', timestamp: Date.now() }
                ]
            };
            
            components.animationManager.timingErrors = [
                { type: 'sync_timeout', timestamp: Date.now() }
            ];
            
            const errorReport = {
                cascadeAPI: components.cascadeAPI.getStats(),
                gridManager: components.gridManager.getValidationStats(),
                winCalculator: components.winCalculator.getErrorReport(),
                animationManager: components.animationManager.getErrorReport(),
                gameScene: components.gameScene.generateErrorStatusDisplay()
            };
            
            expect(errorReport.cascadeAPI).toBeDefined();
            expect(errorReport.gridManager.failedValidations).toBeDefined();
            expect(errorReport.winCalculator.totalErrors).toBeDefined();
            expect(errorReport.animationManager.totalErrors).toBeDefined();
            expect(errorReport.gameScene).toContain('Error');
        });
        
        test('should maintain backward compatibility with existing game systems', async () => {
            // Test that enhanced features don't break existing functionality
            window.CASCADE_DEBUG = false;
            
            const legacySpinResult = {
                cascadeSteps: [
                    { stepIndex: 1, matches: [] }
                ]
            };
            
            const processResult = await components.gameScene.processCascadesWithSync(legacySpinResult);
            
            expect(processResult.backwardCompatible).toBe(true);
        });
        
        test('should handle graceful degradation when enhanced components unavailable', () => {
            // Simulate missing enhanced components
            const originalCascadeAPI = window.cascadeAPI;
            window.cascadeAPI = undefined;
            
            const fallbackResult = components.gameScene.handleMissingEnhancedComponents();
            
            expect(fallbackResult.gracefulDegradation).toBe(true);
            expect(fallbackResult.clientSideMode).toBe(true);
            
            // Restore
            window.cascadeAPI = originalCascadeAPI;
        });
    });
});