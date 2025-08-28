/**
 * Authentication Controller for Game Server
 * 
 * Handles session validation, refresh, and management
 * Portal-first architecture: validates pre-authenticated sessions
 */

const SessionManager = require('../auth/sessionManager');
const JWTAuth = require('../auth/jwt');
const Player = require('../models/Player');
const Session = require('../models/Session');
const { logger } = require("../utils/logger.js");
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const transactionLogger = require('../services/transactionLogger');

// Create direct database connection for auth operations
const dbPool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 54322,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: false
});

class AuthController {
    /**
     * Validate existing session (main endpoint for game client)
     * POST /api/auth/validate
     */
    async validateSession(req, res) {
        try {
            const { token } = req.body;
            
            if (!token) {
                return res.status(400).json({
                    error: 'Token required',
                    code: 'MISSING_TOKEN',
                    message: 'Access token is required for validation'
                });
            }

            const validation = await SessionManager.validateSession(token);
            
            if (!validation.valid) {
                return res.status(401).json({
                    error: 'Session invalid',
                    code: 'INVALID_SESSION',
                    message: validation.error
                });
            }

            logger.info('Session validated successfully', {
                player_id: validation.player.id,
                username: validation.player.username,
                ip: req.ip
            });

            res.json({
                success: true,
                player: validation.player,
                session: validation.session,
                message: 'Session is valid'
            });

        } catch (error) {
            logger.error('Session validation error', {
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Validation service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to validate session'
            });
        }
    }

    /**
     * Create new session from portal authentication
     * POST /api/auth/session
     */
    async createSession(req, res) {
        try {
            const { token, ip_address, user_agent } = req.body;
            
            if (!token) {
                return res.status(400).json({
                    error: 'Token required',
                    code: 'MISSING_TOKEN',
                    message: 'Access token is required to create session'
                });
            }

            // Verify token and extract player ID
            let decoded;
            try {
                decoded = JWTAuth.verifyAccessToken(token);
            } catch (error) {
                return res.status(401).json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN',
                    message: 'Provided token is invalid or expired'
                });
            }

            const sessionResult = await SessionManager.createSession(
                decoded.player_id,
                token,
                {
                    ip_address: ip_address || req.ip,
                    user_agent: user_agent || req.get('User-Agent')
                }
            );

            if (!sessionResult.success) {
                return res.status(400).json({
                    error: 'Session creation failed',
                    code: 'SESSION_CREATION_ERROR',
                    message: sessionResult.error
                });
            }

            logger.info('Session created successfully', {
                player_id: decoded.player_id,
                session_id: sessionResult.session.id,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                session: sessionResult.session,
                message: sessionResult.message
            });

        } catch (error) {
            logger.error('Session creation error', {
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Session service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to create session'
            });
        }
    }

    /**
     * Refresh session with new token
     * POST /api/auth/refresh
     */
    async refreshSession(req, res) {
        try {
            const { current_token, new_token } = req.body;
            
            if (!current_token || !new_token) {
                return res.status(400).json({
                    error: 'Tokens required',
                    code: 'MISSING_TOKENS',
                    message: 'Both current and new tokens are required'
                });
            }

            const refreshResult = await SessionManager.refreshSession(current_token, new_token);
            
            if (!refreshResult.success) {
                return res.status(400).json({
                    error: 'Session refresh failed',
                    code: 'REFRESH_ERROR',
                    message: refreshResult.error
                });
            }

            logger.info('Session refreshed successfully', {
                player_id: refreshResult.session.player_id,
                session_id: refreshResult.session.id
            });

            res.json({
                success: true,
                session: refreshResult.session,
                message: refreshResult.message
            });

        } catch (error) {
            logger.error('Session refresh error', {
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                error: 'Refresh service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to refresh session'
            });
        }
    }

    /**
     * End current session (logout)
     * POST /api/auth/logout
     */
    async logout(req, res) {
        try {
            // Token is extracted from middleware
            const token = req.token;
            
            if (!token) {
                return res.status(400).json({
                    error: 'No active session',
                    code: 'NO_SESSION',
                    message: 'No session to logout from'
                });
            }

            const logoutResult = await SessionManager.endSession(token);
            
            if (!logoutResult.success) {
                return res.status(400).json({
                    error: 'Logout failed',
                    code: 'LOGOUT_ERROR',
                    message: logoutResult.error
                });
            }

            logger.info('Session ended successfully', {
                player_id: req.user?.id,
                username: req.user?.username,
                ip: req.ip
            });

            res.json({
                success: true,
                message: logoutResult.message
            });

        } catch (error) {
            logger.error('Logout error', {
                error: error.message,
                stack: error.stack,
                player_id: req.user?.id
            });

            res.status(500).json({
                error: 'Logout service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to complete logout'
            });
        }
    }

    /**
     * Get current session information
     * GET /api/auth/session
     */
    async getSessionInfo(req, res) {
        try {
            const token = req.token;
            
            const sessionInfo = await SessionManager.getSessionInfo(token);
            
            if (!sessionInfo.success) {
                return res.status(400).json({
                    error: 'Session info unavailable',
                    code: 'SESSION_ERROR',
                    message: sessionInfo.error
                });
            }

            res.json({
                success: true,
                session: sessionInfo.session
            });

        } catch (error) {
            logger.error('Get session info error', {
                error: error.message,
                player_id: req.user?.id
            });

            res.status(500).json({
                error: 'Session service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to get session information'
            });
        }
    }

    /**
     * Check authentication status (health check)
     * GET /api/auth/status
     */
    async checkStatus(req, res) {
        try {
            const authenticated = !!req.user;
            
            res.json({
                authenticated,
                player: authenticated ? req.user : null,
                session: authenticated ? req.session_info : null,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Auth status check error', {
                error: error.message
            });

            res.status(500).json({
                error: 'Status service error',
                code: 'SERVICE_ERROR'
            });
        }
    }

    /**
     * Admin: Get all active sessions
     * GET /api/auth/admin/sessions
     */
    async getActiveSessions(req, res) {
        try {
            const sessions = await SessionManager.getAllActiveSessions();
            
            res.json({
                success: true,
                sessions,
                count: sessions.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Get active sessions error', {
                error: error.message,
                admin_id: req.user?.id
            });

            res.status(500).json({
                error: 'Sessions service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to retrieve active sessions'
            });
        }
    }

    /**
     * Admin: Force logout a player
     * POST /api/auth/admin/force-logout
     */
    async forceLogout(req, res) {
        try {
            const { player_id, reason } = req.body;
            
            if (!player_id) {
                return res.status(400).json({
                    error: 'Player ID required',
                    code: 'MISSING_PLAYER_ID',
                    message: 'Player ID is required for forced logout'
                });
            }

            const result = await SessionManager.endAllPlayerSessions(
                player_id,
                reason || `Forced logout by admin ${req.user.username}`
            );

            if (!result.success) {
                return res.status(400).json({
                    error: 'Force logout failed',
                    code: 'FORCE_LOGOUT_ERROR',
                    message: result.error
                });
            }

            logger.warn('Admin forced player logout', {
                admin_id: req.user.id,
                admin_username: req.user.username,
                target_player_id: player_id,
                reason: reason,
                sessions_ended: result.sessions_ended
            });

            res.json({
                success: true,
                sessions_ended: result.sessions_ended,
                message: result.message
            });

        } catch (error) {
            logger.error('Force logout error', {
                error: error.message,
                admin_id: req.user?.id,
                target_player_id: req.body?.player_id
            });

            res.status(500).json({
                error: 'Force logout service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to complete forced logout'
            });
        }
    }

    /**
     * Admin: Get session statistics
     * GET /api/auth/admin/stats
     */
    async getSessionStats(req, res) {
        try {
            const stats = await SessionManager.getSessionStats();
            
            res.json({
                success: true,
                stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Get session stats error', {
                error: error.message,
                admin_id: req.user?.id
            });

            res.status(500).json({
                error: 'Stats service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to retrieve session statistics'
            });
        }
    }

    /**
     * Admin: Cleanup expired sessions
     * POST /api/auth/admin/cleanup
     */
    async cleanupSessions(req, res) {
        try {
            const cleanup = await SessionManager.cleanupExpiredSessions();
            
            logger.info('Session cleanup completed', {
                admin_id: req.user.id,
                redis_cleaned: cleanup.redis_cleaned,
                database_cleaned: cleanup.database_cleaned,
                total_cleaned: cleanup.total_cleaned
            });

            res.json({
                success: true,
                cleanup,
                message: 'Session cleanup completed'
            });

        } catch (error) {
            logger.error('Session cleanup error', {
                error: error.message,
                admin_id: req.user?.id
            });

            res.status(500).json({
                error: 'Cleanup service error',
                code: 'SERVICE_ERROR',
                message: 'Unable to complete session cleanup'
            });
        }
    }
    /**
     * Register a new player account
     * POST /api/auth/register
     */
    async register(req, res) {
        const client = await dbPool.connect();
        try {
            const { username, email, password } = req.body;
            
            // Check if player already exists
            const checkQuery = `
                SELECT id, username, email 
                FROM players 
                WHERE username = $1 OR email = $2
            `;
            const checkResult = await client.query(checkQuery, [username, email]);
            
            if (checkResult.rows.length > 0) {
                const existingPlayer = checkResult.rows[0];
                const field = existingPlayer.username === username ? 'username' : 'email';
                return res.status(409).json({
                    error: 'Registration failed',
                    code: 'USER_EXISTS',
                    message: `This ${field} is already registered`
                });
            }
            
            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);
            
            // Create new player
            const insertQuery = `
                INSERT INTO players (
                    username, email, password_hash, credits, 
                    is_demo, is_admin, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING id, username, email, credits
            `;
            
            const insertResult = await client.query(insertQuery, [
                username,
                email,
                passwordHash,
                1000.00, // Starting credits
                false, // is_demo
                false, // is_admin
                'active'
            ]);
            
            const player = insertResult.rows[0];
            
            // Log registration bonus transaction for regulatory compliance
            try {
                await transactionLogger.logRegistrationBonus(
                    player.id,
                    1000.00,
                    {
                        ip_address: req.ip,
                        user_agent: req.get('User-Agent'),
                        registration_method: 'direct'
                    }
                );
                console.log(`💰 Registration bonus logged for player ${player.username}: +$1000`);
            } catch (transactionError) {
                console.error('Registration bonus transaction logging failed:', transactionError.message);
                // Continue with registration even if transaction logging fails
            }
            
            // Generate JWT token
            const token = JWTAuth.generateAccessToken({
                player_id: player.id,
                username: player.username,
                is_demo: false
            });
            
            // Create session
            const sessionQuery = `
                INSERT INTO sessions (
                    player_id, token_hash, ip_address, user_agent, 
                    is_active, created_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '24 hours')
                RETURNING id, expires_at
            `;
            
            const sessionResult = await client.query(sessionQuery, [
                player.id,
                await bcrypt.hash(token, 5), // Hash token for storage
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'],
                true
            ]);
            
            logger.info('New player registered', {
                player_id: player.id,
                username: player.username,
                email: player.email,
                ip: req.ip
            });
            
            res.status(201).json({
                success: true,
                message: 'Registration successful',
                player: {
                    id: player.id,
                    username: player.username,
                    email: player.email,
                    credits: player.credits
                },
                session: {
                    id: sessionResult.rows[0].id,
                    expires_at: sessionResult.rows[0].expires_at
                },
                token
            });
            
        } catch (error) {
            logger.error('Registration error', {
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });
            
            res.status(500).json({
                error: 'Registration failed',
                code: 'REGISTRATION_ERROR',
                message: 'Unable to complete registration'
            });
        } finally {
            client.release();
        }
    }
    
    /**
     * Login with username/email and password
     * POST /api/auth/login
     */
    async login(req, res) {
        const client = await dbPool.connect();
        try {
            const { username, password } = req.body;
            
            // Find player by username or email
            const findQuery = `
                SELECT id, username, email, password_hash, credits, 
                       is_demo, is_admin, status
                FROM players 
                WHERE username = $1 OR email = $1
            `;
            const findResult = await client.query(findQuery, [username]);
            
            if (findResult.rows.length === 0) {
                return res.status(401).json({
                    error: 'Authentication failed',
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                });
            }
            
            const player = findResult.rows[0];
            
            // Check if player is active
            if (player.status !== 'active') {
                return res.status(403).json({
                    error: 'Account restricted',
                    code: 'ACCOUNT_RESTRICTED',
                    message: `Your account is ${player.status}. Please contact support.`
                });
            }
            
            // Verify password
            const isValidPassword = await bcrypt.compare(password, player.password_hash);
            
            if (!isValidPassword) {
                logger.warn('Failed login attempt', {
                    username: player.username,
                    ip: req.ip
                });
                
                return res.status(401).json({
                    error: 'Authentication failed',
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                });
            }
            
            // Generate JWT token
            const token = JWTAuth.generateAccessToken({
                player_id: player.id,
                username: player.username,
                is_demo: player.is_demo,
                is_admin: player.is_admin
            });
            
            // Create new session (delete old ones first)
            await client.query(`DELETE FROM sessions WHERE player_id = $1`, [player.id]);
            
            const sessionQuery = `
                INSERT INTO sessions (
                    player_id, token_hash, ip_address, user_agent,
                    is_active, created_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '24 hours')
                RETURNING id, expires_at
            `;
            
            const sessionResult = await client.query(sessionQuery, [
                player.id,
                await bcrypt.hash(token, 5), // Hash token for storage
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'],
                true
            ]);
            
            // Update last login
            const updateQuery = `
                UPDATE players 
                SET last_login_at = NOW()
                WHERE id = $1
            `;
            await client.query(updateQuery, [player.id]);
            
            logger.info('Player login successful', {
                player_id: player.id,
                username: player.username,
                ip: req.ip
            });
            
            res.json({
                success: true,
                message: 'Login successful',
                player: {
                    id: player.id,
                    username: player.username,
                    email: player.email,
                    credits: parseFloat(player.credits),
                    is_admin: player.is_admin
                },
                session: {
                    id: sessionResult.rows[0].id,
                    expires_at: sessionResult.rows[0].expires_at
                },
                token
            });
            
        } catch (error) {
            logger.error('Login error', {
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });
            
            res.status(500).json({
                error: 'Login failed',
                code: 'LOGIN_ERROR',
                message: 'Unable to complete login'
            });
        } finally {
            client.release();
        }
    }
}

module.exports = new AuthController();