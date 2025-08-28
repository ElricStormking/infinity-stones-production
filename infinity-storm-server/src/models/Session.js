/**
 * Session.js - Sequelize Model for Sessions Table
 * 
 * Manages player sessions with single active session enforcement,
 * automatic cleanup of expired sessions, and comprehensive session tracking.
 * 
 * Features:
 * - Single active session per player enforcement
 * - Automatic session expiration handling
 * - IP address and user agent tracking for security
 * - Token hash storage for JWT validation
 * - Session activity monitoring
 * - Automatic cleanup hooks
 */

const { DataTypes, Model } = require('sequelize');
const crypto = require('crypto');

class Session extends Model {
    /**
     * Initialize the Session model with database connection
     */
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: 'Unique session identifier'
            },
            
            player_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'players',
                    key: 'id'
                },
                onDelete: 'CASCADE',
                comment: 'Reference to player who owns this session'
            },
            
            token_hash: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: {
                    name: 'unique_token_hash',
                    msg: 'Token hash already exists'
                },
                validate: {
                    notEmpty: {
                        msg: 'Token hash cannot be empty'
                    },
                    len: {
                        args: [32, 255],
                        msg: 'Token hash must be between 32 and 255 characters'
                    }
                },
                comment: 'SHA-256 hash of JWT token for validation'
            },
            
            ip_address: {
                type: DataTypes.INET,
                allowNull: true,
                validate: {
                    isIP: {
                        msg: 'Must be a valid IP address'
                    }
                },
                comment: 'IP address of the client session'
            },
            
            user_agent: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Browser user agent string for device tracking'
            },
            
            last_activity: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: 'Timestamp of last activity in this session'
            },
            
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
                validate: {
                    isDate: {
                        msg: 'Expiry must be a valid date'
                    },
                    isAfter: {
                        args: new Date().toISOString(),
                        msg: 'Expiry date must be in the future'
                    }
                },
                comment: 'Session expiration timestamp'
            },
            
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Whether this session is currently active'
            }
        }, {
            sequelize,
            modelName: 'Session',
            tableName: 'sessions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false, // We handle last_activity manually
            
            indexes: [
                {
                    unique: true,
                    fields: ['player_id'],
                    where: {
                        is_active: true
                    },
                    name: 'idx_one_active_session_per_player'
                },
                {
                    unique: true,
                    fields: ['token_hash']
                },
                {
                    fields: ['expires_at'],
                    where: {
                        is_active: true
                    }
                },
                {
                    fields: ['last_activity'],
                    where: {
                        is_active: true
                    }
                },
                {
                    fields: ['player_id', 'is_active']
                }
            ],
            
            hooks: {
                beforeCreate: async (session) => {
                    // Deactivate any existing active sessions for this player
                    await Session.update(
                        { is_active: false },
                        { 
                            where: { 
                                player_id: session.player_id,
                                is_active: true
                            }
                        }
                    );
                },
                
                beforeBulkCreate: async (sessions) => {
                    // Handle bulk creation by ensuring single active session per player
                    const playerIds = [...new Set(sessions.map(s => s.player_id))];
                    
                    for (const playerId of playerIds) {
                        await Session.update(
                            { is_active: false },
                            { 
                                where: { 
                                    player_id: playerId,
                                    is_active: true
                                }
                            }
                        );
                    }
                },
                
                afterCreate: async (session) => {
                    // Clean up expired sessions after creating new one
                    await Session.cleanupExpiredSessions();
                },
                
                afterUpdate: async (session) => {
                    // Clean up expired sessions after updates
                    if (session.changed('is_active') || session.changed('expires_at')) {
                        await Session.cleanupExpiredSessions();
                    }
                }
            },
            
            scopes: {
                active: {
                    where: {
                        is_active: true,
                        expires_at: {
                            [sequelize.Sequelize.Op.gt]: new Date()
                        }
                    }
                },
                
                expired: {
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            { is_active: false },
                            { expires_at: { [sequelize.Sequelize.Op.lt]: new Date() } }
                        ]
                    }
                },
                
                forPlayer: (playerId) => ({
                    where: {
                        player_id: playerId
                    }
                })
            }
        });
    }
    
    /**
     * Define associations with other models
     */
    static associate(models) {
        // Session belongs to a player
        Session.belongsTo(models.Player, {
            foreignKey: 'player_id',
            as: 'player',
            onDelete: 'CASCADE'
        });
        
        // Session has many game states
        Session.hasMany(models.GameState, {
            foreignKey: 'session_id',
            as: 'gameStates'
        });
        
        // Session has many spin results
        Session.hasMany(models.SpinResult, {
            foreignKey: 'session_id',
            as: 'spinResults'
        });
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Check if session is currently active and not expired
     * @returns {boolean} True if session is active and valid
     */
    isValid() {
        return this.is_active && new Date() < new Date(this.expires_at);
    }
    
    /**
     * Check if session is expired
     * @returns {boolean} True if session is expired
     */
    isExpired() {
        return new Date() >= new Date(this.expires_at);
    }
    
    /**
     * Update session activity timestamp
     * @param {Date} timestamp - Optional timestamp (defaults to now)
     */
    async updateActivity(timestamp = new Date()) {
        this.last_activity = timestamp;
        await this.save({ fields: ['last_activity'] });
    }
    
    /**
     * Extend session expiry time
     * @param {number} extensionMinutes - Minutes to extend (default 30)
     */
    async extendExpiry(extensionMinutes = 30) {
        const newExpiry = new Date(Date.now() + (extensionMinutes * 60 * 1000));
        this.expires_at = newExpiry;
        await this.save({ fields: ['expires_at'] });
    }
    
    /**
     * Deactivate this session
     * @param {string} reason - Optional reason for deactivation
     */
    async deactivate(reason = 'Session manually deactivated') {
        this.is_active = false;
        await this.save({ fields: ['is_active'] });
        
        console.log(`Session ${this.id} deactivated: ${reason}`);
    }
    
    /**
     * Generate token hash from JWT token
     * @param {string} token - JWT token
     * @returns {string} SHA-256 hash of token
     */
    static generateTokenHash(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    
    /**
     * Refresh session with new token and extended expiry
     * @param {string} newToken - New JWT token
     * @param {number} extensionMinutes - Minutes to extend expiry
     */
    async refresh(newToken, extensionMinutes = 30) {
        this.token_hash = Session.generateTokenHash(newToken);
        this.last_activity = new Date();
        this.expires_at = new Date(Date.now() + (extensionMinutes * 60 * 1000));
        
        await this.save({ 
            fields: ['token_hash', 'last_activity', 'expires_at'] 
        });
    }
    
    /**
     * Get session duration in minutes
     * @returns {number} Session duration in minutes
     */
    getSessionDuration() {
        const start = new Date(this.created_at);
        const end = this.isValid() ? new Date() : new Date(this.last_activity);
        return Math.floor((end - start) / (1000 * 60));
    }
    
    /**
     * Get time remaining until expiry in minutes
     * @returns {number} Minutes remaining (0 if expired)
     */
    getTimeRemaining() {
        const now = new Date();
        const expiry = new Date(this.expires_at);
        
        if (now >= expiry) return 0;
        
        return Math.floor((expiry - now) / (1000 * 60));
    }
    
    /**
     * Check if session needs refresh (less than 5 minutes remaining)
     * @returns {boolean} True if session should be refreshed
     */
    needsRefresh() {
        return this.isValid() && this.getTimeRemaining() < 5;
    }
    
    /**
     * Get safe session data for client (excludes sensitive fields)
     * @returns {Object} Safe session data
     */
    getSafeData() {
        return {
            id: this.id,
            player_id: this.player_id,
            last_activity: this.last_activity,
            expires_at: this.expires_at,
            is_active: this.is_active,
            created_at: this.created_at,
            session_duration_minutes: this.getSessionDuration(),
            time_remaining_minutes: this.getTimeRemaining(),
            needs_refresh: this.needsRefresh()
        };
    }
    
    /**
     * Static Methods
     */
    
    /**
     * Create a new session for a player
     * @param {Object} sessionData - Session data
     * @returns {Session} Created session instance
     */
    static async createSession({
        player_id,
        token,
        ip_address = null,
        user_agent = null,
        expiryMinutes = 30
    }) {
        const token_hash = Session.generateTokenHash(token);
        const expires_at = new Date(Date.now() + (expiryMinutes * 60 * 1000));
        
        return await Session.create({
            player_id,
            token_hash,
            ip_address,
            user_agent,
            expires_at,
            last_activity: new Date(),
            is_active: true
        });
    }
    
    /**
     * Find session by token hash
     * @param {string} token - JWT token
     * @returns {Session|null} Session instance or null
     */
    static async findByToken(token) {
        const token_hash = Session.generateTokenHash(token);
        
        return await Session.findOne({
            where: {
                token_hash,
                is_active: true,
                expires_at: {
                    [Session.sequelize.Sequelize.Op.gt]: new Date()
                }
            },
            include: [{
                model: Session.sequelize.models.Player,
                as: 'player',
                attributes: {
                    exclude: ['password_hash']
                }
            }]
        });
    }
    
    /**
     * Get active session for a player
     * @param {string} playerId - Player ID
     * @returns {Session|null} Active session or null
     */
    static async getActiveSession(playerId) {
        return await Session.findOne({
            where: {
                player_id: playerId,
                is_active: true,
                expires_at: {
                    [Session.sequelize.Sequelize.Op.gt]: new Date()
                }
            },
            include: [{
                model: Session.sequelize.models.Player,
                as: 'player',
                attributes: {
                    exclude: ['password_hash']
                }
            }]
        });
    }
    
    /**
     * Deactivate all sessions for a player
     * @param {string} playerId - Player ID
     * @param {string} reason - Deactivation reason
     * @returns {number} Number of sessions deactivated
     */
    static async deactivatePlayerSessions(playerId, reason = 'All sessions deactivated') {
        const [affectedRows] = await Session.update(
            { is_active: false },
            { 
                where: { 
                    player_id: playerId,
                    is_active: true
                }
            }
        );
        
        if (affectedRows > 0) {
            console.log(`Deactivated ${affectedRows} sessions for player ${playerId}: ${reason}`);
        }
        
        return affectedRows;
    }
    
    /**
     * Clean up expired sessions
     * @returns {number} Number of sessions cleaned up
     */
    static async cleanupExpiredSessions() {
        const [affectedRows] = await Session.update(
            { is_active: false },
            { 
                where: { 
                    is_active: true,
                    expires_at: {
                        [Session.sequelize.Sequelize.Op.lt]: new Date()
                    }
                }
            }
        );
        
        if (affectedRows > 0) {
            console.log(`Cleaned up ${affectedRows} expired sessions`);
        }
        
        return affectedRows;
    }
    
    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    static async getSessionStats() {
        const totalSessions = await Session.count();
        const activeSessions = await Session.count({
            where: {
                is_active: true,
                expires_at: {
                    [Session.sequelize.Sequelize.Op.gt]: new Date()
                }
            }
        });
        const expiredSessions = await Session.count({
            where: {
                [Session.sequelize.Sequelize.Op.or]: [
                    { is_active: false },
                    { expires_at: { [Session.sequelize.Sequelize.Op.lt]: new Date() } }
                ]
            }
        });
        
        return {
            total_sessions: totalSessions,
            active_sessions: activeSessions,
            expired_sessions: expiredSessions,
            cleanup_needed: await Session.count({
                where: {
                    is_active: true,
                    expires_at: {
                        [Session.sequelize.Sequelize.Op.lt]: new Date()
                    }
                }
            })
        };
    }
    
    /**
     * Get sessions with pagination
     * @param {Object} options - Query options
     * @returns {Object} Sessions and metadata
     */
    static async getSessions({ 
        page = 1, 
        limit = 50, 
        player_id = null,
        is_active = null,
        include_player = true 
    }) {
        const offset = (page - 1) * limit;
        const where = {};
        
        if (player_id) {
            where.player_id = player_id;
        }
        
        if (is_active !== null) {
            where.is_active = is_active;
        }
        
        const include = include_player ? [{
            model: Session.sequelize.models.Player,
            as: 'player',
            attributes: {
                exclude: ['password_hash']
            }
        }] : [];
        
        const { count, rows } = await Session.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include
        });
        
        return {
            sessions: rows,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            hasMore: offset + limit < count
        };
    }
}

module.exports = Session;