/**
 * Task 3.6.3: Test WinCalculator synchronization
 * Comprehensive tests for server result verification and win data synchronization in WinCalculator
 */

// Global test setup for Phaser environment simulation
const setupTestEnvironment = () => {
    global.window = global.window || {};
    
    // Mock GameConfig
    window.GameConfig = {
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
        GRID_WIDTH: 6,
        GRID_HEIGHT: 5
    };
    
    // Mock CascadeAPI
    window.cascadeAPI = {
        detectDesync: jest.fn(),
        sendStepAcknowledgment: jest.fn()
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
        findMatches: jest.fn(() => [
            {
                positions: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1]],
                symbol: 'time_gem',
                count: 8
            }
        ])
    };
    
    // Mock console methods
    global.console = {
        ...console,
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
};

// Load WinCalculator
const loadWinCalculator = () => {
    // Clear any existing WinCalculator
    if (window.WinCalculator) {
        delete window.WinCalculator;
    }
    
    // Load the WinCalculator class
    const fs = require('fs');
    const path = require('path');
    const winCalculatorPath = path.join(__dirname, '../../systems/WinCalculator.js');
    const winCalculatorCode = fs.readFileSync(winCalculatorPath, 'utf8');
    
    // Execute the code to define window.WinCalculator
    eval(winCalculatorCode);
    
    // Create instance
    return new window.WinCalculator();
};

describe('WinCalculator Synchronization - Task 3.6.3', () => {
    let winCalculator;
    
    beforeAll(() => {
        setupTestEnvironment();
        winCalculator = loadWinCalculator();
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset WinCalculator validation state
        winCalculator.validationResults.clear();
        winCalculator.calculationHistory.clear();
        winCalculator.winDataSyncState = {
            isActive: false,
            sessionId: null,
            lastValidation: null,
            pendingValidations: new Set(),
            validationErrors: [],
            recoveryAttempts: 0,
            syncStatistics: {
                totalValidations: 0,
                successfulValidations: 0,
                failedValidations: 0,
                averageProcessingTime: 0
            }
        };
        
        // Reset validation config
        winCalculator.validationConfig = {
            enableServerVerification: true,
            toleranceThreshold: 0.01,
            enableStepTracking: true,
            maxHistorySize: 50,
            enableDesyncDetection: true
        };
    });
    
    describe('Server Result Verification', () => {
        test('should verify server results within tolerance', () => {
            const clientResult = {
                totalWin: 100.00,
                totalMultiplier: 2.5,
                winGroups: [
                    { symbol: 'time_gem', count: 8, payout: 40.00 },
                    { symbol: 'space_gem', count: 10, payout: 60.00 }
                ]
            };
            
            const serverResult = {
                totalWin: 100.01, // Within tolerance
                totalMultiplier: 2.5,
                winGroups: [
                    { symbol: 'time_gem', count: 8, payout: 40.00 },
                    { symbol: 'space_gem', count: 10, payout: 60.01 }
                ]
            };
            
            const verification = winCalculator.verifyServerResult(clientResult, serverResult, 1);
            
            expect(verification.isValid).toBe(true);
            expect(verification.withinTolerance).toBe(true);
            expect(verification.difference).toBeLessThanOrEqual(0.01);
            expect(verification.stepIndex).toBe(1);
        });
        
        test('should detect significant result mismatches', () => {
            const clientResult = {
                totalWin: 100.00,
                totalMultiplier: 2.0,
                winGroups: [
                    { symbol: 'time_gem', count: 8, payout: 100.00 }
                ]
            };
            
            const serverResult = {
                totalWin: 150.00, // Significant difference
                totalMultiplier: 3.0,
                winGroups: [
                    { symbol: 'time_gem', count: 8, payout: 150.00 }
                ]
            };
            
            const verification = winCalculator.verifyServerResult(clientResult, serverResult, 1);
            
            expect(verification.isValid).toBe(false);
            expect(verification.withinTolerance).toBe(false);
            expect(verification.difference).toBe(50.00);
            expect(verification.multiplierMismatch).toBe(true);
        });
        
        test('should validate individual win group calculations', () => {
            const clientResult = {
                totalWin: 100.00,
                totalMultiplier: 1.0,
                winGroups: [
                    { symbol: 'time_gem', count: 8, payout: 40.00 },
                    { symbol: 'space_gem', count: 10, payout: 60.00 }
                ]
            };
            
            const serverResult = {
                totalWin: 100.00,
                totalMultiplier: 1.0,
                winGroups: [
                    { symbol: 'time_gem', count: 8, payout: 45.00 }, // Mismatch
                    { symbol: 'space_gem', count: 10, payout: 55.00 }  // Compensated mismatch
                ]
            };
            
            const verification = winCalculator.verifyServerResult(clientResult, serverResult, 1);
            
            expect(verification.isValid).toBe(true); // Total matches
            expect(verification.winGroupMismatches).toBeDefined();
            expect(verification.winGroupMismatches.length).toBeGreaterThan(0);
        });
        
        test('should handle missing server result data gracefully', () => {
            const clientResult = {
                totalWin: 100.00,
                totalMultiplier: 2.0
            };
            
            const verification = winCalculator.verifyServerResult(clientResult, null, 1);
            
            expect(verification).toBeNull();
            expect(winCalculator.winDataSyncState.validationErrors.length).toBeGreaterThan(0);
            expect(winCalculator.winDataSyncState.validationErrors[0].type).toBe('verification_error');
        });
        
        test('should trigger desync detection on significant mismatch', () => {
            winCalculator.validationConfig.enableServerVerification = true;
            
            const clientResult = { totalWin: 100.00, totalMultiplier: 1.0 };
            const serverResult = { totalWin: 200.00, totalMultiplier: 1.0 }; // 100% difference
            
            const verification = winCalculator.verifyServerResult(clientResult, serverResult, 1);
            
            expect(verification.isValid).toBe(false);
            expect(window.cascadeAPI.detectDesync).toHaveBeenCalledWith('win_calculation_mismatch', {
                stepIndex: 1,
                clientResult: clientResult,
                serverResult: serverResult,
                difference: 100.00
            });
        });
    });
    
    describe('Cascading Win Validation', () => {
        test('should validate multi-step cascade wins', () => {
            const cascadeSteps = [
                {
                    gridState: window.GridManager.getCurrentGrid(),
                    multiplier: 1.0,
                    serverData: { stepWin: 50.00 }
                },
                {
                    gridState: window.GridManager.getCurrentGrid(),
                    multiplier: 1.5,
                    serverData: { stepWin: 75.00 }
                },
                {
                    gridState: window.GridManager.getCurrentGrid(),
                    multiplier: 2.0,
                    serverData: { stepWin: 100.00 }
                }
            ];
            
            const betAmount = 10;
            
            // Mock findMatches to return consistent results
            window.GridManager.findMatches.mockReturnValue([
                { symbol: 'time_gem', count: 8, positions: [] }
            ]);
            
            const validation = winCalculator.validateCascadingWins(cascadeSteps, betAmount);
            
            expect(validation.isValid).toBe(true);
            expect(validation.totalSteps).toBe(3);
            expect(validation.stepResults).toHaveLength(3);
            expect(validation.cumulativeWin).toBeGreaterThan(0);
        });
        
        test('should detect cascading win calculation errors', () => {
            const cascadeSteps = [
                {
                    gridState: window.GridManager.getCurrentGrid(),
                    multiplier: 1.0,
                    serverData: { stepWin: 1000.00 } // Impossibly high for the matches
                }
            ];
            
            const betAmount = 10;
            
            // Mock findMatches to return small win
            window.GridManager.findMatches.mockReturnValue([
                { symbol: 'time_gem', count: 8, positions: [] }
            ]);
            
            const validation = winCalculator.validateCascadingWins(cascadeSteps, betAmount);
            
            expect(validation.stepResults[0].isValid).toBe(false);
            expect(validation.stepResults[0].difference).toBeGreaterThan(winCalculator.validationConfig.toleranceThreshold);
        });
        
        test('should handle cascade validation errors gracefully', () => {
            // Pass invalid cascade steps
            const invalidCascadeSteps = null;
            const betAmount = 10;
            
            const validation = winCalculator.validateCascadingWins(invalidCascadeSteps, betAmount);
            
            expect(validation.isValid).toBe(false);
            expect(validation.error).toBeDefined();
            expect(validation.totalSteps).toBe(0);
        });
        
        test('should validate individual cascade step calculations', () => {
            const step = {
                gridState: window.GridManager.getCurrentGrid(),
                multiplier: 2.0,
                serverData: { stepWin: 40.00 }
            };
            
            const betAmount = 10;
            const stepIndex = 1;
            
            // Mock findMatches and calculateStepWin
            window.GridManager.findMatches.mockReturnValue([
                { symbol: 'time_gem', count: 8, positions: [] }
            ]);
            
            // Mock calculateStepWin to return specific value
            jest.spyOn(winCalculator, 'calculateStepWin').mockReturnValue(40.00);
            
            const stepResult = winCalculator.validateCascadeStep(step, betAmount, stepIndex);
            
            expect(stepResult.isValid).toBe(true);
            expect(stepResult.stepIndex).toBe(1);
            expect(stepResult.clientWin).toBe(40.00);
            expect(stepResult.serverWin).toBe(40.00);
            expect(stepResult.difference).toBe(0);
        });
    });
    
    describe('Step-wise Calculation Tracking', () => {
        test('should track calculation history with hash generation', () => {
            const stepData = {
                stepIndex: 1,
                clientResult: { totalWin: 100.00, winGroups: [] },
                serverResult: { totalWin: 100.00, winGroups: [] },
                matches: [{ symbol: 'time_gem', count: 8 }],
                betAmount: 10,
                multiplier: 1.0,
                timestamp: Date.now()
            };
            
            winCalculator.trackStepCalculation(stepData);
            
            expect(winCalculator.calculationHistory.has(1)).toBe(true);
            
            const storedStep = winCalculator.calculationHistory.get(1);
            expect(storedStep.stepIndex).toBe(1);
            expect(storedStep.hash).toBeDefined();
            expect(storedStep.timestamp).toBeDefined();
        });
        
        test('should maintain calculation history size limits', () => {
            // Add more than the limit
            for (let i = 0; i < 60; i++) {
                winCalculator.trackStepCalculation({
                    stepIndex: i,
                    clientResult: { totalWin: i * 10 },
                    serverResult: { totalWin: i * 10 },
                    matches: [],
                    betAmount: 10,
                    multiplier: 1.0,
                    timestamp: Date.now() + i
                });
            }
            
            expect(winCalculator.calculationHistory.size).toBeLessThanOrEqual(50);
        });
        
        test('should generate consistent calculation hashes', () => {
            const stepData = {
                stepIndex: 1,
                clientResult: { totalWin: 100.00 },
                serverResult: { totalWin: 100.00 },
                matches: [{ symbol: 'time_gem', count: 8 }],
                betAmount: 10,
                multiplier: 1.0,
                timestamp: 1234567890
            };
            
            const hash1 = winCalculator.generateCalculationHash(stepData);
            const hash2 = winCalculator.generateCalculationHash(stepData);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toBeDefined();
            expect(typeof hash1).toBe('string');
        });
        
        test('should retrieve step calculations by index', () => {
            const stepData = {
                stepIndex: 5,
                clientResult: { totalWin: 250.00 },
                serverResult: { totalWin: 250.00 },
                matches: [],
                betAmount: 50,
                multiplier: 1.0,
                timestamp: Date.now()
            };
            
            winCalculator.trackStepCalculation(stepData);
            
            const retrieved = winCalculator.getStepCalculation(5);
            
            expect(retrieved).toBeDefined();
            expect(retrieved.stepIndex).toBe(5);
            expect(retrieved.clientResult.totalWin).toBe(250.00);
        });
        
        test('should return calculation history analysis', () => {
            // Add some calculation history
            for (let i = 0; i < 5; i++) {
                winCalculator.trackStepCalculation({
                    stepIndex: i,
                    clientResult: { totalWin: i * 20 },
                    serverResult: { totalWin: i * 20 },
                    matches: [],
                    betAmount: 10,
                    multiplier: 1.0,
                    timestamp: Date.now() + i * 1000
                });
            }
            
            const analysis = winCalculator.getCalculationHistory();
            
            expect(analysis.totalSteps).toBe(5);
            expect(analysis.steps).toHaveLength(5);
            expect(analysis.totalWin).toBe(200); // Sum of all wins
        });
    });
    
    describe('Payout and Multiplier Validation', () => {
        test('should validate payout amounts against tolerance', () => {
            const payouts = {
                client: 100.00,
                server: 100.005 // Within tolerance
            };
            
            const validation = winCalculator.validatePayouts(payouts, 1);
            
            expect(validation.isValid).toBe(true);
            expect(validation.difference).toBeLessThanOrEqual(winCalculator.validationConfig.toleranceThreshold);
        });
        
        test('should validate multiplier values', () => {
            const multipliers = {
                client: 2.5,
                server: 2.6 // Outside tolerance for multipliers
            };
            
            const validation = winCalculator.validateMultipliers(multipliers, 1);
            
            expect(validation.isValid).toBe(false);
            expect(validation.difference).toBe(0.1);
            expect(validation.toleranceExceeded).toBe(true);
        });
        
        test('should detect significant payout discrepancies', () => {
            const payouts = {
                client: 100.00,
                server: 200.00 // 100% difference
            };
            
            const validation = winCalculator.validatePayouts(payouts, 1);
            
            expect(validation.isValid).toBe(false);
            expect(validation.significantMismatch).toBe(true);
            expect(validation.difference).toBe(100.00);
        });
        
        test('should apply server corrections when enabled', () => {
            const correctionData = {
                stepIndex: 1,
                serverWin: 150.00,
                serverMultiplier: 3.0,
                clientWin: 100.00,
                clientMultiplier: 2.0
            };
            
            const correctionResult = winCalculator.applyServerCorrections(correctionData);
            
            expect(correctionResult.applied).toBe(true);
            expect(correctionResult.corrections.winAmount).toBe(50.00);
            expect(correctionResult.corrections.multiplier).toBe(1.0);
        });
    });
    
    describe('Win Data Synchronization', () => {
        test('should synchronize win data with server', () => {
            const stepIndex = 1;
            const clientResult = { totalWin: 100.00, totalMultiplier: 2.0 };
            const serverData = { stepWin: 100.00, multiplier: 2.0 };
            
            winCalculator.synchronizeWinData(stepIndex, clientResult, serverData);
            
            expect(winCalculator.winDataSyncState.lastValidation).toBeDefined();
            expect(winCalculator.winDataSyncState.syncStatistics.totalValidations).toBe(1);
        });
        
        test('should track synchronization errors', () => {
            const stepIndex = 1;
            const clientResult = { totalWin: 100.00 };
            const serverData = { stepWin: 200.00 }; // Significant mismatch
            
            winCalculator.synchronizeWinData(stepIndex, clientResult, serverData);
            
            expect(winCalculator.winDataSyncState.syncStatistics.failedValidations).toBe(1);
            expect(winCalculator.winDataSyncState.validationErrors.length).toBeGreaterThan(0);
        });
        
        test('should update synchronization statistics', () => {
            // Perform multiple synchronizations
            for (let i = 0; i < 5; i++) {
                const clientResult = { totalWin: i * 20 };
                const serverData = { stepWin: i * 20 };
                winCalculator.synchronizeWinData(i, clientResult, serverData);
            }
            
            const stats = winCalculator.winDataSyncState.syncStatistics;
            expect(stats.totalValidations).toBe(5);
            expect(stats.successfulValidations).toBe(5);
            expect(stats.failedValidations).toBe(0);
        });
        
        test('should handle synchronization with missing server data', () => {
            const stepIndex = 1;
            const clientResult = { totalWin: 100.00 };
            const serverData = null;
            
            winCalculator.synchronizeWinData(stepIndex, clientResult, serverData);
            
            expect(winCalculator.winDataSyncState.validationErrors.length).toBeGreaterThan(0);
            expect(winCalculator.winDataSyncState.validationErrors[0].type).toBe('missing_server_data');
        });
    });
    
    describe('Integration with Enhanced Synchronization', () => {
        test('should provide comprehensive sync status', () => {
            // Setup sync state
            winCalculator.winDataSyncState.isActive = true;
            winCalculator.winDataSyncState.sessionId = 'test_session';
            winCalculator.winDataSyncState.pendingValidations.add(1);
            winCalculator.winDataSyncState.pendingValidations.add(2);
            
            const status = winCalculator.getSyncStatus();
            
            expect(status.isActive).toBe(true);
            expect(status.sessionId).toBe('test_session');
            expect(status.pendingValidations).toBe(2);
            expect(status.statistics).toBeDefined();
        });
        
        test('should reset sync state when requested', () => {
            // Setup some state
            winCalculator.winDataSyncState.isActive = true;
            winCalculator.winDataSyncState.sessionId = 'test';
            winCalculator.winDataSyncState.pendingValidations.add(1);
            winCalculator.validationResults.set(1, { valid: true });
            
            winCalculator.resetSyncState();
            
            expect(winCalculator.winDataSyncState.isActive).toBe(false);
            expect(winCalculator.winDataSyncState.sessionId).toBeNull();
            expect(winCalculator.winDataSyncState.pendingValidations.size).toBe(0);
            expect(winCalculator.validationResults.size).toBe(0);
        });
        
        test('should handle validation configuration updates', () => {
            const newConfig = {
                enableServerVerification: false,
                toleranceThreshold: 0.05,
                customParam: 'test_value'
            };
            
            winCalculator.updateValidationConfig(newConfig);
            
            expect(winCalculator.validationConfig.enableServerVerification).toBe(false);
            expect(winCalculator.validationConfig.toleranceThreshold).toBe(0.05);
            expect(winCalculator.validationConfig.customParam).toBe('test_value');
            // Original config should be preserved
            expect(winCalculator.validationConfig.enableStepTracking).toBe(true);
        });
        
        test('should provide validation performance metrics', () => {
            // Perform some validations with timing
            const startTime = Date.now();
            
            for (let i = 0; i < 10; i++) {
                const clientResult = { totalWin: i * 10 };
                const serverResult = { totalWin: i * 10 };
                winCalculator.verifyServerResult(clientResult, serverResult, i);
            }
            
            const metrics = winCalculator.getValidationMetrics();
            
            expect(metrics.totalValidations).toBe(10);
            expect(metrics.averageProcessingTime).toBeDefined();
            expect(metrics.successRate).toBe(1.0);
        });
    });
    
    describe('Error Handling and Recovery', () => {
        test('should handle calculation errors gracefully', () => {
            // Mock findMatches to throw an error
            window.GridManager.findMatches.mockImplementationOnce(() => {
                throw new Error('Grid processing error');
            });
            
            const cascadeSteps = [{
                gridState: window.GridManager.getCurrentGrid(),
                multiplier: 1.0,
                serverData: { stepWin: 50.00 }
            }];
            
            const validation = winCalculator.validateCascadingWins(cascadeSteps, 10);
            
            expect(validation.isValid).toBe(false);
            expect(validation.error).toContain('Grid processing error');
        });
        
        test('should recover from validation failures', () => {
            // Setup failed validation
            winCalculator.winDataSyncState.recoveryAttempts = 2;
            winCalculator.winDataSyncState.pendingValidations.add(1);
            winCalculator.winDataSyncState.pendingValidations.add(2);
            
            const recoveryResult = winCalculator.attemptValidationRecovery();
            
            expect(recoveryResult.attempted).toBe(true);
            expect(recoveryResult.pendingValidations).toBe(2);
        });
        
        test('should limit recovery attempts', () => {
            // Exceed recovery attempt limit
            winCalculator.winDataSyncState.recoveryAttempts = 5; // Above typical limit
            
            const recoveryResult = winCalculator.attemptValidationRecovery();
            
            expect(recoveryResult.limitExceeded).toBe(true);
        });
        
        test('should provide comprehensive error reporting', () => {
            // Add various types of errors
            winCalculator.winDataSyncState.validationErrors.push(
                { type: 'verification_error', message: 'Network error', timestamp: Date.now() },
                { type: 'calculation_error', message: 'Math error', timestamp: Date.now() },
                { type: 'timeout_error', message: 'Request timeout', timestamp: Date.now() }
            );
            
            const errorReport = winCalculator.getErrorReport();
            
            expect(errorReport.totalErrors).toBe(3);
            expect(errorReport.errorTypes.verification_error).toBe(1);
            expect(errorReport.errorTypes.calculation_error).toBe(1);
            expect(errorReport.errorTypes.timeout_error).toBe(1);
            expect(errorReport.errors).toHaveLength(3);
        });
    });
    
    describe('Performance and Concurrency', () => {
        test('should handle concurrent verification requests', async () => {
            const verificationPromises = Array.from({ length: 10 }, (_, i) => {
                const clientResult = { totalWin: i * 10, totalMultiplier: 1.0 };
                const serverResult = { totalWin: i * 10, totalMultiplier: 1.0 };
                return Promise.resolve(winCalculator.verifyServerResult(clientResult, serverResult, i));
            });
            
            const results = await Promise.all(verificationPromises);
            
            expect(results).toHaveLength(10);
            results.forEach((result, index) => {
                expect(result.isValid).toBe(true);
                expect(result.stepIndex).toBe(index);
            });
        });
        
        test('should maintain performance under load', () => {
            const startTime = Date.now();
            
            // Perform many calculations
            for (let i = 0; i < 1000; i++) {
                const clientResult = { totalWin: i, totalMultiplier: 1.0 };
                const serverResult = { totalWin: i, totalMultiplier: 1.0 };
                winCalculator.verifyServerResult(clientResult, serverResult, i % 50);
            }
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            // Should complete within reasonable time
            expect(totalTime).toBeLessThan(1000); // 1 second for 1000 calculations
        });
        
        test('should clean up validation data automatically', () => {
            // Fill validation results beyond limit
            for (let i = 0; i < 100; i++) {
                winCalculator.validationResults.set(i, {
                    isValid: true,
                    timestamp: Date.now() + i
                });
            }
            
            // Should maintain size limit
            expect(winCalculator.validationResults.size).toBeLessThanOrEqual(50);
        });
    });
});