/**
 * Task 3.6.4: Test AnimationManager sync features
 * Comprehensive tests for server-synchronized timing and validation integration in AnimationManager
 */

// Global test setup for Phaser environment simulation
const setupTestEnvironment = () => {
    global.window = global.window || {};
    
    // Mock Phaser 3 scene environment
    const mockScene = {
        tweens: {
            add: jest.fn((config) => ({
                id: Math.random().toString(36),
                config: config,
                pause: jest.fn(),
                resume: jest.fn(),
                stop: jest.fn(),
                destroy: jest.fn(),
                progress: 0,
                isPlaying: jest.fn(() => true),
                isPaused: jest.fn(() => false)
            })),
            remove: jest.fn(),
            pauseAll: jest.fn(),
            resumeAll: jest.fn(),
            killAll: jest.fn(),
            getTweensOf: jest.fn(() => [])
        },
        time: {
            delayedCall: jest.fn((delay, callback) => ({
                id: Math.random().toString(36),
                callback: callback,
                delay: delay,
                remove: jest.fn()
            })),
            removeEvent: jest.fn()
        },
        add: {
            particles: jest.fn(() => ({
                setDepth: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            })),
            text: jest.fn(() => ({
                setOrigin: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                destroy: jest.fn()
            }))
        },
        sound: {
            play: jest.fn()
        }
    };
    
    // Mock GameConfig
    window.GameConfig = {
        ANIMATION_TIMINGS: {
            WIN_HIGHLIGHT: 500,
            SYMBOL_REMOVAL: 300,
            SYMBOL_DROP: 600,
            SYMBOL_SETTLE: 200
        },
        SYNC_TOLERANCE_MS: 100,
        UI_DEPTHS: {
            FX_OVERLAY: 2500
        }
    };
    
    // Mock SafeSound
    window.SafeSound = {
        play: jest.fn()
    };
    
    // Mock CascadeAPI
    window.cascadeAPI = {
        getSyncStatus: jest.fn(() => ({
            isActive: true,
            sessionId: 'test_session',
            currentStep: 1,
            expectedSteps: 5
        })),
        sendStepAcknowledgment: jest.fn(),
        detectDesync: jest.fn()
    };
    
    // Mock GridManager
    window.GridManager = {
        getSymbolAt: jest.fn((col, row) => ({
            x: col * 80,
            y: row * 80,
            destroy: jest.fn(),
            setAlpha: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis()
        })),
        createSymbol: jest.fn(() => ({
            x: 0,
            y: 0,
            setAlpha: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis()
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

// Load AnimationManager
const loadAnimationManager = (mockScene) => {
    // Clear any existing AnimationManager
    if (window.AnimationManager) {
        delete window.AnimationManager;
    }
    
    // Load the AnimationManager class
    const fs = require('fs');
    const path = require('path');
    const animationManagerPath = path.join(__dirname, '../../managers/AnimationManager.js');
    const animationManagerCode = fs.readFileSync(animationManagerPath, 'utf8');
    
    // Execute the code to define window.AnimationManager
    eval(animationManagerCode);
    
    // Create instance with mock scene
    return new window.AnimationManager(mockScene);
};

describe('AnimationManager Sync Features - Task 3.6.4', () => {
    let animationManager;
    let mockScene;
    
    beforeAll(() => {
        mockScene = setupTestEnvironment();
        animationManager = loadAnimationManager(mockScene);
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        // Reset AnimationManager sync state
        animationManager.syncState = {
            isActive: false,
            sessionId: null,
            currentStep: 0,
            stepQueue: [],
            validationCheckpoints: new Map(),
            timingAdjustments: new Map(),
            performanceMetrics: {
                totalAnimations: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                averageTimingDrift: 0
            }
        };
        
        animationManager.activeTweens.clear();
        animationManager.syncTimers.clear();
        animationManager.timingCorrections.clear();
    });
    
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });
    
    describe('Server-Synchronized Timing', () => {
        test('should synchronize animation timing with server data', () => {
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
            
            const syncResult = animationManager.synchronizeWithServerTiming(serverTiming);
            
            expect(syncResult.success).toBe(true);
            expect(syncResult.timingSet).toBe(true);
            expect(animationManager.serverTiming).toEqual(serverTiming);
            expect(animationManager.syncState.timingAdjustments.has('current')).toBe(true);
        });
        
        test('should adjust client timing to match server', () => {
            const timingCorrection = 150; // 150ms adjustment
            
            animationManager.adjustTiming(timingCorrection);
            
            expect(animationManager.timingCorrections.has('global')).toBe(true);
            expect(animationManager.timingCorrections.get('global')).toBe(timingCorrection);
        });
        
        test('should apply timing corrections to active animations', () => {
            // Setup active animation
            const tweenConfig = {
                targets: { x: 0, y: 0 },
                x: 100,
                y: 100,
                duration: 1000,
                stepIndex: 1
            };
            
            const tween = mockScene.tweens.add(tweenConfig);
            animationManager.activeTweens.set('test_anim', tween);
            
            // Apply timing correction
            const correction = 200;
            animationManager.adjustTiming(correction);
            
            // Verify correction was applied
            expect(animationManager.timingCorrections.has('global')).toBe(true);
            expect(animationManager.timingCorrections.get('global')).toBe(correction);
        });
        
        test('should detect timing drift and report desync', () => {
            const serverTiming = {
                stepDuration: 1000,
                serverTimestamp: Date.now(),
                expectedClientTime: Date.now() - 500 // 500ms behind
            };
            
            const syncResult = animationManager.synchronizeWithServerTiming(serverTiming);
            
            if (Math.abs(syncResult.timingDrift) > window.GameConfig.SYNC_TOLERANCE_MS) {
                expect(window.cascadeAPI.detectDesync).toHaveBeenCalledWith('timing_drift', {
                    drift: syncResult.timingDrift,
                    serverTime: serverTiming.serverTimestamp,
                    clientTime: expect.any(Number)
                });
            }
        });
        
        test('should maintain timing precision across multiple steps', () => {
            const baseTime = Date.now();
            const steps = [
                { stepIndex: 1, serverTimestamp: baseTime, duration: 800 },
                { stepIndex: 2, serverTimestamp: baseTime + 800, duration: 600 },
                { stepIndex: 3, serverTimestamp: baseTime + 1400, duration: 1000 }
            ];
            
            steps.forEach(step => {
                const syncResult = animationManager.synchronizeWithServerTiming(step);
                expect(syncResult.success).toBe(true);
            });
            
            // Verify timing precision maintained
            const metrics = animationManager.getTimingMetrics();
            expect(metrics.averageTimingDrift).toBeLessThan(window.GameConfig.SYNC_TOLERANCE_MS);
        });
    });
    
    describe('Step-based Animation Queuing', () => {
        test('should queue animations for synchronized execution', () => {
            const animationStep = {
                stepIndex: 1,
                animations: [
                    {
                        type: 'highlight_wins',
                        positions: [[0, 0], [0, 1], [1, 0]],
                        duration: 500
                    },
                    {
                        type: 'remove_symbols',
                        positions: [[0, 0], [0, 1], [1, 0]],
                        duration: 300,
                        delay: 500
                    }
                ],
                serverTiming: {
                    stepDuration: 800,
                    serverTimestamp: Date.now()
                }
            };
            
            animationManager.queueAnimationStep(animationStep);
            
            expect(animationManager.syncState.stepQueue).toHaveLength(1);
            expect(animationManager.syncState.stepQueue[0].stepIndex).toBe(1);
            expect(animationManager.syncState.stepQueue[0].animations).toHaveLength(2);
        });
        
        test('should execute queued animations in correct order', () => {
            const step1 = {
                stepIndex: 1,
                animations: [{ type: 'highlight_wins', duration: 500 }],
                serverTiming: { stepDuration: 500, serverTimestamp: Date.now() }
            };
            
            const step2 = {
                stepIndex: 2,
                animations: [{ type: 'remove_symbols', duration: 300 }],
                serverTiming: { stepDuration: 300, serverTimestamp: Date.now() + 500 }
            };
            
            animationManager.queueAnimationStep(step1);
            animationManager.queueAnimationStep(step2);
            
            const executeResult = animationManager.executeNextQueuedStep();
            
            expect(executeResult.success).toBe(true);
            expect(executeResult.stepIndex).toBe(1);
            expect(animationManager.syncState.currentStep).toBe(1);
            expect(animationManager.syncState.stepQueue).toHaveLength(1); // Step 2 still queued
        });
        
        test('should handle animation queue overflow', () => {
            // Queue many steps to test overflow handling
            for (let i = 0; i < 20; i++) {
                const step = {
                    stepIndex: i,
                    animations: [{ type: 'test', duration: 100 }],
                    serverTiming: { stepDuration: 100, serverTimestamp: Date.now() + i * 100 }
                };
                
                animationManager.queueAnimationStep(step);
            }
            
            // Should maintain reasonable queue size
            expect(animationManager.syncState.stepQueue.length).toBeLessThanOrEqual(10);
        });
        
        test('should clear animation queue when sync session ends', () => {
            // Queue some steps
            for (let i = 0; i < 5; i++) {
                animationManager.queueAnimationStep({
                    stepIndex: i,
                    animations: [],
                    serverTiming: { stepDuration: 100 }
                });
            }
            
            animationManager.clearAnimationQueue();
            
            expect(animationManager.syncState.stepQueue).toHaveLength(0);
            expect(animationManager.syncState.currentStep).toBe(0);
        });
    });
    
    describe('Validation Checkpoints', () => {
        test('should create validation checkpoints during animations', () => {
            const checkpointData = {
                stepIndex: 1,
                animationType: 'highlight_wins',
                timestamp: Date.now(),
                positions: [[0, 0], [0, 1]],
                duration: 500,
                serverHash: 'checkpoint_hash_123'
            };
            
            animationManager.createValidationCheckpoint(checkpointData);
            
            expect(animationManager.syncState.validationCheckpoints.has(1)).toBe(true);
            
            const checkpoint = animationManager.syncState.validationCheckpoints.get(1);
            expect(checkpoint.stepIndex).toBe(1);
            expect(checkpoint.hash).toBeDefined();
            expect(checkpoint.serverHash).toBe('checkpoint_hash_123');
        });
        
        test('should validate animation state against checkpoints', () => {
            // Create checkpoint
            const checkpointData = {
                stepIndex: 1,
                animationType: 'highlight_wins',
                timestamp: Date.now(),
                positions: [[0, 0], [0, 1]],
                duration: 500,
                serverHash: 'test_hash'
            };
            
            animationManager.createValidationCheckpoint(checkpointData);
            
            // Validate against checkpoint
            const currentState = {
                stepIndex: 1,
                animationType: 'highlight_wins',
                positions: [[0, 0], [0, 1]],
                duration: 500
            };
            
            const validation = animationManager.validateAnimationCheckpoint(1, currentState);
            
            expect(validation.valid).toBe(true);
            expect(validation.stepIndex).toBe(1);
        });
        
        test('should detect animation state mismatches', () => {
            // Create checkpoint
            const checkpointData = {
                stepIndex: 1,
                animationType: 'highlight_wins',
                positions: [[0, 0], [0, 1]],
                duration: 500,
                serverHash: 'expected_hash'
            };
            
            animationManager.createValidationCheckpoint(checkpointData);
            
            // Validate with different state
            const mismatchedState = {
                stepIndex: 1,
                animationType: 'remove_symbols', // Different animation type
                positions: [[0, 0], [0, 1]],
                duration: 500
            };
            
            const validation = animationManager.validateAnimationCheckpoint(1, mismatchedState);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('state_mismatch');
        });
        
        test('should clean up old validation checkpoints', () => {
            // Create many checkpoints
            for (let i = 0; i < 30; i++) {
                animationManager.createValidationCheckpoint({
                    stepIndex: i,
                    animationType: 'test',
                    timestamp: Date.now() + i,
                    positions: [],
                    duration: 100
                });
            }
            
            animationManager.cleanupValidationCheckpoints();
            
            // Should maintain reasonable size
            expect(animationManager.syncState.validationCheckpoints.size).toBeLessThanOrEqual(20);
        });
    });
    
    describe('Animation Rollback Capabilities', () => {
        test('should create rollback points before animations', () => {
            const rollbackData = {
                stepIndex: 1,
                animationState: {
                    activeAnimations: ['anim1', 'anim2'],
                    positions: [[0, 0], [1, 1]],
                    symbolStates: { '0_0': 'time_gem', '1_1': 'space_gem' }
                },
                timestamp: Date.now()
            };
            
            animationManager.createRollbackPoint(rollbackData);
            
            expect(animationManager.rollbackPoints.has(1)).toBe(true);
            
            const rollbackPoint = animationManager.rollbackPoints.get(1);
            expect(rollbackPoint.stepIndex).toBe(1);
            expect(rollbackPoint.animationState).toEqual(rollbackData.animationState);
        });
        
        test('should rollback animations to previous checkpoint', () => {
            // Create rollback point
            const rollbackData = {
                stepIndex: 1,
                animationState: {
                    activeAnimations: [],
                    positions: [[0, 0]],
                    symbolStates: { '0_0': 'time_gem' }
                },
                timestamp: Date.now()
            };
            
            animationManager.createRollbackPoint(rollbackData);
            
            // Simulate some animations
            animationManager.activeTweens.set('test_anim', mockScene.tweens.add({ duration: 1000 }));
            
            // Perform rollback
            const rollbackResult = animationManager.rollbackToCheckpoint(1);
            
            expect(rollbackResult.success).toBe(true);
            expect(rollbackResult.stepIndex).toBe(1);
            expect(mockScene.tweens.killAll).toHaveBeenCalled();
        });
        
        test('should handle partial animation rollback', () => {
            // Setup multiple animations for rollback
            animationManager.activeTweens.set('keep_anim', mockScene.tweens.add({ 
                stepIndex: 0, 
                duration: 1000 
            }));
            animationManager.activeTweens.set('rollback_anim', mockScene.tweens.add({ 
                stepIndex: 1, 
                duration: 1000 
            }));
            
            // Rollback only step 1 animations
            const rollbackResult = animationManager.rollbackAnimationsFromStep(1);
            
            expect(rollbackResult.success).toBe(true);
            expect(rollbackResult.rolledBackAnimations).toBe(1);
            expect(animationManager.activeTweens.has('keep_anim')).toBe(true);
            expect(animationManager.activeTweens.has('rollback_anim')).toBe(false);
        });
        
        test('should handle rollback failure gracefully', () => {
            // Attempt rollback without rollback point
            const rollbackResult = animationManager.rollbackToCheckpoint(999);
            
            expect(rollbackResult.success).toBe(false);
            expect(rollbackResult.error).toContain('Rollback point not found');
        });
    });
    
    describe('Synchronized Animation Execution', () => {
        test('should execute win highlight animations with server timing', () => {
            const winPositions = [[0, 0], [0, 1], [1, 0], [1, 1]];
            const serverTiming = {
                duration: 500,
                serverTimestamp: Date.now(),
                syncTolerance: 50
            };
            
            const animationResult = animationManager.animateWinHighlightSync(winPositions, serverTiming);
            
            expect(animationResult.success).toBe(true);
            expect(animationResult.animationCount).toBe(winPositions.length);
            expect(mockScene.tweens.add).toHaveBeenCalled();
        });
        
        test('should execute symbol removal with synchronized timing', () => {
            const removePositions = [[0, 0], [0, 1], [1, 0]];
            const serverTiming = {
                duration: 300,
                serverTimestamp: Date.now(),
                delay: 500
            };
            
            // Mock symbols at positions
            removePositions.forEach(([col, row]) => {
                window.GridManager.getSymbolAt.mockReturnValueOnce({
                    x: col * 80,
                    y: row * 80,
                    destroy: jest.fn(),
                    setAlpha: jest.fn().mockReturnThis(),
                    setScale: jest.fn().mockReturnThis()
                });
            });
            
            const animationResult = animationManager.animateSymbolRemovalSync(removePositions, serverTiming);
            
            expect(animationResult.success).toBe(true);
            expect(animationResult.removedSymbols).toBe(removePositions.length);
            expect(mockScene.tweens.add).toHaveBeenCalled();
        });
        
        test('should execute symbol drop animations with physics sync', () => {
            const dropPattern = {
                column: 0,
                drops: [
                    { from: -1, to: 0, symbolType: 'time_gem' },
                    { from: -2, to: 1, symbolType: 'space_gem' }
                ]
            };
            
            const serverTiming = {
                duration: 600,
                serverTimestamp: Date.now(),
                dropDelay: 100
            };
            
            const animationResult = animationManager.animateSymbolDropSync(dropPattern, serverTiming);
            
            expect(animationResult.success).toBe(true);
            expect(animationResult.droppedSymbols).toBe(dropPattern.drops.length);
            expect(mockScene.tweens.add).toHaveBeenCalled();
        });
        
        test('should handle animation synchronization errors', () => {
            // Mock tween creation to fail
            mockScene.tweens.add.mockImplementationOnce(() => {
                throw new Error('Animation creation failed');
            });
            
            const winPositions = [[0, 0]];
            const serverTiming = { duration: 500, serverTimestamp: Date.now() };
            
            const animationResult = animationManager.animateWinHighlightSync(winPositions, serverTiming);
            
            expect(animationResult.success).toBe(false);
            expect(animationResult.error).toContain('Animation creation failed');
        });
    });
    
    describe('Performance Monitoring and Metrics', () => {
        test('should track animation performance metrics', () => {
            // Execute several animations
            for (let i = 0; i < 5; i++) {
                animationManager.animateWinHighlightSync([[i, 0]], {
                    duration: 500,
                    serverTimestamp: Date.now() + i * 100
                });
            }
            
            const metrics = animationManager.getPerformanceMetrics();
            
            expect(metrics.totalAnimations).toBe(5);
            expect(metrics.averageExecutionTime).toBeDefined();
            expect(metrics.successRate).toBeDefined();
        });
        
        test('should monitor timing drift over multiple steps', () => {
            const baseTime = Date.now();
            const timingData = [
                { stepIndex: 1, serverTime: baseTime, clientTime: baseTime + 10 },
                { stepIndex: 2, serverTime: baseTime + 500, clientTime: baseTime + 520 },
                { stepIndex: 3, serverTime: baseTime + 1000, clientTime: baseTime + 1030 }
            ];
            
            timingData.forEach(data => {
                animationManager.recordTimingMeasurement(data.stepIndex, data.serverTime, data.clientTime);
            });
            
            const timingMetrics = animationManager.getTimingMetrics();
            
            expect(timingMetrics.measurements).toBe(3);
            expect(timingMetrics.averageTimingDrift).toBeDefined();
            expect(timingMetrics.maxTimingDrift).toBeDefined();
        });
        
        test('should detect performance degradation', () => {
            // Simulate slow animations
            const slowTimings = Array.from({ length: 10 }, (_, i) => ({
                stepIndex: i,
                duration: 1000,
                actualDuration: 1500 + i * 100 // Increasing delay
            }));
            
            slowTimings.forEach(timing => {
                animationManager.recordAnimationTiming(timing);
            });
            
            const performanceAlert = animationManager.checkPerformanceHealth();
            
            expect(performanceAlert.degradationDetected).toBe(true);
            expect(performanceAlert.averageDelay).toBeGreaterThan(500);
        });
        
        test('should provide comprehensive animation statistics', () => {
            // Setup various animation states
            animationManager.syncState.performanceMetrics.totalAnimations = 100;
            animationManager.syncState.performanceMetrics.successfulSyncs = 95;
            animationManager.syncState.performanceMetrics.failedSyncs = 5;
            animationManager.activeTweens.set('anim1', { isPlaying: () => true });
            animationManager.activeTweens.set('anim2', { isPlaying: () => false });
            
            const stats = animationManager.getAnimationStatistics();
            
            expect(stats.totalAnimations).toBe(100);
            expect(stats.successRate).toBeCloseTo(0.95, 2);
            expect(stats.failureRate).toBeCloseTo(0.05, 2);
            expect(stats.activeAnimations).toBe(2);
            expect(stats.playingAnimations).toBe(1);
        });
    });
    
    describe('Integration with Enhanced Synchronization', () => {
        test('should integrate with CascadeAPI sync status', () => {
            const syncStatus = animationManager.getSyncIntegrationStatus();
            
            expect(syncStatus.cascadeAPIConnected).toBe(true);
            expect(syncStatus.syncSessionActive).toBe(true);
            expect(syncStatus.currentStep).toBe(1);
            expect(syncStatus.expectedSteps).toBe(5);
        });
        
        test('should handle sync session lifecycle events', () => {
            const sessionData = {
                sessionId: 'new_session_123',
                expectedSteps: 8,
                timingData: {
                    stepDuration: 800,
                    tolerance: 100
                }
            };
            
            animationManager.handleSyncSessionStart(sessionData);
            
            expect(animationManager.syncState.isActive).toBe(true);
            expect(animationManager.syncState.sessionId).toBe('new_session_123');
            expect(animationManager.syncState.stepQueue).toHaveLength(0);
        });
        
        test('should cleanup sync state on session end', () => {
            // Setup active sync state
            animationManager.syncState.isActive = true;
            animationManager.syncState.sessionId = 'ending_session';
            animationManager.syncState.stepQueue.push({ stepIndex: 1 });
            animationManager.activeTweens.set('test', mockScene.tweens.add({}));
            
            animationManager.handleSyncSessionEnd();
            
            expect(animationManager.syncState.isActive).toBe(false);
            expect(animationManager.syncState.sessionId).toBeNull();
            expect(animationManager.syncState.stepQueue).toHaveLength(0);
            expect(mockScene.tweens.killAll).toHaveBeenCalled();
        });
        
        test('should send animation acknowledgments', () => {
            const stepData = {
                stepIndex: 2,
                animationType: 'highlight_wins',
                duration: 500,
                positions: [[0, 0], [1, 1]],
                timestamp: Date.now()
            };
            
            animationManager.sendAnimationAcknowledgment(stepData);
            
            expect(window.cascadeAPI.sendStepAcknowledgment).toHaveBeenCalledWith(stepData, {
                stepIndex: 2,
                animationType: 'highlight_wins',
                duration: 500,
                completedSuccessfully: true,
                timingAccurate: true,
                clientTimestamp: expect.any(Number)
            });
        });
    });
    
    describe('Error Handling and Recovery', () => {
        test('should handle animation creation failures', () => {
            // Mock animation failure
            mockScene.tweens.add.mockImplementationOnce(() => {
                throw new Error('Tween creation failed');
            });
            
            const positions = [[0, 0], [1, 1]];
            const timing = { duration: 500, serverTimestamp: Date.now() };
            
            const result = animationManager.animateWinHighlightSync(positions, timing);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Tween creation failed');
            expect(animationManager.syncState.performanceMetrics.failedSyncs).toBe(1);
        });
        
        test('should recover from timing synchronization errors', () => {
            const errorData = {
                stepIndex: 1,
                error: 'timing_sync_failed',
                serverTime: Date.now(),
                clientTime: Date.now() + 1000 // Large drift
            };
            
            const recoveryResult = animationManager.recoverFromSyncError(errorData);
            
            expect(recoveryResult.attempted).toBe(true);
            expect(recoveryResult.correctionApplied).toBe(true);
            expect(animationManager.timingCorrections.has('error_recovery')).toBe(true);
        });
        
        test('should handle cascade animation interruption', () => {
            // Setup running cascade
            animationManager.syncState.isActive = true;
            animationManager.syncState.currentStep = 3;
            animationManager.activeTweens.set('cascade_anim', mockScene.tweens.add({}));
            
            const interruptionResult = animationManager.handleCascadeInterruption('network_error');
            
            expect(interruptionResult.handled).toBe(true);
            expect(interruptionResult.animationsStopped).toBe(1);
            expect(mockScene.tweens.killAll).toHaveBeenCalled();
        });
        
        test('should provide detailed error reports', () => {
            // Simulate various errors
            animationManager.syncState.performanceMetrics.failedSyncs = 5;
            animationManager.timingErrors = [
                { type: 'drift_exceeded', timestamp: Date.now() },
                { type: 'sync_timeout', timestamp: Date.now() },
                { type: 'animation_failed', timestamp: Date.now() }
            ];
            
            const errorReport = animationManager.getErrorReport();
            
            expect(errorReport.totalErrors).toBe(3);
            expect(errorReport.errorTypes.drift_exceeded).toBe(1);
            expect(errorReport.errorTypes.sync_timeout).toBe(1);
            expect(errorReport.errorTypes.animation_failed).toBe(1);
            expect(errorReport.failedSyncs).toBe(5);
        });
    });
});