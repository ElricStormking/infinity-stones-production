/**
 * Global Setup for Integration Tests
 * 
 * Task 8.1: Global test environment setup
 * 
 * This file handles global setup for all integration tests,
 * including database initialization, server startup, and
 * environment configuration.
 */

const path = require('path');
const fs = require('fs');

module.exports = async function globalSetup() {
    console.log('🚀 Setting up global integration test environment...');

    // Create necessary directories
    const dirs = [
        'coverage/integration',
        'tests/tmp',
        'tests/logs'
    ];

    dirs.forEach(dir => {
        const dirPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    });

    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.TEST_MODE = 'integration';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise during testing
    process.env.DATABASE_URL = 'memory://test'; // Use in-memory database
    process.env.REDIS_URL = 'memory://test'; // Use in-memory Redis
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.DISABLE_RATE_LIMITING = 'true'; // Disable for testing
    process.env.SUPABASE_URL = 'http://localhost:54321'; // Local Supabase
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    // Initialize test database schema if needed
    try {
        await initializeTestDatabase();
    } catch (error) {
        console.warn('⚠️ Database initialization skipped:', error.message);
    }

    // Initialize test Redis if needed
    try {
        await initializeTestRedis();
    } catch (error) {
        console.warn('⚠️ Redis initialization skipped:', error.message);
    }

    // Verify required dependencies
    await verifyDependencies();

    // Start any required services
    await startTestServices();

    console.log('✅ Global setup complete');
};

async function initializeTestDatabase() {
    // This would normally set up a test database
    // For integration tests, we'll use mock implementations
    console.log('🗄️ Initializing test database...');

    // Create mock database schemas in memory
    global.testDatabase = {
        players: new Map(),
        sessions: new Map(),
        transactions: new Map(),
        gameResults: new Map(),
        auditLogs: [],
        
        // Schema validation
        validatePlayer(player) {
            return player && 
                   typeof player.id === 'string' && 
                   typeof player.balance === 'number' && 
                   player.balance >= 0;
        },
        
        validateTransaction(transaction) {
            return transaction &&
                   typeof transaction.id === 'string' &&
                   typeof transaction.amount === 'number' &&
                   ['bet', 'win', 'refund'].includes(transaction.type);
        },
        
        // Cleanup method
        clear() {
            this.players.clear();
            this.sessions.clear();
            this.transactions.clear();
            this.gameResults.clear();
            this.auditLogs.length = 0;
        }
    };

    console.log('✅ Test database initialized');
}

async function initializeTestRedis() {
    // Mock Redis for session management and caching
    console.log('📦 Initializing test Redis...');

    global.testRedis = new Map();
    
    // Mock Redis operations
    global.testRedis.get = function(key) {
        return Promise.resolve(this.has(key) ? this.get(key) : null);
    };
    
    global.testRedis.set = function(key, value, options = {}) {
        this.set(key, value);
        
        // Handle TTL if specified
        if (options.EX) {
            setTimeout(() => {
                this.delete(key);
            }, options.EX * 1000);
        }
        
        return Promise.resolve('OK');
    };
    
    global.testRedis.del = function(key) {
        const deleted = this.has(key) ? 1 : 0;
        this.delete(key);
        return Promise.resolve(deleted);
    };

    console.log('✅ Test Redis initialized');
}

async function verifyDependencies() {
    console.log('🔍 Verifying test dependencies...');

    const requiredModules = [
        'supertest',
        'socket.io-client',
        'jest'
    ];

    for (const module of requiredModules) {
        try {
            require.resolve(module);
            console.log(`  ✓ ${module} available`);
        } catch (error) {
            console.error(`  ✗ ${module} missing - please run: npm install ${module}`);
            process.exit(1);
        }
    }

    console.log('✅ All dependencies verified');
}

async function startTestServices() {
    console.log('🔧 Starting test services...');

    // Initialize mock services that integration tests depend on
    global.testServices = {
        gameEngine: {
            generateSpinResult: (options) => ({
                spinId: `test_spin_${Date.now()}`,
                gridState: generateMockGrid(),
                totalWin: Math.random() * 10,
                cascadeSteps: Math.random() < 0.3 ? generateMockCascadeSteps() : []
            }),
            
            validateSpinResult: (result) => {
                return result && 
                       typeof result.spinId === 'string' &&
                       Array.isArray(result.gridState) &&
                       typeof result.totalWin === 'number';
            }
        },
        
        walletService: {
            getBalance: async (playerId) => {
                const player = global.testDatabase.players.get(playerId);
                return player ? player.balance : 0;
            },
            
            debitBalance: async (playerId, amount) => {
                const player = global.testDatabase.players.get(playerId);
                if (!player || player.balance < amount) {
                    throw new Error('Insufficient funds');
                }
                player.balance -= amount;
                return player.balance;
            },
            
            creditBalance: async (playerId, amount) => {
                const player = global.testDatabase.players.get(playerId);
                if (!player) {
                    throw new Error('Player not found');
                }
                player.balance += amount;
                return player.balance;
            }
        },
        
        authService: {
            generateToken: (playerId) => `test_token_${playerId}_${Date.now()}`,
            validateToken: (token) => {
                return token && token.startsWith('test_token_');
            },
            extractPlayerId: (token) => {
                const parts = token.split('_');
                return parts.length >= 3 ? parts[2] : null;
            }
        },
        
        auditService: {
            log: (action, data) => {
                global.testDatabase.auditLogs.push({
                    timestamp: new Date(),
                    action,
                    data
                });
            },
            
            getLogs: (filter = {}) => {
                return global.testDatabase.auditLogs.filter(log => {
                    if (filter.action && log.action !== filter.action) return false;
                    if (filter.since && log.timestamp < filter.since) return false;
                    return true;
                });
            }
        }
    };

    console.log('✅ Test services started');
}

function generateMockGrid() {
    const symbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'];
    const grid = [];
    
    for (let col = 0; col < 6; col++) {
        grid[col] = [];
        for (let row = 0; row < 5; row++) {
            grid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
        }
    }
    
    return grid;
}

function generateMockCascadeSteps() {
    const stepCount = Math.floor(Math.random() * 3) + 1; // 1-3 steps
    const steps = [];

    for (let i = 0; i < stepCount; i++) {
        steps.push({
            stepNumber: i,
            gridBefore: generateMockGrid(),
            gridAfter: generateMockGrid(),
            matchedClusters: [{
                symbolType: 'time_gem',
                positions: Array.from({length: 8}, () => ({ 
                    row: Math.floor(Math.random() * 5), 
                    col: Math.floor(Math.random() * 6) 
                })),
                winAmount: Math.random() * 5 + 1
            }]
        });
    }

    return steps;
}