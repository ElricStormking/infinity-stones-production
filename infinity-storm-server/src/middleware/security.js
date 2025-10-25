/**
 * Security Middleware - Comprehensive Security Controls
 * 
 * Implements casino-grade security measures including:
 * - HTTPS enforcement
 * - Security headers (Helmet.js)
 * - CORS whitelist
 * - Request size limiting
 * - CSP (Content Security Policy)
 * - Rate limiting
 * - IP blocking
 * 
 * Production-ready security hardening for casino gaming platform.
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

// Environment-based configuration
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * HTTPS Enforcement Middleware
 * Redirects all HTTP requests to HTTPS in production
 */
const enforceHttps = (req, res, next) => {
  // Skip in development
  if (IS_DEVELOPMENT) {
    return next();
  }

  // Check if request is secure
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  
  if (!isSecure && IS_PRODUCTION) {
    logger.warn('Insecure HTTP request redirected to HTTPS', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('user-agent')
    });
    
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  
  next();
};

/**
 * Security Headers Configuration
 * Using Helmet.js for comprehensive header management
 */
const securityHeaders = IS_DEVELOPMENT
  ? helmet({
      // In development, disable CSP to avoid blocking Phaser/dev assets
      contentSecurityPolicy: false,
      hsts: false
    })
  : helmet({
      // HSTS (HTTP Strict Transport Security)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      
      // Content Security Policy (production)
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "blob:", "data:"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Phaser game engine
            "'unsafe-eval'",
            "https://cdn.jsdelivr.net",
            "blob:"
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            process.env.SUPABASE_URL || '',
            "https://api.infinitystorm.com",
            "https://cdn.jsdelivr.net",
            "wss:",
            "ws:"
          ].filter(Boolean),
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          childSrc: ["'self'", "blob:"],
          upgradeInsecureRequests: []
        }
      },
      
      // X-Frame-Options (Clickjacking protection)
      frameguard: {
        action: 'deny'
      },
      
      // X-Content-Type-Options
      noSniff: true,
      
      // X-XSS-Protection
      xssFilter: true,
      
      // Referrer-Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },
      
      // Permissions-Policy (formerly Feature-Policy)
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none'
      }
    });

/**
 * CORS Configuration with Whitelist
 * Strict origin validation for production
 */
const ALLOWED_ORIGINS = [
  'https://infinitystorm.com',
  'https://www.infinitystorm.com',
  'https://portal.infinitystorm.com',
  'https://admin.infinitystorm.com',
  ...(IS_DEVELOPMENT ? [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5500'
  ] : [])
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS policy violation', {
        attemptedOrigin: origin,
        timestamp: new Date().toISOString()
      });
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Demo-Bypass',
    'X-Session-ID'
  ],
  exposedHeaders: [
    'X-Payload-Bytes',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
};

/**
 * Global Rate Limiting
 * Prevents DDoS and automated abuse
 */
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 100 : 10000, // 10000 requests per 15 min in dev/testing
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and in development mode
    if (IS_DEVELOPMENT) return true;
    return req.path === '/health' || req.path === '/api/health';
  },
  handler: (req, res) => {
    logger.warn('Global rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again later.',
      retryAfter: 900 // 15 minutes in seconds
    });
  }
});

/**
 * API-Specific Rate Limiting
 * Stricter limits for sensitive endpoints
 */
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: IS_PRODUCTION ? 10 : 1000, // 1000 requests per minute in dev/testing
  message: {
    success: false,
    error: 'API_RATE_LIMIT_EXCEEDED',
    message: 'Too many API requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => IS_DEVELOPMENT, // Skip API rate limiting in development
  keyGenerator: (req) => {
    // Rate limit by player ID if authenticated, else by IP
    return req.user?.id || req.ip;
  }
});

/**
 * Spin Request Rate Limiting
 * Casino-specific throttling for spin requests
 */
const spinRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: IS_PRODUCTION ? 10 : 1000, // Max 1000 spins per minute in dev/testing
  message: {
    success: false,
    error: 'SPIN_RATE_LIMIT_EXCEEDED',
    message: 'You are spinning too fast. Please slow down for fair play.'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip in development mode or for demo spins
    if (IS_DEVELOPMENT) return true;
    return req.path.includes('/demo-spin');
  }
});

/**
 * Demo Spin Rate Limiting
 * More permissive for demo mode
 */
const demoSpinRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: IS_PRODUCTION ? 30 : 5000, // 5000 demo spins per minute in dev/testing
  message: {
    success: false,
    error: 'DEMO_RATE_LIMIT_EXCEEDED',
    message: 'Demo mode rate limit exceeded. Please wait before spinning again.'
  },
  skip: (req) => IS_DEVELOPMENT, // Skip demo rate limiting in development
  keyGenerator: (req) => req.ip
});

/**
 * Authentication Rate Limiting
 * Prevent brute-force attacks
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Account temporarily locked.'
  },
  handler: (req, res) => {
    logger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      username: req.body?.username,
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      success: false,
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * Request Size Validation
 * Prevent payload bomb attacks
 */
const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const MAX_SIZE = 10 * 1024; // 10KB
  
  if (contentLength > MAX_SIZE) {
    logger.warn('Request size exceeded limit', {
      ip: req.ip,
      contentLength,
      maxSize: MAX_SIZE,
      path: req.path
    });
    
    return res.status(413).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds maximum size limit.'
    });
  }
  
  next();
};

/**
 * IP Blacklist Middleware
 * Block known malicious IPs
 */
const ipBlacklist = new Set([
  // Add known malicious IPs here
  // This should be loaded from database/Redis in production
]);

const checkIpBlacklist = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (ipBlacklist.has(clientIp)) {
    logger.error('Blocked request from blacklisted IP', {
      ip: clientIp,
      path: req.path,
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Access denied.'
    });
  }
  
  next();
};

/**
 * Secure Cookie Configuration
 * HTTPS-only, SameSite strict
 */
const secureCookieConfig = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  domain: IS_PRODUCTION ? '.infinitystorm.com' : undefined
};

/**
 * Add Security Response Headers
 */
const addSecurityHeaders = (req, res, next) => {
  // Remove server fingerprinting
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add cache control for sensitive endpoints
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

/**
 * Request Logging for Security Audit
 */
const securityAuditLogger = (req, res, next) => {
  // Log sensitive operations
  const sensitiveEndpoints = ['/api/spin', '/api/withdraw', '/api/admin'];
  const isSensitive = sensitiveEndpoints.some(endpoint => req.path.includes(endpoint));
  
  if (isSensitive) {
    logger.info('Sensitive operation requested', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Export middleware functions
module.exports = {
  enforceHttps,
  securityHeaders,
  corsOptions,
  globalRateLimiter,
  apiRateLimiter,
  spinRateLimiter,
  demoSpinRateLimiter,
  authRateLimiter,
  validateRequestSize,
  checkIpBlacklist,
  secureCookieConfig,
  addSecurityHeaders,
  securityAuditLogger,
  ALLOWED_ORIGINS
};

