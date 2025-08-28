/**
 * Response Helper - Standardized API Response Formatting
 * 
 * Provides consistent response formatting across all API endpoints with:
 * - Standardized success/error response structure
 * - HTTP status code management
 * - Comprehensive error categorization
 * - Performance and debugging information
 * - Audit trail integration
 * 
 * Features:
 * - Consistent response format
 * - Automatic error logging
 * - Performance timing
 * - Request tracing
 * - Development vs production modes
 */

const { logger } = require('./logger');

class ResponseHelper {
    
    /**
     * Success response with data
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {Object} data - Response data
     * @param {Object} meta - Additional metadata
     */
    static success(res, message = 'Request successful', data = null, meta = {}) {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString(),
            ...meta
        };
        
        if (data !== null) {
            response.data = data;
        }
        
        // Add request ID if available
        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }
        
        // Add processing time if available
        if (res.locals.startTime) {
            response.processingTime = Date.now() - res.locals.startTime;
        }
        
        logger.debug('API success response', {
            message,
            hasData: data !== null,
            meta,
            requestId: res.locals.requestId
        });
        
        return res.status(200).json(response);
    }
    
    /**
     * Created response for resource creation
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {Object} data - Created resource data
     * @param {string} resourceId - ID of created resource
     */
    static created(res, message = 'Resource created successfully', data = null, resourceId = null) {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString()
        };
        
        if (data !== null) {
            response.data = data;
        }
        
        if (resourceId) {
            response.resourceId = resourceId;
            // Set Location header for created resource
            res.set('Location', `${res.req.originalUrl}/${resourceId}`);
        }
        
        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }
        
        if (res.locals.startTime) {
            response.processingTime = Date.now() - res.locals.startTime;
        }
        
        logger.info('API resource created', {
            message,
            resourceId,
            requestId: res.locals.requestId
        });
        
        return res.status(201).json(response);
    }
    
    /**
     * Bad request error (400)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static badRequest(res, message = 'Bad request', details = null) {
        return this._errorResponse(res, 400, 'BAD_REQUEST', message, details);
    }
    
    /**
     * Unauthorized error (401)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static unauthorized(res, message = 'Authentication required', details = null) {
        return this._errorResponse(res, 401, 'UNAUTHORIZED', message, details);
    }
    
    /**
     * Forbidden error (403)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static forbidden(res, message = 'Access forbidden', details = null) {
        return this._errorResponse(res, 403, 'FORBIDDEN', message, details);
    }
    
    /**
     * Not found error (404)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static notFound(res, message = 'Resource not found', details = null) {
        return this._errorResponse(res, 404, 'NOT_FOUND', message, details);
    }
    
    /**
     * Conflict error (409)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static conflict(res, message = 'Resource conflict', details = null) {
        return this._errorResponse(res, 409, 'CONFLICT', message, details);
    }
    
    /**
     * Validation error (422)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Array} validationErrors - Array of validation errors
     */
    static validationError(res, message = 'Validation failed', validationErrors = []) {
        const details = {
            validationErrors,
            errorCount: validationErrors.length
        };
        
        return this._errorResponse(res, 422, 'VALIDATION_ERROR', message, details);
    }
    
    /**
     * Too many requests error (429)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Rate limit details
     */
    static tooManyRequests(res, message = 'Rate limit exceeded', details = null) {
        // Set rate limit headers
        if (details && details.nextAllowedTime) {
            res.set('Retry-After', Math.ceil((details.nextAllowedTime - Date.now()) / 1000));
        }
        
        return this._errorResponse(res, 429, 'RATE_LIMIT_EXCEEDED', message, details);
    }
    
    /**
     * Internal server error (500)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static serverError(res, message = 'Internal server error', details = null) {
        return this._errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', message, details);
    }
    
    /**
     * Service unavailable error (503)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     */
    static serviceUnavailable(res, message = 'Service temporarily unavailable', details = null) {
        return this._errorResponse(res, 503, 'SERVICE_UNAVAILABLE', message, details);
    }
    
    /**
     * Not implemented error (501)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static notImplemented(res, message = 'Feature not implemented') {
        return this._errorResponse(res, 501, 'NOT_IMPLEMENTED', message);
    }
    
    /**
     * Game-specific error responses
     */
    
    /**
     * Insufficient credits error
     * @param {Object} res - Express response object
     * @param {number} availableCredits - Available credits
     * @param {number} requiredCredits - Required credits
     */
    static insufficientCredits(res, availableCredits, requiredCredits) {
        const details = {
            availableCredits,
            requiredCredits,
            shortfall: requiredCredits - availableCredits
        };
        
        return this._errorResponse(res, 400, 'INSUFFICIENT_CREDITS', 'Insufficient credits for this operation', details);
    }
    
    /**
     * Anti-cheat violation error
     * @param {Object} res - Express response object
     * @param {Array} violations - Detected violations
     * @param {number} riskScore - Risk assessment score
     */
    static antiCheatViolation(res, violations = [], riskScore = 0) {
        const details = {
            violations,
            riskScore,
            action: 'request_blocked'
        };
        
        return this._errorResponse(res, 403, 'ANTI_CHEAT_VIOLATION', 'Security violation detected', details);
    }
    
    /**
     * Game state error
     * @param {Object} res - Express response object
     * @param {string} currentState - Current game state
     * @param {string} requiredState - Required state for operation
     */
    static gameStateError(res, currentState, requiredState) {
        const details = {
            currentState,
            requiredState,
            action: 'state_transition_required'
        };
        
        return this._errorResponse(res, 400, 'INVALID_GAME_STATE', 'Operation not allowed in current game state', details);
    }
    
    /**
     * Session expired error
     * @param {Object} res - Express response object
     * @param {string} sessionId - Expired session ID
     */
    static sessionExpired(res, sessionId = null) {
        const details = sessionId ? { sessionId } : null;
        return this._errorResponse(res, 401, 'SESSION_EXPIRED', 'Session has expired', details);
    }
    
    /**
     * Maintenance mode error
     * @param {Object} res - Express response object
     * @param {string} estimatedEndTime - Estimated maintenance end time
     */
    static maintenanceMode(res, estimatedEndTime = null) {
        const details = {
            maintenanceMode: true,
            estimatedEndTime,
            message: 'Game is temporarily under maintenance'
        };
        
        return this._errorResponse(res, 503, 'MAINTENANCE_MODE', 'Service under maintenance', details);
    }
    
    /**
     * Generic error response builder
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} errorCode - Application error code
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     * @private
     */
    static _errorResponse(res, statusCode, errorCode, message, details = null) {
        const response = {
            success: false,
            error: {
                code: errorCode,
                message,
                statusCode
            },
            timestamp: new Date().toISOString()
        };
        
        // Add details if provided
        if (details) {
            response.error.details = details;
        }
        
        // Add request ID if available
        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }
        
        // Add processing time if available
        if (res.locals.startTime) {
            response.processingTime = Date.now() - res.locals.startTime;
        }
        
        // Add stack trace in development mode
        if (process.env.NODE_ENV === 'development' && details && details.stack) {
            response.error.stack = details.stack;
        }
        
        // Log error based on severity
        if (statusCode >= 500) {
            logger.error('API server error', {
                statusCode,
                errorCode,
                message,
                details,
                requestId: res.locals.requestId,
                url: res.req ? res.req.originalUrl : null,
                method: res.req ? res.req.method : null,
                userAgent: res.req ? res.req.get('User-Agent') : null,
                ip: res.req ? res.req.ip : null
            });
        } else if (statusCode >= 400) {
            logger.warn('API client error', {
                statusCode,
                errorCode,
                message,
                requestId: res.locals.requestId,
                url: res.req ? res.req.originalUrl : null
            });
        }
        
        return res.status(statusCode).json(response);
    }
    
    /**
     * Paginated response helper
     * @param {Object} res - Express response object
     * @param {Array} data - Response data array
     * @param {Object} pagination - Pagination metadata
     * @param {string} message - Success message
     */
    static paginated(res, data, pagination, message = 'Data retrieved successfully') {
        const response = {
            success: true,
            message,
            data,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 10,
                total: pagination.total || 0,
                totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
                hasNext: pagination.hasNext || false,
                hasPrev: pagination.hasPrev || false
            },
            timestamp: new Date().toISOString()
        };
        
        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }
        
        if (res.locals.startTime) {
            response.processingTime = Date.now() - res.locals.startTime;
        }
        
        return res.status(200).json(response);
    }
    
    /**
     * Health check response
     * @param {Object} res - Express response object
     * @param {Object} healthData - Health check data
     */
    static healthCheck(res, healthData) {
        const isHealthy = healthData.status === 'healthy' || healthData.status === 'operational';
        const statusCode = isHealthy ? 200 : 503;
        
        const response = {
            success: isHealthy,
            status: healthData.status,
            timestamp: new Date().toISOString(),
            ...healthData
        };
        
        return res.status(statusCode).json(response);
    }
}

module.exports = ResponseHelper;