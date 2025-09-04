const Redis = require('ioredis');

/**
 * Redis Configuration
 * Handles Redis connection and configuration for sessions and caching
 */

const config = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  },
  staging: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  },
  production: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxLoadingTimeout: 5000
  }
};

const environment = process.env.NODE_ENV || 'development';
let redisClient;

/**
 * Initialize Redis connection
 */
const initializeRedis = () => {
  if (!redisClient) {
    const redisConfig = config[environment];

    // Handle Redis URL if provided
    if (process.env.REDIS_URL && environment !== 'development') {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });
    } else {
      redisClient = new Redis(redisConfig);
    }

    redisClient.on('connect', () => {
      console.log('Connected to Redis server');
    });

    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error.message);
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('Reconnecting to Redis...');
    });
  }

  return redisClient;
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
  if (!redisClient) {
    initializeRedis();
  }
  return redisClient;
};

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis client closed');
  }
};

/**
 * Test Redis connection
 */
const testConnection = async () => {
  try {
    const client = getRedisClient();
    await client.ping();
    console.log('Redis connection successful');
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    return false;
  }
};

/**
 * Session store configuration for connect-redis
 */
const getSessionStore = () => {
  const { default: RedisStore } = require('connect-redis');
  return new RedisStore({
    client: getRedisClient(),
    prefix: 'sess:',
    ttl: 86400 // 24 hours in seconds
  });
};

module.exports = {
  initializeRedis,
  getRedisClient,
  closeRedis,
  testConnection,
  getSessionStore,
  config
};