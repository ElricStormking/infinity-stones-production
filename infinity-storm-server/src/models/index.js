/**
 * models/index.js - Sequelize Models Index and Initialization
 *
 * Central model registry that initializes all Sequelize models and
 * establishes their associations for the Infinity Storm casino server.
 *
 * Features:
 * - Automatic model discovery and initialization
 * - Association setup between all models
 * - Database connection management
 * - Model validation and error handling
 * - Export of all models for use throughout the application
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Import database configuration
const dbConfig = require('../config/database');

// Create Sequelize instance
const sequelize = new Sequelize({
  host: dbConfig.config.host,
  port: dbConfig.config.port,
  database: dbConfig.config.database,
  username: dbConfig.config.user,
  password: dbConfig.config.password,
  dialect: 'postgres',

  // Connection pool settings
  pool: {
    max: dbConfig.config.max,
    min: dbConfig.config.min,
    idle: dbConfig.config.idleTimeoutMillis,
    acquire: dbConfig.config.connectionTimeoutMillis
  },

  // Logging settings
  logging: process.env.NODE_ENV === 'development' ? console.log : false,

  // SSL settings
  dialectOptions: {
    ssl: dbConfig.config.ssl
  },

  // Timezone settings
  timezone: '+00:00', // UTC

  // Additional options
  define: {
    timestamps: true,
    underscored: true, // Use snake_case for auto-generated fields
    freezeTableName: true, // Don't pluralize table names
    paranoid: false // Don't use soft deletes by default
  }
});

// Model storage
const models = {};

// Import all model files
const modelFiles = [
  'Player.js',
  'Session.js',
  'GameState.js',
  'SpinResult.js',
  'Transaction.js',
  'Jackpot.js',
  'JackpotContribution.js',
  'AdminLog.js',
  'RTPMetrics.js'
];

// Initialize models
modelFiles.forEach(file => {
  try {
    const ModelClass = require(path.join(__dirname, file));

    if (typeof ModelClass.init !== 'function') {
      throw new Error(`Model ${file} does not have an init method`);
    }

    // Initialize the model with sequelize instance
    const model = ModelClass.init(sequelize);

    // Store model in models object
    models[model.name] = model;

    console.log(`✓ Initialized model: ${model.name}`);
  } catch (error) {
    console.error(`✗ Failed to initialize model ${file}:`, error.message);
    throw error;
  }
});

// Setup associations between models
Object.keys(models).forEach(modelName => {
  const model = models[modelName];

  if (typeof model.associate === 'function') {
    try {
      model.associate(models);
      console.log(`✓ Associated model: ${modelName}`);
    } catch (error) {
      console.error(`✗ Failed to associate model ${modelName}:`, error.message);
      throw error;
    }
  }
});

// Test database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');

    // Test a simple query
    const result = await sequelize.query('SELECT NOW() as current_time', {
      type: Sequelize.QueryTypes.SELECT
    });

    console.log(`✓ Database query test successful. Current time: ${result[0].current_time}`);

    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
}

// Sync models with database (development only)
async function syncModels(force = false) {
  if (process.env.NODE_ENV === 'production' && force) {
    throw new Error('Cannot force sync in production environment');
  }

  try {
    console.log('Starting database sync...');

    // Sync all models
    await sequelize.sync({
      force,
      alter: !force, // Use alter if not forcing
      logging: console.log
    });

    console.log('✓ All models synchronized with database');
    return true;
  } catch (error) {
    console.error('✗ Database sync failed:', error.message);
    throw error;
  }
}

// Get model statistics
async function getModelStats() {
  const stats = {};

  for (const [modelName, model] of Object.entries(models)) {
    try {
      const count = await model.count();
      stats[modelName] = {
        table_name: model.tableName,
        record_count: count,
        attributes: Object.keys(model.rawAttributes),
        associations: Object.keys(model.associations || {})
      };
    } catch (error) {
      stats[modelName] = {
        error: error.message
      };
    }
  }

  return stats;
}

// Validate all models
async function validateModels() {
  const results = {};

  for (const [modelName, model] of Object.entries(models)) {
    try {
      // Test model creation with minimal valid data
      const testData = getTestData(modelName);

      if (testData) {
        // Validate without saving
        const instance = model.build(testData);
        await instance.validate();

        results[modelName] = {
          valid: true,
          message: 'Model validation passed'
        };
      } else {
        results[modelName] = {
          valid: true,
          message: 'No test data available, skipping validation'
        };
      }
    } catch (error) {
      results[modelName] = {
        valid: false,
        error: error.message
      };
    }
  }

  return results;
}

// Get minimal test data for model validation
function getTestData(modelName) {
  const testDataMap = {
    Player: {
      username: 'testuser',
      email: 'test@example.com',
      password_hash: '$2b$12$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
      credits: 1000.00
    },
    Session: {
      player_id: '123e4567-e89b-12d3-a456-426614174000',
      token_hash: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890',
      expires_at: new Date(Date.now() + 3600000) // 1 hour from now
    },
    GameState: {
      player_id: '123e4567-e89b-12d3-a456-426614174000',
      state_data: { test: true }
    },
    SpinResult: {
      player_id: '123e4567-e89b-12d3-a456-426614174000',
      bet_amount: 1.00,
      initial_grid: [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
        ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
        ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
        ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
        ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
        ['soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
      ],
      cascades: [],
      total_win: 0,
      rng_seed: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    },
    Transaction: {
      player_id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'bet',
      amount: -1.00,
      balance_before: 1000.00,
      balance_after: 999.00
    },
    Jackpot: {
      name: 'test_jackpot',
      seed_value: 1000.00,
      contribution_rate: 0.01
    },
    JackpotContribution: {
      jackpot_id: '123e4567-e89b-12d3-a456-426614174000',
      contribution_amount: 0.50
    },
    AdminLog: {
      action_type: 'balance_inquiry',
      details: { test: true }
    },
    RTPMetrics: {
      period_start: new Date(Date.now() - 86400000), // 24 hours ago
      period_end: new Date(),
      total_bets: 1000.00,
      total_wins: 965.00,
      spin_count: 100
    }
  };

  return testDataMap[modelName] || null;
}

// Cleanup function for graceful shutdown
async function cleanup() {
  try {
    await sequelize.close();
    console.log('✓ Database connection closed successfully');
  } catch (error) {
    console.error('✗ Error closing database connection:', error.message);
  }
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Export everything
module.exports = {
  // Sequelize instance
  sequelize,

  // Sequelize class for additional functionality
  Sequelize,

  // All models
  ...models,

  // Utility functions
  testConnection,
  syncModels,
  getModelStats,
  validateModels,
  cleanup,

  // Model registry
  models
};

// Log successful initialization
console.log(`✓ All ${Object.keys(models).length} models initialized and associated successfully`);