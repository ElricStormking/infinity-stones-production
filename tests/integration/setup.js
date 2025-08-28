/**
 * Jest Setup for Integration Tests
 * 
 * Task 8.1: Integration test setup and utilities
 * 
 * This file sets up the testing environment for integration tests,
 * providing custom matchers, utilities, and configuration.
 */

const path = require('path');

// Extend Jest with custom matchers for integration testing
expect.extend({
    toBeWithinTolerance(received, expected, tolerance = 0.01) {
        const pass = Math.abs(received - expected) <= tolerance;
        
        if (pass) {
            return {
                message: () =>
                    `Expected ${received} not to be within tolerance ${tolerance} of ${expected}`,
                pass: true,
            };
        } else {
            return {
                message: () =>
                    `Expected ${received} to be within tolerance ${tolerance} of ${expected} (difference: ${Math.abs(received - expected)})`,
                pass: false,
            };
        }
    },

    toBeValidBalance(received) {
        const pass = typeof received === 'number' && received >= 0 && !isNaN(received);
        
        if (pass) {
            return {
                message: () => `Expected ${received} not to be a valid balance`,
                pass: true,
            };
        } else {
            return {
                message: () => `Expected ${received} to be a valid balance (positive number)`,
                pass: false,
            };
        }
    },

    toBeValidSpinResult(received) {
        const requiredFields = ['spinId', 'gridState', 'totalWin'];
        const hasRequiredFields = requiredFields.every(field => 
            received && typeof received === 'object' && field in received
        );
        
        const validGridState = received.gridState && 
            Array.isArray(received.gridState) && 
            received.gridState.length === 6 &&
            received.gridState.every(col => Array.isArray(col) && col.length === 5);
        
        const validWin = typeof received.totalWin === 'number' && received.totalWin >= 0;
        
        const pass = hasRequiredFields && validGridState && validWin;
        
        if (pass) {
            return {
                message: () => `Expected ${JSON.stringify(received)} not to be a valid spin result`,
                pass: true,
            };
        } else {
            const issues = [];
            if (!hasRequiredFields) issues.push('missing required fields');
            if (!validGridState) issues.push('invalid grid state');
            if (!validWin) issues.push('invalid win amount');
            
            return {
                message: () => `Expected valid spin result, but found issues: ${issues.join(', ')}`,
                pass: false,
            };
        }
    },

    toHaveValidResponseTime(received, maxTimeMs = 1000) {
        const pass = typeof received === 'number' && received > 0 && received <= maxTimeMs;
        
        if (pass) {
            return {
                message: () => `Expected response time ${received}ms to exceed ${maxTimeMs}ms`,
                pass: true,
            };
        } else {
            return {
                message: () => `Expected response time to be between 0 and ${maxTimeMs}ms, but got ${received}ms`,
                pass: false,
            };
        }
    },

    toBeValidSessionId(received) {
        const pass = typeof received === 'string' && received.length > 0 && /^[a-zA-Z0-9_-]+$/.test(received);
        
        if (pass) {
            return {
                message: () => `Expected ${received} not to be a valid session ID`,
                pass: true,
            };
        } else {
            return {
                message: () => `Expected ${received} to be a valid session ID (non-empty string with alphanumeric characters)`,
                pass: false,
            };
        }
    },

    toBeValidTransactionId(received) {
        const pass = typeof received === 'string' && received.length > 0 && /^[a-zA-Z0-9_-]+$/.test(received);
        
        if (pass) {
            return {
                message: () => `Expected ${received} not to be a valid transaction ID`,
                pass: true,
            };
        } else {
            return {
                message: () => `Expected ${received} to be a valid transaction ID (non-empty string with alphanumeric characters)`,
                pass: false,
            };
        }
    },

    toHaveValidCascadeSteps(received) {
        if (!received || !Array.isArray(received.cascadeSteps)) {
            return {
                message: () => `Expected object with cascadeSteps array, got ${typeof received}`,
                pass: false,
            };
        }

        const validSteps = received.cascadeSteps.every(step => 
            step && 
            typeof step === 'object' &&
            'stepNumber' in step &&
            'gridBefore' in step &&
            'gridAfter' in step
        );

        if (validSteps) {
            return {
                message: () => `Expected cascade steps to be invalid`,
                pass: true,
            };
        } else {
            return {
                message: () => `Expected all cascade steps to have required fields (stepNumber, gridBefore, gridAfter)`,
                pass: false,
            };
        }
    }
});

// Global test utilities
global.testUtils = {
    // Wait for a condition to be true with timeout
    async waitForCondition(condition, timeout = 5000, interval = 100) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                if (await condition()) {
                    return true;
                }
            } catch (error) {
                // Condition check failed, continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error(`Condition not met within ${timeout}ms`);
    },

    // Generate random test data
    generateRandomPlayerId() {
        return `test_player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    generateRandomSessionId() {
        return `test_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    generateRandomAmount(min = 1, max = 100) {
        return Math.round((Math.random() * (max - min) + min) * 100) / 100;
    },

    // Mock grid generation
    generateMockGrid() {
        const symbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'];
        const grid = [];
        
        for (let col = 0; col < 6; col++) {
            grid[col] = [];
            for (let row = 0; row < 5; row++) {
                grid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
            }
        }
        
        return grid;
    },

    // Performance measurement utilities
    async measurePerformance(operation, name = 'operation') {
        const startTime = process.hrtime.bigint();
        const startMemory = process.memoryUsage();
        
        const result = await operation();
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        return {
            result,
            performance: {
                duration,
                memoryDelta,
                memoryDeltaMB: memoryDelta / 1024 / 1024
            }
        };
    },

    // Batch operation utilities
    async executeConcurrently(operations, maxConcurrency = 10) {
        const results = [];
        const executing = new Set();
        
        for (const operation of operations) {
            while (executing.size >= maxConcurrency) {
                await Promise.race(executing);
            }
            
            const promise = operation().finally(() => executing.delete(promise));
            executing.add(promise);
            results.push(promise);
        }
        
        return Promise.allSettled(results);
    },

    // Validation utilities
    validateAPIResponse(response, expectedFields = []) {
        expect(response).toBeDefined();
        expect(typeof response).toBe('object');
        
        expectedFields.forEach(field => {
            expect(response).toHaveProperty(field);
        });
        
        return response;
    },

    validateErrorResponse(response, expectedError = null) {
        expect(response).toBeDefined();
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('error');
        
        if (expectedError) {
            expect(response.error).toBe(expectedError);
        }
        
        return response;
    },

    // Database utilities for testing
    createMockDatabase() {
        return {
            players: new Map(),
            sessions: new Map(),
            transactions: new Map(),
            auditLog: [],
            
            addPlayer(playerId, data) {
                this.players.set(playerId, {
                    id: playerId,
                    balance: 0,
                    createdAt: new Date(),
                    ...data
                });
            },
            
            getPlayer(playerId) {
                return this.players.get(playerId);
            },
            
            updatePlayerBalance(playerId, amount) {
                const player = this.players.get(playerId);
                if (player) {
                    player.balance += amount;
                    return player;
                }
                return null;
            },
            
            addTransaction(transactionId, data) {
                this.transactions.set(transactionId, {
                    id: transactionId,
                    timestamp: new Date(),
                    ...data
                });
            },
            
            logAudit(action, data) {
                this.auditLog.push({
                    action,
                    timestamp: new Date(),
                    data
                });
            },
            
            clear() {
                this.players.clear();
                this.sessions.clear();
                this.transactions.clear();
                this.auditLog.length = 0;
            }
        };
    }
};

// Setup console overrides for better test output
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    if (process.env.JEST_WORKER_ID) {
        // In Jest worker, prefix with worker ID for parallel test identification
        originalLog(`[Worker ${process.env.JEST_WORKER_ID}]`, ...args);
    } else {
        originalLog(...args);
    }
};

console.error = (...args) => {
    if (process.env.JEST_WORKER_ID) {
        originalError(`[Worker ${process.env.JEST_WORKER_ID}] ERROR:`, ...args);
    } else {
        originalError('ERROR:', ...args);
    }
};

// Environment setup
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'integration';

// Increase default timeout for all tests
jest.setTimeout(30000);

// Global cleanup after all tests
afterAll(async () => {
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
});