const winston = require('winston');
const path = require('path');

/**
 * Winston Logger Configuration
 * Provides structured logging with multiple transports
 */

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = path.join(__dirname, '../../logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: fileFormat,
  defaultMeta: {
    service: 'infinity-storm-server',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  }));
}

/**
 * Log game event with structured data
 */
const logGameEvent = (event, playerId, data = {}) => {
  logger.info('Game event', {
    event,
    playerId,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Log security event
 */
const logSecurityEvent = (event, ip, userId = null, details = {}) => {
  logger.warn('Security event', {
    event,
    ip,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Log transaction event
 */
const logTransaction = (transactionId, playerId, type, amount, details = {}) => {
  logger.info('Transaction', {
    transactionId,
    playerId,
    type,
    amount,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Log API request
 */
const logApiRequest = (method, url, userId = null, duration = null, status = null) => {
  logger.info('API request', {
    method,
    url,
    userId,
    duration,
    status,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log database operation
 */
const logDatabaseOperation = (operation, table, rowsAffected = null, duration = null) => {
  logger.debug('Database operation', {
    operation,
    table,
    rowsAffected,
    duration,
    timestamp: new Date().toISOString()
  });
};

/**
 * Express middleware for request logging
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logApiRequest(
      req.method,
      req.originalUrl,
      req.user?.id || null,
      duration,
      res.statusCode
    );
  });
  
  next();
};

module.exports = {
  logger,
  logGameEvent,
  logSecurityEvent,
  logTransaction,
  logApiRequest,
  logDatabaseOperation,
  requestLogger
};