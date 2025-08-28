/**
 * Database Configuration for Infinity Storm Casino Server
 * 
 * Provides connection pooling, transaction management, and database utilities
 * Supports both development (local) and production configurations
 * 
 * Key Features:
 * - Connection pooling with configurable limits
 * - Automatic connection retry with exponential backoff
 * - Health monitoring and connection validation
 * - Transaction management utilities
 * - Query logging and performance monitoring
 * - Prepared statement caching
 */

const { Pool } = require('pg');
const { logger } = require('../utils/logger');

/**
 * Database Configuration based on environment
 */
const config = {
    development: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        
        // Connection Pool Settings
        min: 2,                    // Minimum connections in pool
        max: 10,                   // Maximum connections in pool
        idleTimeoutMillis: 30000,  // Close idle connections after 30s
        connectionTimeoutMillis: 5000, // Wait 5s for connection
        
        // Query Settings
        statement_timeout: 10000,   // 10 second query timeout
        query_timeout: 8000,        // 8 second individual query timeout
        
        // SSL Settings
        ssl: false
    },
    
    production: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'infinity_storm',
        user: process.env.DB_USER || 'infinity_app',
        password: process.env.DB_PASSWORD,
        
        // Production Pool Settings
        min: 5,                    // Higher minimum for production
        max: 50,                   // Higher maximum for production load
        idleTimeoutMillis: 60000,  // Keep connections longer in production
        connectionTimeoutMillis: 10000, // Longer timeout for production
        
        // Production Query Settings
        statement_timeout: 30000,   // 30 second timeout for complex queries
        query_timeout: 25000,       // 25 second individual query timeout
        
        // Production SSL Settings
        ssl: {
            rejectUnauthorized: false, // Configure based on your SSL setup
            sslmode: 'require'
        }
    },
    
    test: {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT) || 5432,
        database: process.env.TEST_DB_NAME || 'infinity_storm_test',
        user: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres',
        
        // Test Pool Settings (smaller pool)
        min: 1,
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 3000,
        
        // Fast test query settings
        statement_timeout: 5000,
        query_timeout: 3000,
        
        ssl: false
    }
};

// Get current environment configuration
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

if (!dbConfig) {
    throw new Error(`Invalid environment: ${env}. Must be development, production, or test`);
}

/**
 * Create connection pool with comprehensive configuration
 */
const pool = new Pool({
    ...dbConfig,
    
    // Pool event handlers
    log: (message) => {
        logger.debug('Pool log:', message);
    },
    
    // Custom error handling
    application_name: `infinity-storm-${env}`,
    
    // Performance optimizations
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

/**
 * Pool Event Handlers
 */
pool.on('connect', (client) => {
    logger.info('New client connected to database pool');
    
    // Set session variables for new connections
    client.query(`
        SET application_name = 'infinity-storm-${env}';
        SET timezone = 'UTC';
        SET statement_timeout = ${dbConfig.statement_timeout};
    `).catch(err => {
        logger.error('Error setting session variables:', err);
    });
});

pool.on('acquire', () => {
    logger.debug('Client acquired from pool');
});

pool.on('remove', () => {
    logger.debug('Client removed from pool');
});

pool.on('error', (err) => {
    logger.error('Database pool error:', {
        error: err.message,
        stack: err.stack,
        code: err.code
    });
    
    // Implement automatic recovery for connection errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        logger.warn('Database connection lost, attempting reconnection...');
        reconnectWithBackoff();
    }
});

/**
 * Exponential backoff reconnection strategy
 */
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseDelay = 1000; // 1 second

async function reconnectWithBackoff() {
    if (reconnectAttempts >= maxReconnectAttempts) {
        logger.error('Max reconnection attempts reached, giving up');
        process.exit(1);
    }
    
    const delay = baseDelay * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;
    
    logger.info(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            
            logger.info('Database reconnection successful');
            reconnectAttempts = 0; // Reset counter on success
        } catch (error) {
            logger.error('Reconnection failed:', error.message);
            reconnectWithBackoff(); // Recursive retry
        }
    }, delay);
}

/**
 * Database Health Check
 */
async function healthCheck() {
    try {
        const start = Date.now();
        const client = await pool.connect();
        
        try {
            // Test basic connectivity
            const result = await client.query('SELECT NOW() as timestamp, version() as version');
            const queryTime = Date.now() - start;
            
            // Test health_check function if available
            let healthData = null;
            try {
                const healthResult = await client.query('SELECT health_check() as health');
                healthData = healthResult.rows[0].health;
            } catch (err) {
                // health_check function might not exist
                logger.debug('health_check function not available:', err.message);
            }
            
            return {
                status: 'healthy',
                timestamp: result.rows[0].timestamp,
                database_version: result.rows[0].version,
                query_time_ms: queryTime,
                pool_stats: {
                    total_connections: pool.totalCount,
                    idle_connections: pool.idleCount,
                    waiting_requests: pool.waitingCount
                },
                health_data: healthData
            };
            
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error('Database health check failed:', error);
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Transaction Management Utilities
 */
class DatabaseTransaction {
    constructor(client) {
        this.client = client;
        this.isActive = false;
    }
    
    async begin() {
        await this.client.query('BEGIN');
        this.isActive = true;
        logger.debug('Transaction started');
    }
    
    async commit() {
        if (this.isActive) {
            await this.client.query('COMMIT');
            this.isActive = false;
            logger.debug('Transaction committed');
        }
    }
    
    async rollback() {
        if (this.isActive) {
            await this.client.query('ROLLBACK');
            this.isActive = false;
            logger.debug('Transaction rolled back');
        }
    }
    
    async query(text, params) {
        return await this.client.query(text, params);
    }
}

/**
 * Execute function within a database transaction
 * Automatically handles commit/rollback based on success/failure
 */
async function withTransaction(callback) {
    const client = await pool.connect();
    const transaction = new DatabaseTransaction(client);
    
    try {
        await transaction.begin();
        const result = await callback(transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        await transaction.rollback();
        logger.error('Transaction failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Execute query with automatic retry on connection failure
 */
async function queryWithRetry(text, params, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED')) {
                logger.warn(`Query attempt ${attempt} failed, retrying:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            
            throw error;
        }
    }
    
    throw lastError;
}

/**
 * Get detailed pool statistics
 */
function getPoolStats() {
    return {
        total_count: pool.totalCount,
        idle_count: pool.idleCount,
        waiting_count: pool.waitingCount,
        config: {
            max: dbConfig.max,
            min: dbConfig.min,
            idle_timeout: dbConfig.idleTimeoutMillis,
            connection_timeout: dbConfig.connectionTimeoutMillis
        }
    };
}

/**
 * Prepared Statement Cache
 */
const preparedStatements = new Map();

async function queryPrepared(name, text, params) {
    if (!preparedStatements.has(name)) {
        logger.debug(`Preparing statement: ${name}`);
        preparedStatements.set(name, text);
    }
    
    return await pool.query({
        name: name,
        text: text,
        values: params
    });
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    logger.info('Shutting down database pool...');
    try {
        await pool.end();
        logger.info('Database pool closed successfully');
    } catch (error) {
        logger.error('Error closing database pool:', error);
    }
}

// Handle process termination
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = {
    pool,
    query: pool.query.bind(pool),
    queryWithRetry,
    queryPrepared,
    withTransaction,
    healthCheck,
    getPoolStats,
    shutdown,
    config: dbConfig,
    
    // Transaction class for advanced usage
    DatabaseTransaction
};