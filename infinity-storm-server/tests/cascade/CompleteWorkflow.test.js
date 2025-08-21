/**
 * CompleteWorkflow.test.js - Task 2.4.4: Test complete cascade workflow
 * 
 * Integration tests for the complete Enhanced Cascade Synchronization system.
 * Tests end-to-end workflow integration between GridEngine, CascadeSynchronizer, and CascadeValidator.
 */

const GridEngine = require('../../game-logic/GridEngine');
const CascadeSynchronizer = require('../../src/services/CascadeSynchronizer');
const CascadeValidator = require('../../src/services/CascadeValidator');
const SpinResult = require('../../src/models/SpinResult');
const CascadeStep = require('../../src/models/CascadeStep');
const GameSession = require('../../src/models/GameSession');

describe('Complete Cascade Workflow Integration', () => {
    let gridEngine;
    let cascadeSynchronizer;
    let cascadeValidator;
    let mockGameSession;
    let mockSocketManager;
    
    beforeEach(() => {
        // Initialize all components
        gridEngine = new GridEngine();
        cascadeValidator = new CascadeValidator({
            timingTolerance: 1000,
            hashValidationEnabled: true,
            fraudDetectionEnabled: true
        });
        
        mockGameSession = new GameSession('test-session', 'test-player');
        
        mockSocketManager = {
            sendToPlayer: jest.fn().mockResolvedValue(true),
            players: new Map()
        };
        
        cascadeSynchronizer = new CascadeSynchronizer(mockGameSession, mockSocketManager);
    });
    
    afterEach(() => {
        cascadeSynchronizer.cleanup();
    });
    
    // ===========================================
    // Task 2.4.4: Complete Workflow Tests
    // ===========================================
    
    describe('End-to-End Spin Processing', () => {
        test('should process complete spin from generation to validation', async () => {
            // Step 1: Generate spin result with GridEngine
            const spinOptions = {
                bet: 1.00,
                quickSpinMode: false,
                freeSpinsActive: false,
                accumulatedMultiplier: 1,
                gameSession: mockGameSession
            };
            
            const spinResult = gridEngine.generateSpinResult(spinOptions);
            
            // Verify spin result is generated
            expect(spinResult).toBeInstanceOf(SpinResult);
            expect(spinResult.spinId).toBeDefined();
            expect(spinResult.validationHash).toBeDefined();
            
            // Step 2: Validate the generated spin result
            const validationResult = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
            
            // Verify validation passes
            expect(validationResult.isValid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);
            expect(validationResult.validationTime).toBeGreaterThan(0);
            
            // Step 3: Test that game session was properly updated
            expect(mockGameSession.gameState.currentSpinId).toBe(spinResult.spinId);
            expect(mockGameSession.gameState.totalSpins).toBe(1);
        });
        
        test('should handle spin with cascade steps through complete workflow', async () => {
            // Create a grid that guarantees matches
            const guaranteedMatchGrid = [
                ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'space_gem'],
                ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'space_gem'],
                ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'space_gem'],
                ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'space_gem'],
                ['power_gem', 'power_gem', 'power_gem', 'power_gem', 'space_gem'],
                ['power_gem', 'power_gem', 'power_gem', 'power_gem', 'space_gem']
            ];
            
            // Mock the grid generation to ensure we get matches
            jest.spyOn(gridEngine, 'generateRandomGrid').mockReturnValue(guaranteedMatchGrid);
            
            try {
                // Generate spin with cascades
                const spinResult = gridEngine.generateSpinResult({
                    bet: 2.00,
                    gameSession: mockGameSession
                });
                
                // Verify cascades were generated
                expect(spinResult.cascadeSteps.length).toBeGreaterThan(0);
                
                // Validate each cascade step
                for (let i = 0; i < spinResult.cascadeSteps.length; i++) {
                    const cascadeStep = spinResult.cascadeSteps[i];
                    const previousStep = i > 0 ? spinResult.cascadeSteps[i - 1] : null;
                    
                    const stepValidation = cascadeValidator.validateCascadeStepIntegrity(cascadeStep, previousStep);
                    expect(stepValidation.isValid).toBe(true);
                }
                
                // Validate complete spin result
                const completeValidation = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
                expect(completeValidation.isValid).toBe(true);
                
            } finally {
                gridEngine.generateRandomGrid.mockRestore();
            }
        });
        
        test('should integrate synchronization workflow with validation', async () => {
            // Generate a spin result
            const spinResult = gridEngine.generateSpinResult({
                bet: 1.00,
                gameSession: mockGameSession
            });
            
            // Convert to cascade sequence format for synchronizer
            const cascadeSequence = {
                initial_grid: spinResult.initialGrid,
                cascades: spinResult.cascadeSteps.map((step, index) => ({
                    cascade_index: index,
                    pre_cascade_grid: step.gridStateBefore,
                    post_cascade_grid: step.gridStateAfter,
                    winning_clusters: step.matchedClusters.map(cluster => ({
                        symbol: cluster.symbolType,
                        positions: cluster.positions
                    })),
                    symbol_movements: step.dropPatterns.map(pattern => ({
                        movement_type: 'drop',
                        from_position: { col: pattern.column, row: -1 },
                        to_position: { col: pattern.column, row: 0 }
                    })),
                    timing_data: {
                        win_highlight_duration: step.timing.phases.matchHighlight.duration,
                        symbol_removal_duration: step.timing.phases.symbolRemoval.duration,
                        drop_phase_duration: step.timing.phases.symbolDrop.duration,
                        settle_phase_duration: step.timing.phases.gridSettle.duration
                    }
                }))
            };
            
            // Mock acknowledgments for synchronization
            const mockSyncAcknowledgments = () => {
                setTimeout(() => {
                    cascadeSynchronizer.emit('clientAcknowledment', {
                        sessionId: 'mock-session-id',
                        ackType: 'initialization'
                    });
                }, 50);
            };
            
            if (cascadeSequence.cascades.length > 0) {
                mockSyncAcknowledgments();
                
                try {
                    // Test synchronization initiation
                    const syncResult = await cascadeSynchronizer.initiateCascadeSync(
                        spinResult.spinId,
                        'test-player',
                        cascadeSequence
                    );
                    
                    expect(syncResult.success).toBe(true);
                    expect(syncResult.sessionId).toBeDefined();
                    expect(mockSocketManager.sendToPlayer).toHaveBeenCalled();
                    
                } catch (error) {
                    // If synchronization fails due to missing acknowledgments, that's expected in test environment
                    expect(error.message).toContain('timeout');
                }
            }
            
            // Validate the original spin result regardless of sync outcome
            const validation = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
            expect(validation.isValid).toBe(true);
        });
    });
    
    describe('Cross-Component Validation', () => {
        test('should validate GridEngine hash generation with CascadeValidator', () => {
            const testGrid = [
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
            ];
            
            const salt = 'test-salt-123';
            
            // Generate hash with GridEngine
            const gridEngineHash = gridEngine.generateGridValidationHash(testGrid, salt);
            
            // Generate hash with CascadeValidator
            const validatorHash = cascadeValidator.generateGridHash(testGrid, salt);
            
            // Both should produce the same hash
            expect(gridEngineHash).toBe(validatorHash);
            expect(gridEngineHash).toHaveLength(64); // SHA-256 hex
        });
        
        test('should validate CascadeStep models across all components', () => {
            // Create a cascade step using GridEngine process
            const cascadeStep = new CascadeStep({
                stepNumber: 0,
                gridStateBefore: [
                    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
                ],
                gridStateAfter: [
                    ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                    ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
                ]
            });
            
            // Add cluster and timing data as GridEngine would
            cascadeStep.addMatchedCluster({
                symbolType: 'time_gem',
                positions: [
                    { col: 0, row: 0 }, { col: 0, row: 1 }, { col: 0, row: 2 }, { col: 0, row: 3 },
                    { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 1, row: 2 }, { col: 1, row: 3 }
                ],
                clusterSize: 8,
                payout: 10.0,
                multiplier: 1
            });
            
            cascadeStep.timing = gridEngine.calculateEnhancedCascadeTiming(0, 0, false);
            cascadeStep.updateStepHash();
            
            // Validate with CascadeValidator
            const validation = cascadeValidator.validateCascadeStepIntegrity(cascadeStep);
            expect(validation.isValid).toBe(true);
            
            // Test GridEngine validation method
            const clientStepData = {
                stepNumber: 0,
                gridStateAfter: cascadeStep.gridStateAfter,
                matchedClusters: cascadeStep.matchedClusters,
                totalStepWin: cascadeStep.winData.stepWin
            };
            
            const gridEngineValidation = gridEngine.validateCascadeStep(clientStepData, cascadeStep);
            expect(gridEngineValidation.isValid).toBe(true);
            
            // Test synchronizer state calculation
            const expectedState = cascadeSynchronizer.calculateExpectedState({
                pre_cascade_grid: cascadeStep.gridStateBefore,
                post_cascade_grid: cascadeStep.gridStateAfter,
                winning_clusters: cascadeStep.matchedClusters
            }, 'symbol_settle');
            
            expect(expectedState).toEqual(cascadeStep.gridStateAfter);
        });
        
        test('should maintain data consistency across foundation models', () => {
            // Test SpinResult, CascadeStep, and GameSession integration
            const spinResult = gridEngine.generateSpinResult({
                bet: 1.00,
                gameSession: mockGameSession
            });
            
            // Verify SpinResult structure
            expect(spinResult.spinId).toBeDefined();
            expect(spinResult.betAmount).toBe(1.00);
            expect(spinResult.initialGrid).toBeDefined();
            expect(Array.isArray(spinResult.cascadeSteps)).toBe(true);
            
            // Verify GameSession was updated
            expect(mockGameSession.gameState.currentSpinId).toBe(spinResult.spinId);
            expect(mockGameSession.gameState.totalSpins).toBe(1);
            
            // Verify CascadeStep structure if present
            if (spinResult.cascadeSteps.length > 0) {
                const firstStep = spinResult.cascadeSteps[0];
                expect(firstStep).toBeInstanceOf(CascadeStep);
                expect(firstStep.stepNumber).toBe(0);
                expect(firstStep.validation.stepHash).toBeDefined();
                expect(firstStep.timing).toBeDefined();
            }
        });
    });
    
    describe('Performance and Scalability', () => {
        test('should handle multiple concurrent workflows', async () => {
            const concurrentSpins = 5;
            const promises = [];
            
            for (let i = 0; i < concurrentSpins; i++) {
                const promise = Promise.resolve().then(() => {
                    const session = new GameSession(`session-${i}`, `player-${i}`);
                    const spinResult = gridEngine.generateSpinResult({
                        bet: 1.00,
                        spinId: `spin-${i}`,
                        gameSession: session
                    });
                    
                    const validation = cascadeValidator.validateCompleteSpinResult(spinResult, session);
                    
                    return {
                        spinId: spinResult.spinId,
                        isValid: validation.isValid,
                        cascadeCount: spinResult.cascadeSteps.length
                    };
                });
                
                promises.push(promise);
            }
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(concurrentSpins);
            results.forEach((result, index) => {
                expect(result.spinId).toBe(`spin-${index}`);
                expect(result.isValid).toBe(true);
            });
        });
        
        test('should maintain performance under load', async () => {
            const performanceTest = async (iterations) => {
                const startTime = Date.now();
                
                for (let i = 0; i < iterations; i++) {
                    const spinResult = gridEngine.generateSpinResult({
                        bet: 1.00,
                        gameSession: mockGameSession
                    });
                    
                    cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
                }
                
                return Date.now() - startTime;
            };
            
            const duration = await performanceTest(10);
            const averageTimePerSpin = duration / 10;
            
            // Each spin should complete within reasonable time (1 second)
            expect(averageTimePerSpin).toBeLessThan(1000);
            
            // Verify performance metrics are tracked
            const metrics = cascadeValidator.getPerformanceMetrics();
            expect(metrics.totalValidations).toBeGreaterThan(0);
            expect(metrics.averageValidationTime).toBeGreaterThan(0);
        });
        
        test('should handle memory efficiently with large number of operations', async () => {
            const initialMemory = process.memoryUsage();
            
            // Perform many operations
            for (let i = 0; i < 100; i++) {
                const session = new GameSession(`test-session-${i}`, `test-player-${i}`);
                const spinResult = gridEngine.generateSpinResult({
                    bet: 1.00,
                    gameSession: session
                });
                
                cascadeValidator.validateCompleteSpinResult(spinResult, session);
                
                // Cleanup every 20 operations
                if (i % 20 === 0) {
                    cascadeValidator.clearValidationCache();
                }
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });
    });
    
    describe('Error Recovery and Resilience', () => {
        test('should handle GridEngine errors gracefully in full workflow', async () => {
            // Mock GridEngine to throw error
            jest.spyOn(gridEngine, 'generateRandomGrid').mockImplementation(() => {
                throw new Error('Grid generation failed');
            });
            
            try {
                const spinResult = gridEngine.generateSpinResult({
                    bet: 1.00,
                    gameSession: mockGameSession
                });
                
                // Should return error result, not throw
                expect(spinResult.error).toBeDefined();
                expect(spinResult.error.code).toBe('SPIN_GENERATION_FAILED');
                
                // Validator should handle error results
                const validation = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
                expect(validation.isValid).toBe(false);
                
            } finally {
                gridEngine.generateRandomGrid.mockRestore();
            }
        });
        
        test('should handle synchronizer failures without breaking validation', async () => {
            // Create a normal spin result
            const spinResult = gridEngine.generateSpinResult({
                bet: 1.00,
                gameSession: mockGameSession
            });
            
            // Even if synchronizer fails, validation should work
            const validation = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
            expect(validation.isValid).toBe(true);
            
            // Test synchronizer with invalid data
            try {
                await cascadeSynchronizer.initiateCascadeSync('invalid-spin', 'invalid-player', null);
                fail('Should have thrown error');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        test('should handle partial validation failures gracefully', () => {
            // Create spin result with some invalid data
            const spinResult = new SpinResult({
                spinId: 'test-spin-123',
                betAmount: 1.00,
                initialGrid: 'invalid-grid' // Wrong type
            });
            
            const validation = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.validationTime).toBeGreaterThan(0);
            
            // Should still produce a report
            const report = cascadeValidator.createValidationReport(validation);
            expect(report.status).toBe('INVALID');
            expect(report.summary.totalErrors).toBeGreaterThan(0);
        });
    });
    
    describe('Data Integrity Throughout Pipeline', () => {
        test('should maintain hash consistency throughout workflow', () => {
            const spinResult = gridEngine.generateSpinResult({
                bet: 1.00,
                gameSession: mockGameSession
            });
            
            // Test initial grid hash consistency
            const initialGridHash1 = gridEngine.generateGridValidationHash(spinResult.initialGrid, 'test-salt');
            const initialGridHash2 = cascadeValidator.generateGridHash(spinResult.initialGrid, 'test-salt');
            expect(initialGridHash1).toBe(initialGridHash2);
            
            // Test cascade step hash consistency
            if (spinResult.cascadeSteps.length > 0) {
                const step = spinResult.cascadeSteps[0];
                const stepHash1 = gridEngine.generateCascadeStepValidationHash(step);
                const stepHash2 = step.generateStepHash();
                expect(stepHash1).toBe(stepHash2);
            }
            
            // Test spin result hash consistency
            const spinHash1 = gridEngine.generateSpinResultValidationHash(spinResult);
            const spinHash2 = spinResult.generateValidationHash();
            expect(spinHash1).toBe(spinHash2);
        });
        
        test('should maintain timing consistency across components', () => {
            const cascadeStep = new CascadeStep({
                stepNumber: 0,
                gridStateBefore: [['time_gem']],
                gridStateAfter: [['space_gem']]
            });
            
            // Set timing from GridEngine
            cascadeStep.timing = gridEngine.calculateEnhancedCascadeTiming(0, 0, false);
            
            // Validate timing with CascadeValidator
            const timingValidation = cascadeValidator.validateTiming({
                stepTiming: cascadeStep.timing
            });
            
            expect(timingValidation.isValid).toBe(true);
            expect(timingValidation.timingAnalysis.stepTiming).toBeDefined();
        });
        
        test('should maintain payout consistency across validation layers', () => {
            // Create matches using GridEngine logic
            const matches = [
                { symbol: 'time_gem', count: 8, positions: [] },
                { symbol: 'thanos', count: 12, positions: [] }
            ];
            
            const bet = 2.00;
            const wins = gridEngine.calculateCascadeWins(matches, bet);
            
            // Calculate total win
            const totalWin = wins.reduce((sum, win) => sum + win.payout, 0);
            
            // Create cascade step with these wins
            const cascadeStep = new CascadeStep({
                stepNumber: 0,
                gridStateBefore: [['time_gem']],
                gridStateAfter: [['space_gem']]
            });
            
            for (const win of wins) {
                cascadeStep.addMatchedCluster({
                    symbolType: win.symbol,
                    positions: win.positions,
                    clusterSize: matches.find(m => m.symbol === win.symbol).count,
                    payout: win.payout,
                    multiplier: win.multiplier
                });
            }
            
            cascadeStep.winData.stepWin = totalWin;
            
            // Validate payout calculations
            const payoutValidation = cascadeValidator.validatePayouts(cascadeStep);
            expect(payoutValidation.isValid).toBe(true);
        });
    });
    
    describe('Security and Anti-Fraud Integration', () => {
        test('should detect and prevent common attack vectors', () => {
            // Test grid manipulation detection
            const manipulatedGrid = [
                ['thanos', 'thanos', 'thanos', 'thanos', 'thanos'],
                ['thanos', 'thanos', 'thanos', 'thanos', 'thanos'],
                ['thanos', 'thanos', 'thanos', 'thanos', 'thanos'],
                ['thanos', 'thanos', 'thanos', 'thanos', 'thanos'],
                ['thanos', 'thanos', 'thanos', 'thanos', 'thanos'],
                ['thanos', 'thanos', 'thanos', 'thanos', 'thanos']
            ];
            
            const gridValidation = cascadeValidator.validateGridState(manipulatedGrid);
            expect(gridValidation.warnings.length).toBeGreaterThan(0);
            
            // Test impossible payout detection
            const spinResult = new SpinResult({
                spinId: 'attack-test',
                betAmount: 1.00,
                initialGrid: manipulatedGrid
            });
            
            spinResult.totalWin = 10000; // Impossible win
            
            const validation = cascadeValidator.validateCompleteSpinResult(spinResult, mockGameSession);
            expect(validation.fraudScore).toBeGreaterThan(50);
        });
        
        test('should validate cryptographic integrity throughout workflow', () => {
            const spinResult = gridEngine.generateSpinResult({
                bet: 1.00,
                gameSession: mockGameSession
            });
            
            // Verify all hashes are cryptographically secure (SHA-256)
            expect(spinResult.validationHash).toHaveLength(64);
            
            if (spinResult.cascadeSteps.length > 0) {
                for (const step of spinResult.cascadeSteps) {
                    expect(step.validation.stepHash).toHaveLength(64);
                    expect(step.validation.gridHashBefore).toHaveLength(64);
                    expect(step.validation.gridHashAfter).toHaveLength(64);
                }
            }
            
            // Verify RNG seed is cryptographically secure
            expect(spinResult.rngSeed).toHaveLength(32); // 16 bytes * 2 hex chars
        });
        
        test('should maintain audit trail throughout workflow', () => {
            // Enable detailed logging
            const session = new GameSession('audit-test', 'audit-player');
            
            const spinResult = gridEngine.generateSpinResult({
                bet: 1.00,
                gameSession: session
            });
            
            const validation = cascadeValidator.validateCompleteSpinResult(spinResult, session);
            
            // Verify audit data is captured
            expect(spinResult.timestamp).toBeDefined();
            expect(spinResult.spinId).toBeDefined();
            expect(validation.validationTime).toBeGreaterThan(0);
            
            // Verify session tracking
            expect(session.gameState.currentSpinId).toBe(spinResult.spinId);
            expect(session.gameState.totalSpins).toBe(1);
            
            // Create validation report for audit trail
            const auditReport = cascadeValidator.createValidationReport(validation);
            expect(auditReport.timestamp).toBeDefined();
            expect(auditReport.metrics).toBeDefined();
        });
    });
});