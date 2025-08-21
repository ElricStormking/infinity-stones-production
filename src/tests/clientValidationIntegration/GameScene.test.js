/**
 * Task 3.6.5: Test GameScene integration
 * Comprehensive tests for GameScene integration with Enhanced Cascade Synchronization system
 */

// Global test setup for Phaser environment simulation
const setupTestEnvironment = () => {
    global.window = global.window || {};
    
    // Mock Phaser 3 scene environment
    const mockScene = {
        input: {
            keyboard: {
                on: jest.fn(),
                off: jest.fn(),
                addKey: jest.fn(() => ({
                    on: jest.fn(),
                    off: jest.fn(),
                    isDown: false
                }))
            }
        },
        events: {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn()
        },
        add: {
            text: jest.fn(() => ({
                setOrigin: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
                x: 0,
                y: 0,
                visible: true
            })),
            rectangle: jest.fn(() => ({
                setOrigin: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            })),
            container: jest.fn(() => ({
                add: jest.fn(),
                setVisible: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            }))
        },
        cameras: {
            main: {
                width: 1920,
                height: 1080
            }
        },
        time: {
            delayedCall: jest.fn()
        },
        tweens: {
            add: jest.fn()
        }
    };
    
    // Mock GameConfig
    window.GameConfig = {
        DEBUG_MODE: true,
        CASCADE_DEBUG: true,
        GRID_WIDTH: 6,
        GRID_HEIGHT: 5
    };
    
    // Mock DEBUG flags
    window.DEBUG = true;
    window.CASCADE_DEBUG = true;
    
    // Mock CascadeAPI
    window.cascadeAPI = {
        getSyncStatus: jest.fn(() => ({
            isActive: true,
            sessionId: 'test_session_123',
            currentStep: 2,
            expectedSteps: 5,
            desyncDetected: false,
            recoveryAttempts: 0,
            lastValidationSuccess: true
        })),
        clearSyncState: jest.fn(),
        initiateRecovery: jest.fn(),
        processStepWithSync: jest.fn(),
        getStats: jest.fn(() => ({
            syncStats: {
                activeSyncSessions: 1,
                validationHashes: 3,
                pendingAcknowledgments: 1
            }
        }))
    };
    
    // Mock GridManager
    window.GridManager = {
        validateGridState: jest.fn(async () => ({ valid: true, reason: 'structure_valid' })),
        getCurrentGrid: jest.fn(() => Array(6).fill().map(() => Array(5).fill('time_gem'))),
        getValidationStats: jest.fn(() => ({
            totalValidations: 10,
            successfulValidations: 9,
            failedValidations: 1,
            successRate: 0.9
        }))
    };
    
    // Mock WinCalculator
    window.WinCalculator = {
        getSyncStatus: jest.fn(() => ({
            isActive: true,
            pendingValidations: 2,
            statistics: {
                totalValidations: 15,
                successfulValidations: 14,
                failedValidations: 1
            }
        })),
        validateCascadingWins: jest.fn(() => ({
            isValid: true,
            totalSteps: 3,
            cumulativeWin: 150
        }))
    };
    
    // Mock AnimationManager
    window.AnimationManager = {
        getSyncIntegrationStatus: jest.fn(() => ({
            cascadeAPIConnected: true,
            syncSessionActive: true,
            activeAnimations: 2,
            performanceHealth: 'good'
        })),
        getPerformanceMetrics: jest.fn(() => ({
            totalAnimations: 25,
            successfulSyncs: 23,
            failedSyncs: 2,
            averageTimingDrift: 45
        }))
    };
    
    // Mock console methods
    global.console = {
        ...console,
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
    
    return mockScene;
};

// Load GameScene
const loadGameScene = (mockScene) => {
    // Clear any existing GameScene
    if (window.GameScene) {
        delete window.GameScene;
    }
    
    // Load the GameScene class
    const fs = require('fs');
    const path = require('path');
    const gameScenePath = path.join(__dirname, '../../scenes/GameScene.js');
    const gameSceneCode = fs.readFileSync(gameScenePath, 'utf8');
    
    // Execute the code to define window.GameScene
    eval(gameSceneCode);
    
    // Create instance with mock scene
    const gameScene = Object.create(window.GameScene.prototype);
    Object.assign(gameScene, mockScene);
    
    // Initialize cascade sync components
    gameScene.initCascadeSyncComponents();
    
    return gameScene;
};

describe('GameScene Integration - Task 3.6.5', () => {
    let gameScene;
    let mockScene;
    
    beforeAll(() => {
        mockScene = setupTestEnvironment();
        gameScene = loadGameScene(mockScene);
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset GameScene cascade sync state
        gameScene.cascadeSyncState = {
            isEnabled: true,
            sessionActive: false,
            currentStep: 0,
            stepQueue: [],
            manualControl: false,
            debugUIVisible: false,
            performanceTracking: {
                stepValidationTime: [],
                syncSuccessRate: 1.0,
                averageStepTime: 0
            }
        };
        
        // Reset debug UI elements
        gameScene.syncStatusDisplay = null;
        gameScene.manualControlPanel = null;
        gameScene.debugControlsActive = false;
    });
    
    describe('Cascade Synchronization Integration', () => {
        test('should initialize cascade sync components', () => {
            gameScene.initCascadeSyncComponents();
            
            expect(gameScene.cascadeSyncState).toBeDefined();
            expect(gameScene.cascadeSyncState.isEnabled).toBe(true);
            expect(gameScene.cascadeSyncKeyboardControls).toBeDefined();
        });
        
        test('should handle cascade step events from CascadeAPI', () => {
            const stepData = {
                stepIndex: 1,
                gridState: window.GridManager.getCurrentGrid(),
                validationHash: 'test_hash_123',
                timing: { duration: 800 },
                matches: [{ symbol: 'time_gem', count: 8 }]
            };
            
            const handleStepSpy = jest.spyOn(gameScene, 'handleCascadeStepSync');
            
            gameScene.events.emit('cascade_step', stepData);
            
            expect(handleStepSpy).toHaveBeenCalledWith(stepData);
        });
        
        test('should process cascade steps with sync validation', async () => {
            const stepData = {
                stepIndex: 2,
                gridState: window.GridManager.getCurrentGrid(),
                validationHash: 'step2_hash',
                timing: { duration: 600 },
                matches: []
            };
            
            const result = await gameScene.handleCascadeStepSync(stepData);
            
            expect(result.processed).toBe(true);
            expect(result.validated).toBe(true);
            expect(window.cascadeAPI.processStepWithSync).toHaveBeenCalledWith(stepData);
        });
        
        test('should integrate with manual cascade control', () => {
            // Enable manual control mode
            gameScene.cascadeSyncState.manualControl = true;
            gameScene.cascadeSyncState.stepQueue = [
                { stepIndex: 1, data: { test: 'step1' } },
                { stepIndex: 2, data: { test: 'step2' } }
            ];
            
            const nextStep = gameScene.processNextManualStep();
            
            expect(nextStep.processed).toBe(true);
            expect(nextStep.stepIndex).toBe(1);
            expect(gameScene.cascadeSyncState.currentStep).toBe(1);
            expect(gameScene.cascadeSyncState.stepQueue).toHaveLength(1);
        });
        
        test('should handle sync session lifecycle', () => {
            const sessionData = {
                sessionId: 'game_session_456',
                expectedSteps: 4,
                initialState: { grid: 'initial_grid' }
            };
            
            gameScene.handleSyncSessionStart(sessionData);
            
            expect(gameScene.cascadeSyncState.sessionActive).toBe(true);
            expect(gameScene.cascadeSyncState.currentStep).toBe(0);
            expect(gameScene.cascadeSyncState.stepQueue).toHaveLength(0);
        });
        
        test('should cleanup sync state on session end', () => {
            // Setup active session state
            gameScene.cascadeSyncState.sessionActive = true;
            gameScene.cascadeSyncState.currentStep = 3;
            gameScene.cascadeSyncState.stepQueue = [{ stepIndex: 4 }];
            
            gameScene.handleSyncSessionEnd();
            
            expect(gameScene.cascadeSyncState.sessionActive).toBe(false);
            expect(gameScene.cascadeSyncState.currentStep).toBe(0);
            expect(gameScene.cascadeSyncState.stepQueue).toHaveLength(0);
        });
    });
    
    describe('Development Mode Debug Controls', () => {
        test('should setup debug keyboard controls when enabled', () => {
            window.DEBUG = true;
            window.CASCADE_DEBUG = true;
            
            gameScene.setupCascadeDebugControls();
            
            expect(gameScene.debugControlsActive).toBe(true);
            expect(gameScene.cascadeSyncKeyboardControls).toBeDefined();
            expect(mockScene.input.keyboard.on).toHaveBeenCalled();
        });
        
        test('should handle F1-F8 debug keyboard shortcuts', () => {
            gameScene.setupCascadeDebugControls();
            
            // Simulate F1 key press (Toggle Sync Status Display)
            const f1Handler = jest.fn();
            gameScene.cascadeSyncKeyboardControls.F1 = f1Handler;
            
            gameScene.handleDebugKeyPress('F1');
            
            expect(f1Handler).toHaveBeenCalled();
        });
        
        test('should toggle sync status display', () => {
            gameScene.toggleSyncStatusDisplay();
            
            expect(gameScene.cascadeSyncState.debugUIVisible).toBe(true);
            expect(mockScene.add.text).toHaveBeenCalled(); // Status display created
            
            // Toggle again to hide
            gameScene.toggleSyncStatusDisplay();
            
            expect(gameScene.cascadeSyncState.debugUIVisible).toBe(false);
        });
        
        test('should create comprehensive sync status display', () => {
            gameScene.createSyncStatusDisplay();
            
            expect(mockScene.add.text).toHaveBeenCalledWith(
                20, // x position
                expect.any(Number), // y position
                expect.stringContaining('Cascade Sync Status'), // content
                expect.any(Object) // style
            );
        });
        
        test('should update sync status display with real-time data', () => {
            gameScene.createSyncStatusDisplay();
            gameScene.syncStatusDisplay = mockScene.add.text();
            
            gameScene.updateSyncStatusDisplay();
            
            expect(window.cascadeAPI.getSyncStatus).toHaveBeenCalled();
            expect(window.GridManager.getValidationStats).toHaveBeenCalled();
            expect(window.WinCalculator.getSyncStatus).toHaveBeenCalled();
        });
        
        test('should create manual control panel interface', () => {
            gameScene.createManualControlPanel();
            
            expect(mockScene.add.container).toHaveBeenCalled();
            expect(gameScene.manualControlPanel).toBeDefined();
        });
        
        test('should handle manual step progression controls', () => {
            gameScene.cascadeSyncState.manualControl = true;
            gameScene.cascadeSyncState.stepQueue = [
                { stepIndex: 1, data: {} },
                { stepIndex: 2, data: {} }
            ];
            
            const result = gameScene.executeManualStepProgression();
            
            expect(result.success).toBe(true);
            expect(result.stepExecuted).toBe(1);
        });
    });
    
    describe('Diagnostic Information Display', () => {
        test('should display comprehensive sync performance metrics', () => {
            const performanceData = gameScene.collectSyncPerformanceData();
            
            expect(performanceData.cascadeAPI).toBeDefined();
            expect(performanceData.gridManager).toBeDefined();
            expect(performanceData.winCalculator).toBeDefined();
            expect(performanceData.animationManager).toBeDefined();
            expect(performanceData.overall).toBeDefined();
        });
        
        test('should generate health status indicators', () => {
            const healthStatus = gameScene.generateSyncHealthStatus();
            
            expect(healthStatus.overall).toBeDefined();
            expect(healthStatus.components).toHaveProperty('cascadeAPI');
            expect(healthStatus.components).toHaveProperty('gridManager');
            expect(healthStatus.components).toHaveProperty('winCalculator');
            expect(healthStatus.components).toHaveProperty('animationManager');
        });
        
        test('should provide color-coded health visualization', () => {
            const healthColors = gameScene.getSyncHealthColors();
            
            expect(healthColors.good).toBe('#00FF00');
            expect(healthColors.warning).toBe('#FFFF00');
            expect(healthColors.error).toBe('#FF0000');
        });
        
        test('should track performance metrics over time', () => {
            // Simulate multiple step validations
            const stepTimes = [100, 150, 120, 180, 95];
            stepTimes.forEach(time => {
                gameScene.cascadeSyncState.performanceTracking.stepValidationTime.push(time);
            });
            
            const metrics = gameScene.calculatePerformanceMetrics();
            
            expect(metrics.averageStepTime).toBeCloseTo(129, 0);
            expect(metrics.minStepTime).toBe(95);
            expect(metrics.maxStepTime).toBe(180);
            expect(metrics.totalValidations).toBe(5);
        });
        
        test('should display error tracking and recovery status', () => {
            gameScene.cascadeSyncState.errorTracking = {
                totalErrors: 3,
                recoveryAttempts: 2,
                lastError: { type: 'timing_drift', timestamp: Date.now() }
            };
            
            const errorDisplay = gameScene.generateErrorStatusDisplay();
            
            expect(errorDisplay).toContain('Total Errors: 3');
            expect(errorDisplay).toContain('Recovery Attempts: 2');
            expect(errorDisplay).toContain('timing_drift');
        });
    });
    
    describe('Manual Override Capabilities', () => {
        test('should enable manual cascade control mode', () => {
            gameScene.enableManualCascadeControl();
            
            expect(gameScene.cascadeSyncState.manualControl).toBe(true);
            expect(gameScene.manualControlPanel).toBeDefined();
        });
        
        test('should disable manual control and return to automatic', () => {
            gameScene.cascadeSyncState.manualControl = true;
            
            gameScene.disableManualCascadeControl();
            
            expect(gameScene.cascadeSyncState.manualControl).toBe(false);
        });
        
        test('should pause cascade execution', () => {
            const pauseResult = gameScene.pauseCascadeExecution();
            
            expect(pauseResult.paused).toBe(true);
            expect(gameScene.cascadeSyncState.isPaused).toBe(true);
        });
        
        test('should resume cascade execution', () => {
            gameScene.cascadeSyncState.isPaused = true;
            
            const resumeResult = gameScene.resumeCascadeExecution();
            
            expect(resumeResult.resumed).toBe(true);
            expect(gameScene.cascadeSyncState.isPaused).toBe(false);
        });
        
        test('should handle step-by-step execution', () => {
            gameScene.cascadeSyncState.manualControl = true;
            gameScene.cascadeSyncState.stepQueue = [
                { stepIndex: 1, data: { test: 'data1' } },
                { stepIndex: 2, data: { test: 'data2' } }
            ];
            
            const stepResult = gameScene.executeNextStep();
            
            expect(stepResult.executed).toBe(true);
            expect(stepResult.stepIndex).toBe(1);
            expect(gameScene.cascadeSyncState.stepQueue).toHaveLength(1);
        });
        
        test('should initiate manual recovery procedures', () => {
            const recoveryData = {
                type: 'grid_state_mismatch',
                stepIndex: 3,
                details: { expectedHash: 'abc123', actualHash: 'def456' }
            };
            
            const recoveryResult = gameScene.initiateManualRecovery(recoveryData);
            
            expect(recoveryResult.initiated).toBe(true);
            expect(window.cascadeAPI.initiateRecovery).toHaveBeenCalledWith(recoveryData);
        });
    });
    
    describe('Enhanced Cascade Processing Integration', () => {
        test('should modify processCascades with sync session management', async () => {
            const mockSpinResult = {
                cascadeSteps: [
                    { stepIndex: 1, matches: [] },
                    { stepIndex: 2, matches: [] }
                ]
            };
            
            const processResult = await gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(processResult.syncSessionActive).toBe(true);
            expect(processResult.stepsProcessed).toBe(2);
        });
        
        test('should handle sync session lifecycle during cascades', async () => {
            const mockSpinResult = {
                sessionId: 'cascade_session_789',
                cascadeSteps: [{ stepIndex: 1, matches: [] }]
            };
            
            gameScene.cascadeSyncState.sessionActive = false;
            
            await gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(gameScene.cascadeSyncState.sessionActive).toBe(true);
        });
        
        test('should inject manual control points during cascade execution', async () => {
            gameScene.cascadeSyncState.manualControl = true;
            
            const mockSpinResult = {
                cascadeSteps: [
                    { stepIndex: 1, matches: [] },
                    { stepIndex: 2, matches: [] }
                ]
            };
            
            const processResult = await gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(processResult.manualControlInjected).toBe(true);
            expect(gameScene.cascadeSyncState.stepQueue).toHaveLength(2);
        });
        
        test('should handle graceful fallback to client-side operation', async () => {
            // Mock CascadeAPI unavailable
            window.cascadeAPI = null;
            
            const mockSpinResult = {
                cascadeSteps: [{ stepIndex: 1, matches: [] }]
            };
            
            const processResult = await gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(processResult.fallbackMode).toBe(true);
            expect(processResult.clientSideProcessing).toBe(true);
        });
        
        test('should provide comprehensive error handling during cascade processing', async () => {
            // Mock processing error
            window.cascadeAPI.processStepWithSync.mockRejectedValueOnce(new Error('Processing failed'));
            
            const mockSpinResult = {
                cascadeSteps: [{ stepIndex: 1, matches: [] }]
            };
            
            const processResult = await gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(processResult.success).toBe(false);
            expect(processResult.error).toContain('Processing failed');
        });
    });
    
    describe('Memory Management and Cleanup', () => {
        test('should cleanup cascade sync components on destroy', () => {
            // Setup sync state
            gameScene.cascadeSyncState.sessionActive = true;
            gameScene.syncStatusDisplay = mockScene.add.text();
            gameScene.manualControlPanel = mockScene.add.container();
            gameScene.debugControlsActive = true;
            
            gameScene.cleanupCascadeSyncComponents();
            
            expect(gameScene.cascadeSyncState.sessionActive).toBe(false);
            expect(mockScene.input.keyboard.off).toHaveBeenCalled();
        });
        
        test('should clear debug UI elements', () => {
            gameScene.syncStatusDisplay = { destroy: jest.fn() };
            gameScene.manualControlPanel = { destroy: jest.fn() };
            
            gameScene.clearDebugUI();
            
            expect(gameScene.syncStatusDisplay.destroy).toHaveBeenCalled();
            expect(gameScene.manualControlPanel.destroy).toHaveBeenCalled();
            expect(gameScene.syncStatusDisplay).toBeNull();
            expect(gameScene.manualControlPanel).toBeNull();
        });
        
        test('should manage memory usage of performance tracking data', () => {
            // Fill performance tracking with data
            for (let i = 0; i < 150; i++) {
                gameScene.cascadeSyncState.performanceTracking.stepValidationTime.push(i);
            }
            
            gameScene.cleanupPerformanceData();
            
            // Should maintain reasonable size
            expect(gameScene.cascadeSyncState.performanceTracking.stepValidationTime.length).toBeLessThanOrEqual(100);
        });
        
        test('should reset cascade sync state completely', () => {
            // Setup complex state
            gameScene.cascadeSyncState.sessionActive = true;
            gameScene.cascadeSyncState.currentStep = 5;
            gameScene.cascadeSyncState.stepQueue = [{ step: 1 }, { step: 2 }];
            gameScene.cascadeSyncState.manualControl = true;
            
            gameScene.resetCascadeSyncState();
            
            expect(gameScene.cascadeSyncState.sessionActive).toBe(false);
            expect(gameScene.cascadeSyncState.currentStep).toBe(0);
            expect(gameScene.cascadeSyncState.stepQueue).toHaveLength(0);
            expect(gameScene.cascadeSyncState.manualControl).toBe(false);
        });
    });
    
    describe('Integration Testing and Compatibility', () => {
        test('should maintain backward compatibility with existing game flow', async () => {
            // Test that enhanced features don't break existing functionality
            window.CASCADE_DEBUG = false;
            window.DEBUG = false;
            
            const mockSpinResult = {
                cascadeSteps: [{ stepIndex: 1, matches: [] }]
            };
            
            const processResult = await gameScene.processCascadesWithSync(mockSpinResult);
            
            expect(processResult.backwardCompatible).toBe(true);
        });
        
        test('should integrate seamlessly with existing managers', () => {
            const integrationStatus = gameScene.checkManagerIntegration();
            
            expect(integrationStatus.gridManager).toBe(true);
            expect(integrationStatus.winCalculator).toBe(true);
            expect(integrationStatus.animationManager).toBe(true);
            expect(integrationStatus.cascadeAPI).toBe(true);
        });
        
        test('should handle missing or undefined enhanced components gracefully', () => {
            // Simulate missing components
            const originalCascadeAPI = window.cascadeAPI;
            window.cascadeAPI = undefined;
            
            const fallbackResult = gameScene.handleMissingEnhancedComponents();
            
            expect(fallbackResult.gracefulDegradation).toBe(true);
            expect(fallbackResult.clientSideMode).toBe(true);
            
            // Restore
            window.cascadeAPI = originalCascadeAPI;
        });
        
        test('should provide comprehensive status reporting for debugging', () => {
            const statusReport = gameScene.generateComprehensiveStatusReport();
            
            expect(statusReport.gameScene).toBeDefined();
            expect(statusReport.cascadeSync).toBeDefined();
            expect(statusReport.components).toBeDefined();
            expect(statusReport.performance).toBeDefined();
            expect(statusReport.errors).toBeDefined();
            expect(statusReport.timestamp).toBeDefined();
        });
        
        test('should handle production deployment configurations', () => {
            // Simulate production environment
            window.DEBUG = false;
            window.CASCADE_DEBUG = false;
            
            gameScene.configureForProduction();
            
            expect(gameScene.cascadeSyncState.debugUIVisible).toBe(false);
            expect(gameScene.debugControlsActive).toBe(false);
        });
    });
});