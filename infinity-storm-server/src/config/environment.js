/**
 * Environment Configuration
 * Central configuration management for all environments
 */

const path = require('path');

// Load environment variables
require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';

/**
 * Base configuration common to all environments
 */
const baseConfig = {
  environment,
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',

  // Application
  app: {
    name: 'Infinity Storm Server',
    version: process.env.npm_package_version || '1.0.0'
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    sessionSecret: process.env.SESSION_SECRET || 'default_session_secret_change_in_production',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    spinRateLimit: parseInt(process.env.SPIN_RATE_LIMIT_MAX) || 2
  },

  // Game Configuration
  game: {
    minBet: parseFloat(process.env.MIN_BET) || 0.40,
    maxBet: parseFloat(process.env.MAX_BET) || 2000.00,
    defaultCredits: parseFloat(process.env.DEFAULT_CREDITS) || 1000.00,
    rngSeedSalt: process.env.RNG_SEED_SALT || 'default_rng_salt_change_in_production'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    errorFilePath: process.env.LOG_ERROR_FILE_PATH || './logs/error.log'
  },

  // Admin
  admin: {
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'change_in_production',
    enabled: process.env.ENABLE_ADMIN_PANEL === 'true'
  },

  // Health Check
  healthCheck: {
    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    metricsEnabled: process.env.METRICS_ENABLED !== 'false'
  }
};

/**
 * Environment-specific configurations
 */
const environmentConfigs = {
  development: {
    ...baseConfig,

    // Database
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      name: process.env.DB_NAME || 'infinity_storm',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'password',
      ssl: false,
      poolMin: 2,
      poolMax: 10
    },

    // Redis
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0
    },

    // Supabase
    supabase: {
      url: process.env.SUPABASE_URL || 'http://localhost:54321',
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    },

    // Features
    features: {
      enableDetailedLogging: true,
      enableDebugEndpoints: true,
      enableHotReload: true
    }
  },

  staging: {
    ...baseConfig,

    // Database
    database: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      poolMin: 5,
      poolMax: 20
    },

    // Redis
    redis: {
      url: process.env.REDIS_URL,
      tls: process.env.REDIS_TLS === 'true'
    },

    // Enhanced security for staging
    security: {
      ...baseConfig.security,
      bcryptRounds: 14
    },

    // Rate limiting
    rateLimit: {
      ...baseConfig.rateLimit,
      maxRequests: 200
    },

    // Features
    features: {
      enableDetailedLogging: true,
      enableDebugEndpoints: false,
      enableHotReload: false
    }
  },

  production: {
    ...baseConfig,

    // Database
    database: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      poolMin: 10,
      poolMax: 50
    },

    // Redis
    redis: {
      url: process.env.REDIS_URL,
      tls: process.env.REDIS_TLS === 'true'
    },

    // Enhanced security for production
    security: {
      ...baseConfig.security,
      bcryptRounds: 15
    },

    // Stricter rate limiting
    rateLimit: {
      ...baseConfig.rateLimit,
      maxRequests: 150,
      spinRateLimit: 1
    },

    // Production logging
    logging: {
      ...baseConfig.logging,
      level: 'warn'
    },

    // Features
    features: {
      enableDetailedLogging: false,
      enableDebugEndpoints: false,
      enableHotReload: false
    }
  },

  test: {
    ...baseConfig,

    // Test database
    database: {
      host: 'localhost',
      port: 5432,
      name: 'infinity_storm_test',
      user: 'admin',
      password: 'password',
      ssl: false,
      poolMin: 1,
      poolMax: 5
    },

    // Test Redis
    redis: {
      host: 'localhost',
      port: 6379,
      db: 1 // Use different DB for tests
    },

    // Test-specific settings
    security: {
      ...baseConfig.security,
      bcryptRounds: 4 // Faster for tests
    },

    // Disable rate limiting for tests
    rateLimit: {
      windowMs: 1000,
      maxRequests: 1000,
      spinRateLimit: 100
    },

    // Test logging
    logging: {
      level: 'error' // Minimal logging during tests
    },

    // Features
    features: {
      enableDetailedLogging: false,
      enableDebugEndpoints: true,
      enableHotReload: false
    }
  }
};

// Get current environment configuration
const config = environmentConfigs[environment];

// Validation
const validateConfig = () => {
  const requiredVars = [
    'JWT_SECRET',
    'SESSION_SECRET'
  ];

  if (environment === 'production') {
    requiredVars.push(
      'DATABASE_URL',
      'REDIS_URL',
      'RNG_SEED_SALT',
      'ADMIN_DEFAULT_PASSWORD'
    );
  }

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0 && environment === 'production') {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  if (missingVars.length > 0 && environment !== 'production') {
    console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using default values - change these for production!');
  }
};

// Validate configuration on load
validateConfig();

module.exports = config;