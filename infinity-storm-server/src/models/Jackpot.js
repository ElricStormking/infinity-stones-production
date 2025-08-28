/**
 * Jackpot.js - Sequelize Model for Jackpots Table
 * 
 * Progressive jackpot management with contribution tracking,
 * winner history, and configurable growth mechanics.
 * 
 * Features:
 * - Progressive jackpot value tracking
 * - Configurable contribution rates from bets
 * - Winner history and payout tracking
 * - Active/inactive jackpot management
 * - Seed value restoration after wins
 * - Comprehensive audit trail
 */

const { DataTypes, Model } = require('sequelize');

class Jackpot extends Model {
    /**
     * Initialize the Jackpot model with database connection
     */
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: 'Unique jackpot identifier'
            },
            
            name: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: {
                    name: 'unique_active_jackpot_name',
                    msg: 'Jackpot name must be unique among active jackpots'
                },
                validate: {
                    len: {
                        args: [3, 50],
                        msg: 'Jackpot name must be between 3 and 50 characters'
                    },
                    notEmpty: {
                        msg: 'Jackpot name cannot be empty'
                    }
                },
                comment: 'Unique name for the jackpot'
            },
            
            current_value: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Current value cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Current value must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('current_value');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Current jackpot value available to be won'
            },
            
            seed_value: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Seed value cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Seed value must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('seed_value');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Base value that jackpot resets to after being won'
            },
            
            contribution_rate: {
                type: DataTypes.DECIMAL(5, 4),
                allowNull: false,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Contribution rate cannot be negative'
                    },
                    max: {
                        args: [1],
                        msg: 'Contribution rate cannot exceed 100%'
                    },
                    isDecimal: {
                        msg: 'Contribution rate must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('contribution_rate');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Percentage of each bet that contributes to this jackpot (0.0 to 1.0)'
            },
            
            last_won_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'Timestamp when jackpot was last won'
            },
            
            last_winner_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'players',
                    key: 'id'
                },
                onDelete: 'SET NULL',
                comment: 'Player who last won this jackpot'
            },
            
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this jackpot is currently active and accepting contributions'
            },
            
            min_trigger_bet: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: null,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Minimum trigger bet cannot be negative'
                    }
                },
                get() {
                    const value = this.getDataValue('min_trigger_bet');
                    return value ? parseFloat(value) : null;
                },
                comment: 'Minimum bet amount required to be eligible for jackpot (null = no minimum)'
            },
            
            trigger_conditions: {
                type: DataTypes.JSONB,
                allowNull: true,
                defaultValue: null,
                comment: 'JSON conditions that must be met to trigger jackpot (symbols, multipliers, etc.)'
            },
            
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
                defaultValue: null,
                comment: 'Additional jackpot configuration and metadata'
            }
        }, {
            sequelize,
            modelName: 'Jackpot',
            tableName: 'jackpots',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            
            indexes: [
                {
                    unique: true,
                    fields: ['name'],
                    where: {
                        is_active: true
                    },
                    name: 'idx_unique_active_jackpot_names'
                },
                {
                    fields: ['is_active'],
                    where: {
                        is_active: true
                    }
                },
                {
                    fields: ['updated_at']
                },
                {
                    fields: ['last_won_at']
                },
                {
                    fields: ['current_value']
                }
            ],
            
            hooks: {
                beforeSave: (jackpot) => {
                    // Ensure current_value is at least seed_value
                    if (jackpot.current_value < jackpot.seed_value) {
                        jackpot.current_value = jackpot.seed_value;
                    }
                },
                
                afterUpdate: (jackpot) => {
                    // Log jackpot wins
                    if (jackpot.changed('last_won_at') && jackpot.last_won_at) {
                        console.log(`Jackpot '${jackpot.name}' won by player ${jackpot.last_winner_id} for $${jackpot.current_value}`);
                    }
                }
            },
            
            scopes: {
                active: {
                    where: {
                        is_active: true
                    }
                },
                
                inactive: {
                    where: {
                        is_active: false
                    }
                },
                
                byValue: (minValue = 0) => ({
                    where: {
                        current_value: {
                            [sequelize.Sequelize.Op.gte]: minValue
                        }
                    }
                }),
                
                eligibleForBet: (betAmount) => ({
                    where: {
                        is_active: true,
                        [sequelize.Sequelize.Op.or]: [
                            { min_trigger_bet: null },
                            { min_trigger_bet: { [sequelize.Sequelize.Op.lte]: betAmount } }
                        ]
                    }
                })
            }
        });
    }
    
    /**
     * Define associations with other models
     */
    static associate(models) {
        // Jackpot has a last winner (player)
        Jackpot.belongsTo(models.Player, {
            foreignKey: 'last_winner_id',
            as: 'lastWinner',
            onDelete: 'SET NULL'
        });
        
        // Jackpot has many contributions
        Jackpot.hasMany(models.JackpotContribution, {
            foreignKey: 'jackpot_id',
            as: 'contributions',
            onDelete: 'CASCADE'
        });
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Check if jackpot is active and accepting contributions
     * @returns {boolean} True if jackpot is active
     */
    isActive() {
        return this.is_active === true;
    }
    
    /**
     * Check if a bet amount is eligible for this jackpot
     * @param {number} betAmount - Bet amount to check
     * @returns {boolean} True if bet is eligible
     */
    isEligibleBet(betAmount) {
        if (!this.isActive()) return false;
        if (!this.min_trigger_bet) return true;
        return betAmount >= this.min_trigger_bet;
    }
    
    /**
     * Calculate contribution amount for a bet
     * @param {number} betAmount - Bet amount
     * @returns {number} Contribution amount
     */
    calculateContribution(betAmount) {
        if (!this.isEligibleBet(betAmount)) return 0;
        return betAmount * this.contribution_rate;
    }
    
    /**
     * Add contribution to jackpot
     * @param {number} amount - Amount to add
     * @param {string} spinId - Optional spin ID reference
     */
    async addContribution(amount, spinId = null) {
        if (amount <= 0) return;
        
        this.current_value += amount;
        await this.save({ fields: ['current_value', 'updated_at'] });
        
        // Create contribution record
        if (this.sequelize.models.JackpotContribution) {
            await this.sequelize.models.JackpotContribution.create({
                jackpot_id: this.id,
                spin_id: spinId,
                contribution_amount: amount
            });
        }
    }
    
    /**
     * Award jackpot to a player
     * @param {string} playerId - Winner player ID
     * @param {string} spinId - Optional spin ID that triggered win
     * @returns {Object} Win details
     */
    async awardJackpot(playerId, spinId = null) {
        const winAmount = this.current_value;
        
        // Record winner and reset jackpot
        this.last_winner_id = playerId;
        this.last_won_at = new Date();
        this.current_value = this.seed_value;
        
        await this.save();
        
        // Log the win
        console.log(`Jackpot '${this.name}' awarded to player ${playerId}: $${winAmount}`);
        
        return {
            jackpot_id: this.id,
            jackpot_name: this.name,
            winner_id: playerId,
            win_amount: winAmount,
            spin_id: spinId,
            won_at: this.last_won_at
        };
    }
    
    /**
     * Get time since last win
     * @returns {number} Milliseconds since last win (null if never won)
     */
    getTimeSinceLastWin() {
        if (!this.last_won_at) return null;
        return Date.now() - new Date(this.last_won_at).getTime();
    }
    
    /**
     * Get days since last win
     * @returns {number} Days since last win (null if never won)
     */
    getDaysSinceLastWin() {
        const timeSince = this.getTimeSinceLastWin();
        return timeSince ? Math.floor(timeSince / (24 * 60 * 60 * 1000)) : null;
    }
    
    /**
     * Get contribution percentage as display string
     * @returns {string} Formatted percentage
     */
    getContributionPercentage() {
        return `${(this.contribution_rate * 100).toFixed(2)}%`;
    }
    
    /**
     * Get growth since seed value
     * @returns {number} Amount grown above seed value
     */
    getGrowthAmount() {
        return this.current_value - this.seed_value;
    }
    
    /**
     * Get growth percentage
     * @returns {number} Percentage grown above seed value
     */
    getGrowthPercentage() {
        if (this.seed_value === 0) return 0;
        return ((this.current_value - this.seed_value) / this.seed_value) * 100;
    }
    
    /**
     * Check if trigger conditions are met for a spin result
     * @param {Object} spinResult - Spin result to check
     * @returns {boolean} True if conditions are met
     */
    checkTriggerConditions(spinResult) {
        if (!this.trigger_conditions) return false;
        
        const conditions = this.trigger_conditions;
        
        // Example trigger condition checks
        if (conditions.min_win_multiplier) {
            const multiplier = spinResult.total_win / spinResult.bet_amount;
            if (multiplier < conditions.min_win_multiplier) return false;
        }
        
        if (conditions.required_symbols) {
            // Check if specific symbols appeared in required quantities
            for (const [symbol, count] of Object.entries(conditions.required_symbols)) {
                const symbolCount = this.countSymbolInGrid(spinResult.final_grid, symbol);
                if (symbolCount < count) return false;
            }
        }
        
        if (conditions.min_cascade_count) {
            if (spinResult.cascades.length < conditions.min_cascade_count) return false;
        }
        
        return true;
    }
    
    /**
     * Helper method to count symbols in grid
     * @param {Array} grid - Game grid
     * @param {string} symbol - Symbol to count
     * @returns {number} Count of symbol
     */
    countSymbolInGrid(grid, symbol) {
        let count = 0;
        for (const column of grid) {
            for (const cellSymbol of column) {
                if (cellSymbol === symbol) count++;
            }
        }
        return count;
    }
    
    /**
     * Get safe jackpot data for client
     * @returns {Object} Safe jackpot data
     */
    getSafeData() {
        return {
            id: this.id,
            name: this.name,
            current_value: this.current_value,
            seed_value: this.seed_value,
            contribution_rate: this.contribution_rate,
            is_active: this.is_active,
            min_trigger_bet: this.min_trigger_bet,
            last_won_at: this.last_won_at,
            created_at: this.created_at,
            updated_at: this.updated_at,
            
            // Calculated fields
            contribution_percentage: this.getContributionPercentage(),
            growth_amount: this.getGrowthAmount(),
            growth_percentage: this.getGrowthPercentage(),
            days_since_last_win: this.getDaysSinceLastWin()
        };
    }
    
    /**
     * Static Methods
     */
    
    /**
     * Get all active jackpots
     * @returns {Array<Jackpot>} Active jackpots
     */
    static async getActiveJackpots() {
        return await Jackpot.findAll({
            where: {
                is_active: true
            },
            order: [['current_value', 'DESC']]
        });
    }
    
    /**
     * Get eligible jackpots for a bet amount
     * @param {number} betAmount - Bet amount
     * @returns {Array<Jackpot>} Eligible jackpots
     */
    static async getEligibleJackpots(betAmount) {
        return await Jackpot.findAll({
            where: {
                is_active: true,
                [Jackpot.sequelize.Sequelize.Op.or]: [
                    { min_trigger_bet: null },
                    { min_trigger_bet: { [Jackpot.sequelize.Sequelize.Op.lte]: betAmount } }
                ]
            },
            order: [['current_value', 'DESC']]
        });
    }
    
    /**
     * Process contributions for all eligible jackpots
     * @param {number} betAmount - Bet amount
     * @param {string} spinId - Spin ID reference
     * @returns {Array<Object>} Contribution details
     */
    static async processContributions(betAmount, spinId = null) {
        const eligibleJackpots = await Jackpot.getEligibleJackpots(betAmount);
        const contributions = [];
        
        for (const jackpot of eligibleJackpots) {
            const contributionAmount = jackpot.calculateContribution(betAmount);
            if (contributionAmount > 0) {
                await jackpot.addContribution(contributionAmount, spinId);
                contributions.push({
                    jackpot_id: jackpot.id,
                    jackpot_name: jackpot.name,
                    contribution_amount: contributionAmount
                });
            }
        }
        
        return contributions;
    }
    
    /**
     * Create a new jackpot
     * @param {Object} jackpotData - Jackpot data
     * @returns {Jackpot} Created jackpot
     */
    static async createJackpot({
        name,
        seed_value,
        contribution_rate,
        is_active = false,
        min_trigger_bet = null,
        trigger_conditions = null
    }) {
        return await Jackpot.create({
            name,
            seed_value,
            current_value: seed_value, // Start at seed value
            contribution_rate,
            is_active,
            min_trigger_bet,
            trigger_conditions
        });
    }
    
    /**
     * Get jackpot statistics
     * @param {number} days - Number of days to analyze
     * @returns {Object} Jackpot statistics
     */
    static async getJackpotStats(days = 30) {
        const dateFilter = days > 0 ? {
            created_at: {
                [Jackpot.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
            }
        } : {};
        
        const totalJackpots = await Jackpot.count();
        const activeJackpots = await Jackpot.count({ where: { is_active: true } });
        
        const totalValue = await Jackpot.sum('current_value', { 
            where: { is_active: true } 
        }) || 0;
        
        const totalSeedValue = await Jackpot.sum('seed_value', { 
            where: { is_active: true } 
        }) || 0;
        
        const recentWins = await Jackpot.count({
            where: {
                last_won_at: {
                    [Jackpot.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
                }
            }
        });
        
        return {
            period_days: days,
            total_jackpots: totalJackpots,
            active_jackpots: activeJackpots,
            total_current_value: parseFloat(totalValue),
            total_seed_value: parseFloat(totalSeedValue),
            total_growth: parseFloat(totalValue - totalSeedValue),
            recent_wins: recentWins
        };
    }
    
    /**
     * Get recent jackpot wins
     * @param {number} limit - Number of wins to return
     * @returns {Array<Jackpot>} Recent jackpot wins
     */
    static async getRecentWins(limit = 10) {
        return await Jackpot.findAll({
            where: {
                last_won_at: {
                    [Jackpot.sequelize.Sequelize.Op.ne]: null
                }
            },
            order: [['last_won_at', 'DESC']],
            limit,
            include: [{
                model: Jackpot.sequelize.models.Player,
                as: 'lastWinner',
                attributes: ['id', 'username']
            }]
        });
    }
    
    /**
     * Reset jackpot to seed value (admin function)
     * @param {string} jackpotId - Jackpot ID
     * @returns {Jackpot} Updated jackpot
     */
    static async resetJackpot(jackpotId) {
        const jackpot = await Jackpot.findByPk(jackpotId);
        if (!jackpot) {
            throw new Error('Jackpot not found');
        }
        
        jackpot.current_value = jackpot.seed_value;
        jackpot.last_won_at = null;
        jackpot.last_winner_id = null;
        
        await jackpot.save();
        return jackpot;
    }
}

module.exports = Jackpot;