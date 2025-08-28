/**
 * Session Manager for Game Server
 * 
 * Integrates JWT authentication with Sequelize Session model
 * Handles session persistence, validation, and cleanup
 */

const JWTAuth = require('./jwt');
const Session = require('../models/Session');
const Player = require('../models/Player');
const { getRedisClient } = require('../config/redis');

class SessionManager {
    constructor() {
        this.jwtAuth = JWTAuth;
    }

    /**
     * Create new authenticated session
     * @param {string} playerId - Player ID
     * @param {string|Object} accessTokenOrOptions - JWT access token or options for new token
     * @param {Object} sessionData - Additional session data
     * @returns {Promise<Object>} Session creation result
     */
    async createSession(playerId, accessTokenOrOptions = {}, sessionData = {}) {
        // Handle both old and new calling conventions
        let accessToken;
        let options = {};
        
        if (typeof accessTokenOrOptions === 'string') {
            // Old way: createSession(playerId, accessToken, sessionData)
            accessToken = accessTokenOrOptions;
        } else {
            // New way: createSession(playerId, options)
            options = accessTokenOrOptions;
            sessionData = options;
        }
        try {
            // Generate new token if not provided
            if (!accessToken) {
                const tokenPayload = {
                    player_id: playerId,
                    type: options.isAdminSession ? 'admin' : 'player'
                };
                accessToken = this.jwtAuth.generateAccessToken(tokenPayload);
            }

            // 1. Verify the access token
            const decoded = this.jwtAuth.verifyAccessToken(accessToken);
            if (decoded.player_id !== playerId) {
                throw new Error('Token player ID mismatch');
            }

            // 2. Get player data
            const player = await Player.findByPk(playerId, {
                attributes: { exclude: ['password_hash'] }
            });
            
            if (!player) {
                throw new Error('Player not found');
            }

            if (!player.isActive()) {
                throw new Error('Player account is not active');
            }

            // For admin sessions, verify admin privileges
            if (options.isAdminSession && !player.isAdmin()) {
                throw new Error('Player does not have admin privileges');
            }

            // 3. Store session in Redis (fast access)
            await this.jwtAuth.storeSession(playerId, accessToken, {
                ip_address: sessionData.ip_address,
                user_agent: sessionData.user_agent,
                player: player.getSafeData()
            });

            // 4. Create/update session in database (persistence)
            const tokenHash = this.jwtAuth.generateTokenHash(accessToken);
            
            // Admin sessions have longer expiry
            const sessionDuration = options.isAdminSession 
                ? (options.extendedExpiry ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000) // 30 days or 8 hours
                : (30 * 60 * 1000); // 30 minutes for regular sessions
                
            const expiresAt = new Date(Date.now() + sessionDuration);

            const dbSession = await Session.createSession({
                player_id: playerId,
                token: accessToken,
                ip_address: sessionData.ipAddress || sessionData.ip_address,
                user_agent: sessionData.userAgent || sessionData.user_agent,
                expiryMinutes: Math.floor(sessionDuration / (60 * 1000))
            });

            // 5. Update player's last login
            await player.updateLastLogin();

            return {
                success: true,
                token: accessToken,
                session: {
                    id: dbSession.id,
                    player_id: playerId,
                    expires_at: expiresAt,
                    created_at: dbSession.created_at,
                    is_admin_session: options.isAdminSession || false,
                    ip_address: sessionData.ipAddress || sessionData.ip_address,
                    last_activity_at: dbSession.created_at
                },
                player: player.getSafeData(),
                message: 'Session created successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate session and return player data
     * @param {string} accessToken - JWT access token
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Validation result
     */
    async validateSession(accessToken, options = {}) {
        try {
            // 1. Validate with JWT Auth (checks Redis cache)
            const validation = await this.jwtAuth.validateAccessToken(accessToken);
            
            if (!validation.valid) {
                return {
                    valid: false,
                    error: validation.error
                };
            }

            // 2. Verify against database session (double-check)
            const tokenHash = this.jwtAuth.generateTokenHash(accessToken);
            const dbSession = await Session.findByToken(accessToken);
            
            if (!dbSession || !dbSession.isValid()) {
                // Clean up Redis session if DB session is invalid
                await this.jwtAuth.invalidateSession(validation.player_id);
                return {
                    valid: false,
                    error: 'Database session not found or expired'
                };
            }

            // 3. Additional admin validation if required
            if (options.requireAdmin) {
                const player = await Player.findByPk(validation.player_id);
                if (!player || !player.isAdmin()) {
                    return {
                        valid: false,
                        error: 'Admin privileges required'
                    };
                }
            }

            // 4. IP consistency check for admin sessions
            if (options.checkIPConsistency && dbSession.ip_address) {
                // This would be implemented based on request IP
                // For now, just note that IP checking is available
            }

            // 3. Update activity in both Redis and DB
            await Promise.all([
                this.jwtAuth.updateActivity(validation.player_id),
                dbSession.updateActivity()
            ]);

            return {
                valid: true,
                player: validation.session.player || dbSession.player.getSafeData(),
                session: {
                    id: dbSession.id,
                    player_id: validation.player_id,
                    last_activity: new Date(),
                    expires_at: dbSession.expires_at,
                    needs_refresh: dbSession.needsRefresh()
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Refresh session with new token
     * @param {string} currentToken - Current access token
     * @param {string} newToken - New access token
     * @returns {Promise<Object>} Refresh result
     */
    async refreshSession(currentToken, newToken) {
        try {
            // 1. Validate current session
            const validation = await this.validateSession(currentToken);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'Current session is invalid'
                };
            }

            // 2. Verify new token
            const decoded = this.jwtAuth.verifyAccessToken(newToken);
            if (decoded.player_id !== validation.player.id) {
                return {
                    success: false,
                    error: 'Token player ID mismatch'
                };
            }

            // 3. Update Redis session with new token
            await this.jwtAuth.refreshSession(validation.player.id, newToken);

            // 4. Update database session
            const dbSession = await Session.findByToken(currentToken);
            if (dbSession) {
                await dbSession.refresh(newToken);
            }

            return {
                success: true,
                session: {
                    id: validation.session.id,
                    player_id: validation.player.id,
                    expires_at: new Date(Date.now() + (30 * 60 * 1000)),
                    refreshed_at: new Date()
                },
                message: 'Session refreshed successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * End session (logout)
     * @param {string} accessToken - JWT access token
     * @returns {Promise<Object>} Logout result
     */
    async endSession(accessToken) {
        try {
            // 1. Get session info before invalidating
            const decoded = this.jwtAuth.verifyAccessToken(accessToken);
            const playerId = decoded.player_id;

            // 2. Invalidate Redis session
            await this.jwtAuth.invalidateSession(playerId);

            // 3. Deactivate database session
            const dbSession = await Session.findByToken(accessToken);
            if (dbSession) {
                await dbSession.deactivate('User logout');
            }

            return {
                success: true,
                message: 'Session ended successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get session information
     * @param {string} accessToken - JWT access token
     * @returns {Promise<Object>} Session info
     */
    async getSessionInfo(accessToken) {
        try {
            const validation = await this.validateSession(accessToken);
            
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // Get additional session stats
            const redisSession = await this.jwtAuth.getSession(validation.player.id);
            const dbSession = await Session.findByToken(accessToken);

            return {
                success: true,
                session: {
                    id: validation.session.id,
                    player: validation.player,
                    created_at: dbSession?.created_at,
                    last_activity: validation.session.last_activity,
                    expires_at: validation.session.expires_at,
                    time_remaining_minutes: dbSession?.getTimeRemaining() || 0,
                    session_duration_minutes: dbSession?.getSessionDuration() || 0,
                    needs_refresh: validation.session.needs_refresh,
                    ip_address: redisSession?.ip_address,
                    user_agent: redisSession?.user_agent
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Force end all sessions for a player (admin function)
     * @param {string} playerId - Player ID
     * @param {string} reason - Reason for ending sessions
     * @returns {Promise<Object>} Result
     */
    async endAllPlayerSessions(playerId, reason = 'Admin forced logout') {
        try {
            // 1. Invalidate Redis session
            await this.jwtAuth.invalidateSession(playerId);

            // 2. Deactivate all database sessions
            const deactivatedCount = await Session.deactivatePlayerSessions(playerId, reason);

            return {
                success: true,
                sessions_ended: deactivatedCount,
                message: `All sessions ended for player ${playerId}`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all active sessions (admin function)
     * @returns {Promise<Array>} Active sessions
     */
    async getAllActiveSessions() {
        try {
            // Get from both Redis (current) and DB (persistent)
            const [redisSessions, dbSessions] = await Promise.all([
                this.jwtAuth.getActiveSessions(),
                Session.scope('active').findAll({
                    include: [{
                        model: Player,
                        as: 'player',
                        attributes: { exclude: ['password_hash'] }
                    }],
                    order: [['created_at', 'DESC']]
                })
            ]);

            // Combine and deduplicate
            const sessionMap = new Map();
            
            // Add DB sessions
            dbSessions.forEach(session => {
                sessionMap.set(session.player_id, {
                    ...session.getSafeData(),
                    player: session.player.getSafeData(),
                    source: 'database'
                });
            });

            // Update with Redis data (more current)
            redisSessions.forEach(session => {
                if (sessionMap.has(session.player_id)) {
                    const existing = sessionMap.get(session.player_id);
                    sessionMap.set(session.player_id, {
                        ...existing,
                        last_activity: session.last_activity,
                        expires_at: session.expires_at,
                        ip_address: session.ip_address,
                        user_agent: session.user_agent,
                        source: 'redis+database'
                    });
                } else {
                    sessionMap.set(session.player_id, {
                        ...session,
                        source: 'redis'
                    });
                }
            });

            return Array.from(sessionMap.values());

        } catch (error) {
            throw new Error(`Failed to get active sessions: ${error.message}`);
        }
    }

    /**
     * Cleanup expired sessions (maintenance)
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupExpiredSessions() {
        try {
            const [redisCleanedUp, dbCleanedUp] = await Promise.all([
                this.jwtAuth.cleanupExpiredSessions(),
                Session.cleanupExpiredSessions()
            ]);

            return {
                success: true,
                redis_cleaned: redisCleanedUp,
                database_cleaned: dbCleanedUp,
                total_cleaned: redisCleanedUp + dbCleanedUp
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get session statistics
     * @returns {Promise<Object>} Session statistics
     */
    async getSessionStats() {
        try {
            const [activeSessions, dbStats] = await Promise.all([
                this.getAllActiveSessions(),
                Session.getSessionStats()
            ]);

            return {
                active_sessions: activeSessions.length,
                database_stats: dbStats,
                by_source: {
                    redis_only: activeSessions.filter(s => s.source === 'redis').length,
                    database_only: activeSessions.filter(s => s.source === 'database').length,
                    synchronized: activeSessions.filter(s => s.source === 'redis+database').length
                }
            };

        } catch (error) {
            throw new Error(`Failed to get session stats: ${error.message}`);
        }
    }

    /**
     * Extend session expiry (admin function)
     * @param {string} sessionId - Session ID
     * @param {number} additionalMinutes - Additional minutes to add
     * @returns {Promise<Object>} Extension result
     */
    async extendSession(sessionId, additionalMinutes = 60) {
        try {
            const dbSession = await Session.findByPk(sessionId);
            if (!dbSession) {
                return {
                    success: false,
                    error: 'Session not found'
                };
            }

            if (!dbSession.isValid()) {
                return {
                    success: false,
                    error: 'Session is already expired'
                };
            }

            // Extend the session
            const newExpiresAt = new Date(dbSession.expires_at.getTime() + (additionalMinutes * 60 * 1000));
            await dbSession.update({ expires_at: newExpiresAt });

            // Update Redis cache if exists
            const decoded = this.jwtAuth.verifyAccessToken(dbSession.token);
            if (decoded) {
                await this.jwtAuth.extendSession(decoded.player_id, additionalMinutes);
            }

            return {
                success: true,
                expires_at: newExpiresAt,
                extended_by_minutes: additionalMinutes,
                message: 'Session extended successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Terminate specific session by ID (admin function)
     * @param {string} sessionId - Session ID
     * @param {string} reason - Reason for termination
     * @returns {Promise<Object>} Termination result
     */
    async terminateSession(sessionId, reason = 'Admin terminated session') {
        try {
            const dbSession = await Session.findByPk(sessionId);
            if (!dbSession) {
                return {
                    success: false,
                    error: 'Session not found'
                };
            }

            // Deactivate database session
            await dbSession.deactivate(reason);

            // Clear Redis session
            const decoded = this.jwtAuth.verifyAccessToken(dbSession.token);
            if (decoded) {
                await this.jwtAuth.invalidateSession(decoded.player_id);
            }

            return {
                success: true,
                message: 'Session terminated successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new SessionManager();