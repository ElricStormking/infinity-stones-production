/**
 * Player.js - Sequelize Model for Players Table
 * 
 * Represents player accounts with credit management, demo mode support,
 * and comprehensive validation for casino operations.
 * 
 * Features:
 * - Credit balance management with positive balance constraints
 * - Demo mode support for testing
 * - Admin privilege flags
 * - Account status tracking (active, suspended, banned)
 * - Audit trail with created/updated timestamps
 * - Secure password hashing hooks
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');

class Player extends Model {
    /**
     * Initialize the Player model with database connection
     */
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: 'Unique player identifier'
            },
            
            username: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: {
                    name: 'unique_username',
                    msg: 'Username already exists'
                },
                validate: {
                    len: {
                        args: [3, 50],
                        msg: 'Username must be between 3 and 50 characters'
                    },
                    isAlphanumeric: {
                        msg: 'Username can only contain letters and numbers'
                    },
                    notEmpty: {
                        msg: 'Username cannot be empty'
                    }
                },
                comment: 'Unique username for player login'
            },
            
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: {
                    name: 'unique_email',
                    msg: 'Email address already registered'
                },
                validate: {
                    isEmail: {
                        msg: 'Must be a valid email address'
                    },
                    len: {
                        args: [5, 255],
                        msg: 'Email must be between 5 and 255 characters'
                    },
                    notEmpty: {
                        msg: 'Email cannot be empty'
                    }
                },
                comment: 'Player email address for authentication and communication'
            },
            
            password_hash: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: 'Password hash cannot be empty'
                    },
                    len: {
                        args: [50, 255],
                        msg: 'Invalid password hash format'
                    }
                },
                comment: 'Bcrypt hashed password for secure authentication'
            },
            
            credits: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 1000.00,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Credits cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Credits must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('credits');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Player credit balance for betting'
            },
            
            is_demo: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Flag indicating if player is in demo mode'
            },
            
            is_admin: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Flag indicating if player has admin privileges'
            },
            
            last_login_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'Timestamp of last successful login'
            },
            
            status: {
                type: DataTypes.ENUM('active', 'suspended', 'banned'),
                allowNull: false,
                defaultValue: 'active',
                validate: {
                    isIn: {
                        args: [['active', 'suspended', 'banned']],
                        msg: 'Status must be active, suspended, or banned'
                    }
                },
                comment: 'Player account status'
            }
        }, {
            sequelize,
            modelName: 'Player',
            tableName: 'players',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            
            indexes: [
                {
                    unique: true,
                    fields: ['email']
                },
                {
                    unique: true,
                    fields: ['username']
                },
                {
                    fields: ['status'],
                    where: {
                        status: { [sequelize.Sequelize.Op.ne]: 'active' }
                    }
                },
                {
                    fields: ['is_admin'],
                    where: {
                        is_admin: true
                    }
                },
                {
                    fields: ['created_at']
                }
            ],
            
            hooks: {
                beforeCreate: async (player) => {
                    if (player.password_hash && !player.password_hash.startsWith('$2b$')) {
                        // Hash password if it's not already hashed
                        player.password_hash = await bcrypt.hash(player.password_hash, 12);
                    }
                },
                
                beforeUpdate: async (player) => {
                    if (player.changed('password_hash') && !player.password_hash.startsWith('$2b$')) {
                        // Hash password if it's being updated and not already hashed
                        player.password_hash = await bcrypt.hash(player.password_hash, 12);
                    }
                },
                
                afterFind: (players) => {
                    // Convert single player to array for consistent processing
                    const playersArray = Array.isArray(players) ? players : [players].filter(Boolean);
                    
                    playersArray.forEach(player => {
                        if (player) {
                            // Remove password_hash from JSON serialization for security
                            player.toJSON = function() {
                                const values = Object.assign({}, this.get());
                                delete values.password_hash;
                                return values;
                            };
                        }
                    });
                }
            },
            
            scopes: {
                active: {
                    where: {
                        status: 'active'
                    }
                },
                
                admins: {
                    where: {
                        is_admin: true,
                        status: 'active'
                    }
                },
                
                demo: {
                    where: {
                        is_demo: true
                    }
                },
                
                withoutPassword: {
                    attributes: {
                        exclude: ['password_hash']
                    }
                }
            }
        });
    }
    
    /**
     * Define associations with other models
     */
    static associate(models) {
        // Player has many sessions (but only one active)
        Player.hasMany(models.Session, {
            foreignKey: 'player_id',
            as: 'sessions',
            onDelete: 'CASCADE'
        });
        
        // Player has one active session
        Player.hasOne(models.Session, {
            foreignKey: 'player_id',
            as: 'activeSession',
            scope: {
                is_active: true
            }
        });
        
        // Player has many game states
        Player.hasMany(models.GameState, {
            foreignKey: 'player_id',
            as: 'gameStates',
            onDelete: 'CASCADE'
        });
        
        // Player has one current game state
        Player.hasOne(models.GameState, {
            foreignKey: 'player_id',
            as: 'currentGameState',
            scope: {
                // Most recent game state
                order: [['updated_at', 'DESC']]
            }
        });
        
        // Player has many spin results
        Player.hasMany(models.SpinResult, {
            foreignKey: 'player_id',
            as: 'spinResults',
            onDelete: 'CASCADE'
        });
        
        // Player has many transactions
        Player.hasMany(models.Transaction, {
            foreignKey: 'player_id',
            as: 'transactions',
            onDelete: 'CASCADE'
        });
        
        // Player has many admin log entries as target
        Player.hasMany(models.AdminLog, {
            foreignKey: 'target_player_id',
            as: 'adminLogsAsTarget'
        });
        
        // Player has many admin log entries as admin
        Player.hasMany(models.AdminLog, {
            foreignKey: 'admin_id',
            as: 'adminLogsAsAdmin'
        });
        
        // Player can win jackpots
        Player.hasMany(models.Jackpot, {
            foreignKey: 'last_winner_id',
            as: 'jackpotsWon'
        });
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Verify password against stored hash
     * @param {string} password - Plain text password
     * @returns {boolean} True if password matches
     */
    async verifyPassword(password) {
        return await bcrypt.compare(password, this.password_hash);
    }
    
    /**
     * Update last login timestamp
     */
    async updateLastLogin() {
        this.last_login_at = new Date();
        await this.save({ fields: ['last_login_at', 'updated_at'] });
    }
    
    /**
     * Check if player can place a bet
     * @param {number} betAmount - Amount to bet
     * @returns {boolean} True if player has sufficient credits
     */
    canPlaceBet(betAmount) {
        return this.status === 'active' && this.credits >= betAmount;
    }
    
    /**
     * Deduct credits (for bets)
     * @param {number} amount - Amount to deduct
     * @throws {Error} If insufficient credits
     */
    async deductCredits(amount) {
        if (this.credits < amount) {
            throw new Error(`Insufficient credits. Available: ${this.credits}, Required: ${amount}`);
        }
        
        this.credits -= amount;
        await this.save({ fields: ['credits', 'updated_at'] });
    }
    
    /**
     * Add credits (for wins)
     * @param {number} amount - Amount to add
     */
    async addCredits(amount) {
        this.credits = parseFloat(this.credits) + parseFloat(amount);
        await this.save({ fields: ['credits', 'updated_at'] });
    }
    
    /**
     * Get safe player data for client (excludes sensitive fields)
     * @returns {Object} Safe player data
     */
    getSafeData() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            credits: this.credits,
            is_demo: this.is_demo,
            is_admin: this.is_admin,
            status: this.status,
            last_login_at: this.last_login_at,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
    
    /**
     * Check if player is active
     * @returns {boolean} True if player is active
     */
    isActive() {
        return this.status === 'active';
    }
    
    /**
     * Check if player is admin
     * @returns {boolean} True if player is admin
     */
    isAdmin() {
        return this.is_admin === true && this.status === 'active';
    }
    
    /**
     * Check if player is in demo mode
     * @returns {boolean} True if player is in demo mode
     */
    isDemoMode() {
        return this.is_demo === true;
    }
    
    /**
     * Suspend player account
     * @param {string} reason - Suspension reason
     */
    async suspend(reason = 'Account suspended by admin') {
        this.status = 'suspended';
        await this.save({ fields: ['status', 'updated_at'] });
        
        // Log the suspension
        console.log(`Player ${this.username} suspended: ${reason}`);
    }
    
    /**
     * Ban player account
     * @param {string} reason - Ban reason
     */
    async ban(reason = 'Account banned by admin') {
        this.status = 'banned';
        await this.save({ fields: ['status', 'updated_at'] });
        
        // Log the ban
        console.log(`Player ${this.username} banned: ${reason}`);
    }
    
    /**
     * Reactivate player account
     */
    async reactivate() {
        this.status = 'active';
        await this.save({ fields: ['status', 'updated_at'] });
    }
    
    /**
     * Static Methods
     */
    
    /**
     * Find player by username or email
     * @param {string} identifier - Username or email
     * @returns {Player|null} Player instance or null
     */
    static async findByIdentifier(identifier) {
        return await Player.findOne({
            where: {
                [Player.sequelize.Sequelize.Op.or]: [
                    { username: identifier },
                    { email: identifier }
                ]
            }
        });
    }
    
    /**
     * Create a new player with hashed password
     * @param {Object} playerData - Player data
     * @returns {Player} Created player instance
     */
    static async createPlayer(playerData) {
        return await Player.create(playerData);
    }
    
    /**
     * Get players with pagination
     * @param {Object} options - Query options
     * @returns {Object} Players and metadata
     */
    static async getPlayers({ 
        page = 1, 
        limit = 50, 
        status = null, 
        is_admin = null,
        search = null 
    }) {
        const offset = (page - 1) * limit;
        const where = {};
        
        if (status) {
            where.status = status;
        }
        
        if (is_admin !== null) {
            where.is_admin = is_admin;
        }
        
        if (search) {
            where[Player.sequelize.Sequelize.Op.or] = [
                { username: { [Player.sequelize.Sequelize.Op.iLike]: `%${search}%` } },
                { email: { [Player.sequelize.Sequelize.Op.iLike]: `%${search}%` } }
            ];
        }
        
        const { count, rows } = await Player.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            attributes: {
                exclude: ['password_hash']
            }
        });
        
        return {
            players: rows,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            hasMore: offset + limit < count
        };
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Ban the player
     * @param {string} reason - Reason for ban
     */
    async ban(reason) {
        this.status = 'banned';
        this.ban_reason = reason;
        this.banned_at = new Date();
        await this.save();
    }
}

module.exports = Player;