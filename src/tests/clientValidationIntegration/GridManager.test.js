/**
 * Task 3.6.2: Test GridManager validation integration
 * Comprehensive tests for client-side validation integration in GridManager
 */

// Global test setup for Phaser environment simulation
const setupTestEnvironment = () => {
    global.window = global.window || {};
    
    // Mock Phaser 3 scene environment
    const mockScene = {
        add: {
            sprite: jest.fn(() => ({
                setOrigin: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                setTexture: jest.fn().mockReturnThis(),
                play: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
                x: 0,
                y: 0,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                visible: true
            }))
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
        GRID_WIDTH: 6,
        GRID_HEIGHT: 5,
        SYMBOL_TYPES: ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'scarlet_witch', 'thanos', 'thanos_weapon'],
        SYMBOL_PROBABILITIES: {
            'time_gem': 0.15,
            'space_gem': 0.15,
            'mind_gem': 0.15,
            'power_gem': 0.15,
            'reality_gem': 0.15,
            'soul_gem': 0.15,
            'scarlet_witch': 0.05,
            'thanos': 0.03,
            'thanos_weapon': 0.02
        }
    };
    
    // Mock CascadeAPI
    window.cascadeAPI = {
        generateClientValidationHash: jest.fn(async () => 'mock_hash_123'),
        detectDesync: jest.fn(),
        sendStepAcknowledgment: jest.fn()
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

// Load GridManager
const loadGridManager = (mockScene) => {
    // Clear any existing GridManager
    if (window.GridManager) {
        delete window.GridManager;
    }
    
    // Load the GridManager class
    const fs = require('fs');
    const path = require('path');
    const gridManagerPath = path.join(__dirname, '../../systems/GridManager.js');
    const gridManagerCode = fs.readFileSync(gridManagerPath, 'utf8');
    
    // Execute the code to define window.GridManager
    eval(gridManagerCode);
    
    // Create instance with mock scene
    return new window.GridManager(mockScene, 50, 50, 80);
};

describe('GridManager Validation Integration - Task 3.6.2', () => {
    let gridManager;
    let mockScene;
    
    beforeAll(() => {
        mockScene = setupTestEnvironment();
        gridManager = loadGridManager(mockScene);
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset GridManager validation state
        gridManager.validationEnabled = true;
        gridManager.validationHistory.clear();
        gridManager.syncState = {
            isActive: false,
            sessionId: null,
            lastValidation: null,
            acknowledgments: new Map(),
            errors: []
        };
    });
    
    describe('Grid State Validation', () => {
        test('should capture complete grid state', () => {
            // Setup test grid
            gridManager.initializeGrid();
            for (let col = 0; col < gridManager.cols; col++) {
                for (let row = 0; row < gridManager.rows; row++) {
                    gridManager.grid[col][row] = {
                        symbolType: window.GameConfig.SYMBOL_TYPES[col % window.GameConfig.SYMBOL_TYPES.length],
                        x: col * 80,
                        y: row * 80,
                        multiplier: 1
                    };
                }
            }
            
            const gridState = gridManager.captureGridState();
            
            expect(gridState).toBeDefined();
            expect(gridState.dimensions).toEqual({ cols: 6, rows: 5 });
            expect(gridState.symbols).toHaveLength(6);
            expect(gridState.symbols[0]).toHaveLength(5);
            expect(gridState.metadata.captureTime).toBeDefined();
            expect(gridState.metadata.totalSymbols).toBe(30);
        });
        
        test('should validate grid structure correctly', () => {
            const validGridState = {
                dimensions: { cols: 6, rows: 5 },
                symbols: Array(6).fill().map(() => Array(5).fill().map((_, i) => ({
                    type: window.GameConfig.SYMBOL_TYPES[i % window.GameConfig.SYMBOL_TYPES.length],
                    position: { x: 0, y: 0 },
                    multiplier: 1
                }))),
                metadata: { totalSymbols: 30 }
            };
            
            const validation = gridManager.validateGridStructure(validGridState);
            
            expect(validation.valid).toBe(true);
            expect(validation.reason).toBe('structure_valid');
        });
        
        test('should detect invalid grid dimensions', () => {
            const invalidGridState = {
                dimensions: { cols: 5, rows: 5 }, // Wrong dimensions
                symbols: Array(5).fill().map(() => Array(5).fill({})),
                metadata: { totalSymbols: 25 }
            };
            
            const validation = gridManager.validateGridStructure(invalidGridState);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('invalid_dimensions');
            expect(validation.details).toContain('Expected 6x5 grid');
        });
        
        test('should detect invalid symbol types', () => {
            const invalidGridState = {
                dimensions: { cols: 6, rows: 5 },
                symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                    type: 'invalid_symbol_type',
                    position: { x: 0, y: 0 },
                    multiplier: 1
                }))),
                metadata: { totalSymbols: 30 }
            };
            
            const validation = gridManager.validateGridStructure(invalidGridState);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('invalid_symbol_type');
            expect(validation.details).toContain('invalid_symbol_type');
        });
        
        test('should detect physics violations (floating symbols)', () => {
            const invalidGridState = {
                dimensions: { cols: 6, rows: 5 },
                symbols: Array(6).fill().map((_, col) => Array(5).fill().map((_, row) => {
                    // Create floating symbol - symbol at row 2 with empty space below
                    if (col === 0 && row === 2) {
                        return { type: 'time_gem', position: { x: 0, y: 160 }, multiplier: 1 };
                    } else if (col === 0 && row === 3) {
                        return null; // Empty space below the symbol
                    }
                    return { type: 'time_gem', position: { x: col * 80, y: row * 80 }, multiplier: 1 };
                })),
                metadata: { totalSymbols: 29 }
            };
            
            const validation = gridManager.validateGridStructure(invalidGridState);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('physics_violation');
            expect(validation.details).toContain('floating symbols');
        });
    });
    
    describe('Hash Generation and Verification', () => {
        test('should generate grid state hashes', async () => {
            const gridState = {
                dimensions: { cols: 6, rows: 5 },
                symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                    type: 'time_gem',
                    position: { x: 0, y: 0 },
                    multiplier: 1
                }))),
                metadata: { totalSymbols: 30 }
            };
            
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'test_salt'
            };
            
            const hash = await gridManager.generateGridStateHash(gridState, stepData);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(window.cascadeAPI.generateClientValidationHash).toHaveBeenCalledWith(gridState, stepData);
        });
        
        test('should validate grid state with hash comparison', async () => {
            // Setup grid
            gridManager.initializeGrid();
            
            const expectedHash = 'expected_hash_123';
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'validation_test'
            };
            
            // Mock hash generation to return expected hash
            window.cascadeAPI.generateClientValidationHash.mockResolvedValueOnce(expectedHash);
            
            const validation = await gridManager.validateGridState(expectedHash, stepData);
            
            expect(validation.valid).toBe(true);
            expect(validation.clientHash).toBe(expectedHash);
            expect(validation.expectedHash).toBe(expectedHash);
        });
        
        test('should detect hash mismatches', async () => {
            // Setup grid
            gridManager.initializeGrid();
            
            const expectedHash = 'expected_hash_123';
            const clientHash = 'different_hash_456';
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                salt: 'mismatch_test'
            };
            
            // Mock hash generation to return different hash
            window.cascadeAPI.generateClientValidationHash.mockResolvedValueOnce(clientHash);
            
            const validation = await gridManager.validateGridState(expectedHash, stepData);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('hash_mismatch');
            expect(validation.clientHash).toBe(clientHash);
            expect(validation.expectedHash).toBe(expectedHash);
        });
        
        test('should handle validation errors gracefully', async () => {
            // Mock hash generation to throw error
            window.cascadeAPI.generateClientValidationHash.mockRejectedValueOnce(new Error('Hash generation failed'));
            
            const validation = await gridManager.validateGridState('some_hash', {});
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('validation_error');
            expect(validation.error).toContain('Hash generation failed');
        });
    });
    
    describe('Cascade Step Verification', () => {
        test('should verify cascade step data integrity', async () => {
            const cascadeStep = {
                stepIndex: 1,
                gridBefore: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'time_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                gridAfter: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'space_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                matchedClusters: [
                    {
                        positions: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1]],
                        symbolType: 'time_gem',
                        clusterSize: 8
                    }
                ],
                dropPatterns: [
                    { column: 0, drops: [{ from: -1, to: 0, symbolType: 'space_gem' }] }
                ],
                timing: { duration: 1000, phase: 'complete' }
            };
            
            const verification = await gridManager.verifyCascadeStep(cascadeStep);
            
            expect(verification.valid).toBe(true);
            expect(verification.stepIndex).toBe(1);
            expect(verification.gridContinuity).toBe(true);
            expect(verification.clusterConnectivity).toBe(true);
            expect(verification.dropPhysics).toBe(true);
            expect(verification.hash).toBeDefined();
        });
        
        test('should detect grid continuity violations', async () => {
            const cascadeStep = {
                stepIndex: 1,
                gridBefore: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'time_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                gridAfter: {
                    dimensions: { cols: 5, rows: 4 }, // Different dimensions
                    symbols: Array(5).fill().map(() => Array(4).fill().map(() => ({
                        type: 'space_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 20 }
                },
                matchedClusters: [],
                dropPatterns: [],
                timing: { duration: 1000, phase: 'complete' }
            };
            
            const verification = await gridManager.verifyCascadeStep(cascadeStep);
            
            expect(verification.valid).toBe(false);
            expect(verification.gridContinuity).toBe(false);
            expect(verification.errors).toContain('Grid dimensions changed between before/after states');
        });
        
        test('should validate cluster connectivity', async () => {
            const cascadeStep = {
                stepIndex: 1,
                gridBefore: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'time_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                gridAfter: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'space_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                matchedClusters: [
                    {
                        positions: [[0, 0], [0, 1], [2, 2]], // Non-connected positions
                        symbolType: 'time_gem',
                        clusterSize: 3
                    }
                ],
                dropPatterns: [],
                timing: { duration: 1000, phase: 'complete' }
            };
            
            const verification = await gridManager.verifyCascadeStep(cascadeStep);
            
            expect(verification.valid).toBe(false);
            expect(verification.clusterConnectivity).toBe(false);
            expect(verification.errors).toContain('Cluster contains non-connected positions');
        });
        
        test('should validate drop pattern physics', async () => {
            const cascadeStep = {
                stepIndex: 1,
                gridBefore: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'time_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                gridAfter: {
                    dimensions: { cols: 6, rows: 5 },
                    symbols: Array(6).fill().map(() => Array(5).fill().map(() => ({
                        type: 'space_gem',
                        position: { x: 0, y: 0 },
                        multiplier: 1
                    }))),
                    metadata: { totalSymbols: 30 }
                },
                matchedClusters: [],
                dropPatterns: [
                    { 
                        column: 0, 
                        drops: [{ from: 2, to: 1, symbolType: 'space_gem' }] // Upward movement - invalid
                    }
                ],
                timing: { duration: 1000, phase: 'complete' }
            };
            
            const verification = await gridManager.verifyCascadeStep(cascadeStep);
            
            expect(verification.valid).toBe(false);
            expect(verification.dropPhysics).toBe(false);
            expect(verification.errors).toContain('Invalid drop pattern: symbols cannot move upward');
        });
    });
    
    describe('Timing Validation', () => {
        test('should validate step timing within tolerance', () => {
            const timing = {
                serverTimestamp: Date.now(),
                clientTimestamp: Date.now() + 500, // 500ms difference
                stepDuration: 1000,
                phaseTimings: {
                    win_highlight: 200,
                    symbol_removal: 300,
                    symbol_drop: 400,
                    symbol_settle: 100
                }
            };
            
            const validation = gridManager.validateStepTiming(timing);
            
            expect(validation.valid).toBe(true);
            expect(validation.timingDifference).toBeLessThanOrEqual(1000); // Within tolerance
            expect(validation.phaseConsistency).toBe(true);
        });
        
        test('should detect timing discrepancies beyond tolerance', () => {
            const timing = {
                serverTimestamp: Date.now(),
                clientTimestamp: Date.now() + 2000, // 2 second difference - beyond tolerance
                stepDuration: 1000,
                phaseTimings: {
                    win_highlight: 200,
                    symbol_removal: 300,
                    symbol_drop: 400,
                    symbol_settle: 100
                }
            };
            
            const validation = gridManager.validateStepTiming(timing);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('timing_out_of_tolerance');
            expect(validation.timingDifference).toBeGreaterThan(1000);
        });
        
        test('should detect phase timing inconsistencies', () => {
            const timing = {
                serverTimestamp: Date.now(),
                clientTimestamp: Date.now(),
                stepDuration: 1000,
                phaseTimings: {
                    win_highlight: 200,
                    symbol_removal: 300,
                    symbol_drop: 400,
                    symbol_settle: 200 // Total = 1100, but stepDuration = 1000
                }
            };
            
            const validation = gridManager.validateStepTiming(timing);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('phase_timing_mismatch');
            expect(validation.phaseConsistency).toBe(false);
        });
        
        test('should detect timing manipulation attempts', () => {
            const timing = {
                serverTimestamp: Date.now(),
                clientTimestamp: Date.now(),
                stepDuration: 50, // Impossibly fast
                phaseTimings: {
                    win_highlight: 10,
                    symbol_removal: 10,
                    symbol_drop: 20,
                    symbol_settle: 10
                }
            };
            
            const validation = gridManager.validateStepTiming(timing);
            
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('suspicious_timing');
            expect(validation.manipulationDetected).toBe(true);
        });
    });
    
    describe('Sync Acknowledgment Integration', () => {
        test('should generate sync acknowledgments automatically', async () => {
            const stepData = {
                stepIndex: 1,
                gridState: gridManager.captureGridState(),
                validationHash: 'test_hash_123',
                timestamp: Date.now()
            };
            
            const acknowledgment = await gridManager.generateSyncAcknowledgment(stepData);
            
            expect(acknowledgment).toBeDefined();
            expect(acknowledgment.stepIndex).toBe(1);
            expect(acknowledgment.gridValidation).toBeDefined();
            expect(acknowledgment.clientTimestamp).toBeDefined();
            expect(acknowledgment.validationHash).toBe('test_hash_123');
            
            expect(window.cascadeAPI.sendStepAcknowledgment).toHaveBeenCalledWith(stepData, acknowledgment);
        });
        
        test('should handle acknowledgment failures gracefully', async () => {
            window.cascadeAPI.sendStepAcknowledgment.mockRejectedValueOnce(new Error('Network error'));
            
            const stepData = {
                stepIndex: 1,
                gridState: gridManager.captureGridState(),
                validationHash: 'test_hash',
                timestamp: Date.now()
            };
            
            const acknowledgment = await gridManager.generateSyncAcknowledgment(stepData);
            
            expect(acknowledgment.error).toBeDefined();
            expect(acknowledgment.error).toContain('Network error');
        });
        
        test('should track acknowledgment history', async () => {
            const stepData1 = { stepIndex: 1, gridState: {}, validationHash: 'hash1', timestamp: Date.now() };
            const stepData2 = { stepIndex: 2, gridState: {}, validationHash: 'hash2', timestamp: Date.now() + 1000 };
            
            await gridManager.generateSyncAcknowledgment(stepData1);
            await gridManager.generateSyncAcknowledgment(stepData2);
            
            expect(gridManager.syncState.acknowledgments.size).toBe(2);
            expect(gridManager.syncState.acknowledgments.has(1)).toBe(true);
            expect(gridManager.syncState.acknowledgments.has(2)).toBe(true);
        });
    });
    
    describe('Grid State Management API', () => {
        test('should provide current grid access', () => {
            // Setup test grid
            gridManager.initializeGrid();
            for (let col = 0; col < gridManager.cols; col++) {
                for (let row = 0; row < gridManager.rows; row++) {
                    gridManager.grid[col][row] = {
                        symbolType: `symbol_${col}_${row}`,
                        x: col * 80,
                        y: row * 80
                    };
                }
            }
            
            const currentGrid = gridManager.getCurrentGrid();
            
            expect(currentGrid).toBeDefined();
            expect(currentGrid).toHaveLength(6);
            expect(currentGrid[0]).toHaveLength(5);
            expect(currentGrid[0][0]).toBe('symbol_0_0');
        });
        
        test('should allow grid state setting with validation', () => {
            const newGrid = Array(6).fill().map((_, col) => 
                Array(5).fill().map((_, row) => `new_symbol_${col}_${row}`)
            );
            
            const result = gridManager.setGrid(newGrid);
            
            expect(result.success).toBe(true);
            expect(gridManager.getCurrentGrid()).toEqual(newGrid);
        });
        
        test('should reject invalid grid structures when setting', () => {
            const invalidGrid = Array(5).fill().map(() => Array(4).fill('invalid')); // Wrong dimensions
            
            const result = gridManager.setGrid(invalidGrid);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid grid dimensions');
        });
        
        test('should maintain validation history with size limits', async () => {
            // Add many validation results
            for (let i = 0; i < 60; i++) {
                gridManager.validationHistory.set(i, {
                    valid: true,
                    timestamp: Date.now() + i,
                    hash: `hash_${i}`
                });
            }
            
            // Should maintain size limit (default 50)
            expect(gridManager.validationHistory.size).toBeLessThanOrEqual(50);
        });
    });
    
    describe('Integration with Enhanced Synchronization', () => {
        test('should handle validation when disabled', async () => {
            gridManager.validationEnabled = false;
            
            const validation = await gridManager.validateGridState('some_hash', {});
            
            expect(validation.valid).toBe(true);
            expect(validation.reason).toBe('validation_disabled');
        });
        
        test('should integrate with CascadeAPI desync detection', async () => {
            const stepData = {
                stepIndex: 1,
                timestamp: Date.now(),
                expectedHash: 'expected_hash',
                actualHash: 'different_hash'
            };
            
            await gridManager.reportValidationFailure(stepData);
            
            expect(window.cascadeAPI.detectDesync).toHaveBeenCalledWith('grid_validation_failure', {
                stepIndex: 1,
                expectedHash: 'expected_hash',
                actualHash: 'different_hash',
                gridState: expect.any(Object)
            });
        });
        
        test('should provide comprehensive validation statistics', () => {
            // Add some validation history
            gridManager.validationHistory.set(1, { valid: true, timestamp: Date.now() });
            gridManager.validationHistory.set(2, { valid: false, timestamp: Date.now() });
            gridManager.validationHistory.set(3, { valid: true, timestamp: Date.now() });
            
            const stats = gridManager.getValidationStats();
            
            expect(stats.totalValidations).toBe(3);
            expect(stats.successfulValidations).toBe(2);
            expect(stats.failedValidations).toBe(1);
            expect(stats.successRate).toBeCloseTo(0.667, 3);
            expect(stats.isValidationEnabled).toBe(true);
        });
        
        test('should handle grid state rollback', () => {
            // Setup initial grid
            const initialGrid = Array(6).fill().map((_, col) => 
                Array(5).fill().map((_, row) => `initial_${col}_${row}`)
            );
            gridManager.setGrid(initialGrid);
            
            // Change grid
            const newGrid = Array(6).fill().map((_, col) => 
                Array(5).fill().map((_, row) => `new_${col}_${row}`)
            );
            gridManager.setGrid(newGrid);
            
            // Rollback
            const rollbackResult = gridManager.rollbackToLastValidState();
            
            expect(rollbackResult.success).toBe(true);
            expect(gridManager.getCurrentGrid()).toEqual(initialGrid);
        });
    });
    
    describe('Performance and Concurrency', () => {
        test('should handle concurrent validation requests', async () => {
            const validationPromises = Array.from({ length: 10 }, (_, i) => 
                gridManager.validateGridState(`hash_${i}`, { stepIndex: i, timestamp: Date.now() + i })
            );
            
            const results = await Promise.all(validationPromises);
            
            expect(results).toHaveLength(10);
            results.forEach((result, index) => {
                expect(result).toBeDefined();
                expect(typeof result.valid).toBe('boolean');
            });
        });
        
        test('should maintain performance under load', async () => {
            const startTime = Date.now();
            
            // Perform many validations
            const promises = Array.from({ length: 100 }, async (_, i) => {
                const gridState = gridManager.captureGridState();
                const hash = await gridManager.generateGridStateHash(gridState, { stepIndex: i });
                return gridManager.validateGridState(hash, { stepIndex: i });
            });
            
            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            // Should complete within reasonable time (adjust threshold as needed)
            expect(totalTime).toBeLessThan(5000); // 5 seconds for 100 validations
        });
        
        test('should clean up validation history automatically', async () => {
            // Fill validation history beyond limit
            for (let i = 0; i < 75; i++) {
                gridManager.validationHistory.set(i, {
                    valid: true,
                    timestamp: Date.now() + i
                });
            }
            
            // Trigger cleanup by adding one more
            await gridManager.validateGridState('test_hash', { stepIndex: 76 });
            
            // Should have cleaned up to maintain size limit
            expect(gridManager.validationHistory.size).toBeLessThanOrEqual(50);
        });
    });
});