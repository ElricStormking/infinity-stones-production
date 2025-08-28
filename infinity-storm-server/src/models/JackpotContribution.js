/**
 * JackpotContribution.js - Sequelize Model for Jackpot Contributions Table
 * 
 * Tracks all contributions made to progressive jackpots with complete
 * audit trail linking to specific spins and contribution amounts.
 * 
 * Features:
 * - Individual contribution tracking per spin
 * - Complete audit trail for jackpot growth
 * - Contribution analysis and reporting
 * - Performance optimized for high volume
 * - Jackpot growth rate calculations
 */

const { DataTypes, Model } = require('sequelize');

class JackpotContribution extends Model {
    /**
     * Initialize the JackpotContribution model with database connection
     */
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: 'Unique jackpot contribution identifier'
            },
            
            jackpot_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'jackpots',
                    key: 'id'
                },
                onDelete: 'CASCADE',
                comment: 'Reference to jackpot receiving the contribution'
            },
            
            spin_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'spin_results',
                    key: 'id'
                },
                onDelete: 'SET NULL',
                comment: 'Reference to spin that generated this contribution'
            },
            
            contribution_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                validate: {
                    min: {
                        args: [0.01],
                        msg: 'Contribution amount must be at least $0.01'
                    },
                    isDecimal: {
                        msg: 'Contribution amount must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('contribution_amount');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Amount contributed to the jackpot'
            }
        }, {
            sequelize,
            modelName: 'JackpotContribution',
            tableName: 'jackpot_contributions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false, // Contributions are immutable once created
            
            indexes: [
                {
                    fields: ['jackpot_id'],
                    name: 'idx_jackpot_contributions_jackpot'
                },
                {
                    fields: ['spin_id'],
                    name: 'idx_jackpot_contributions_spin'
                },
                {
                    fields: ['created_at'],
                    name: 'idx_jackpot_contributions_created_at'
                },
                {
                    fields: ['jackpot_id', 'created_at'],
                    name: 'idx_jackpot_contributions_jackpot_time'
                },
                {
                    fields: ['contribution_amount'],
                    name: 'idx_jackpot_contributions_amount'
                }
            ],
            
            hooks: {
                beforeCreate: (contribution) => {
                    // Validate contribution amount
                    if (contribution.contribution_amount <= 0) {
                        throw new Error('Contribution amount must be positive');
                    }
                },
                
                afterCreate: (contribution) => {
                    // Log large contributions
                    if (contribution.contribution_amount >= 10) {
                        console.log(`Large jackpot contribution: $${contribution.contribution_amount} to jackpot ${contribution.jackpot_id}`);
                    }
                }
            },
            
            scopes: {
                forJackpot: (jackpotId) => ({
                    where: {
                        jackpot_id: jackpotId
                    }
                }),
                
                forSpin: (spinId) => ({
                    where: {
                        spin_id: spinId
                    }
                }),
                
                recent: (hours = 24) => ({
                    where: {
                        created_at: {
                            [sequelize.Sequelize.Op.gte]: new Date(Date.now() - (hours * 60 * 60 * 1000))
                        }
                    }
                }),
                
                largeContributions: (threshold = 5) => ({
                    where: {
                        contribution_amount: {
                            [sequelize.Sequelize.Op.gte]: threshold
                        }
                    }
                }),
                
                byDateRange: (startDate, endDate) => ({
                    where: {
                        created_at: {
                            [sequelize.Sequelize.Op.between]: [startDate, endDate]
                        }
                    }
                })
            }
        });
    }
    
    /**
     * Define associations with other models
     */
    static associate(models) {
        // JackpotContribution belongs to a jackpot
        JackpotContribution.belongsTo(models.Jackpot, {
            foreignKey: 'jackpot_id',
            as: 'jackpot',
            onDelete: 'CASCADE'
        });
        
        // JackpotContribution belongs to a spin result (optional)
        JackpotContribution.belongsTo(models.SpinResult, {
            foreignKey: 'spin_id',
            as: 'spinResult',
            onDelete: 'SET NULL'
        });
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Check if contribution is linked to a specific spin
     * @returns {boolean} True if linked to a spin
     */
    hasSpinReference() {
        return this.spin_id !== null;
    }
    
    /**
     * Get contribution as percentage of a base amount
     * @param {number} baseAmount - Base amount to calculate percentage against
     * @returns {number} Contribution as percentage
     */
    getPercentageOf(baseAmount) {
        if (baseAmount === 0) return 0;
        return (this.contribution_amount / baseAmount) * 100;
    }
    
    /**
     * Get safe contribution data for client
     * @returns {Object} Safe contribution data
     */
    getSafeData() {
        return {
            id: this.id,
            jackpot_id: this.jackpot_id,
            spin_id: this.spin_id,
            contribution_amount: this.contribution_amount,
            created_at: this.created_at,
            
            // Calculated fields
            has_spin_reference: this.hasSpinReference()
        };
    }
    
    /**
     * Static Methods
     */
    
    /**
     * Create a new jackpot contribution
     * @param {Object} contributionData - Contribution data
     * @returns {JackpotContribution} Created contribution
     */
    static async createContribution({
        jackpot_id,
        spin_id = null,
        contribution_amount
    }) {
        if (contribution_amount <= 0) {
            throw new Error('Contribution amount must be positive');
        }
        
        return await JackpotContribution.create({
            jackpot_id,
            spin_id,
            contribution_amount
        });
    }
    
    /**
     * Get contributions for a specific jackpot with pagination
     * @param {Object} options - Query options
     * @returns {Object} Contributions and metadata
     */
    static async getJackpotContributions({
        jackpot_id,
        page = 1,
        limit = 100,
        date_from = null,
        date_to = null,
        include_spin_data = false
    }) {
        const offset = (page - 1) * limit;
        const where = { jackpot_id };
        
        if (date_from || date_to) {
            where.created_at = {};
            if (date_from) where.created_at[JackpotContribution.sequelize.Sequelize.Op.gte] = new Date(date_from);
            if (date_to) where.created_at[JackpotContribution.sequelize.Sequelize.Op.lte] = new Date(date_to);
        }
        
        const include = [];
        if (include_spin_data) {
            include.push({
                model: JackpotContribution.sequelize.models.SpinResult,
                as: 'spinResult',
                attributes: ['id', 'bet_amount', 'total_win', 'player_id', 'created_at']
            });
        }
        
        const { count, rows } = await JackpotContribution.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include
        });
        
        return {
            contributions: rows,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            hasMore: offset + limit < count
        };
    }
    
    /**
     * Get contribution statistics for a jackpot
     * @param {string} jackpotId - Jackpot ID
     * @param {number} days - Number of days to analyze
     * @returns {Object} Contribution statistics
     */
    static async getJackpotContributionStats(jackpotId, days = 30) {
        const dateFilter = days > 0 ? {
            created_at: {
                [JackpotContribution.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
            }
        } : {};
        
        const where = { jackpot_id: jackpotId, ...dateFilter };
        
        const totalContributions = await JackpotContribution.count({ where });
        const totalAmount = await JackpotContribution.sum('contribution_amount', { where }) || 0;
        
        const averageContribution = totalContributions > 0 ? totalAmount / totalContributions : 0;
        
        const largestContribution = await JackpotContribution.max('contribution_amount', { where }) || 0;
        const smallestContribution = await JackpotContribution.min('contribution_amount', { where }) || 0;
        
        // Get daily contribution totals
        const dailyContributions = await JackpotContribution.findAll({
            attributes: [
                [JackpotContribution.sequelize.fn('DATE', JackpotContribution.sequelize.col('created_at')), 'date'],
                [JackpotContribution.sequelize.fn('COUNT', JackpotContribution.sequelize.col('id')), 'count'],
                [JackpotContribution.sequelize.fn('SUM', JackpotContribution.sequelize.col('contribution_amount')), 'total']
            ],
            where,
            group: [JackpotContribution.sequelize.fn('DATE', JackpotContribution.sequelize.col('created_at'))],
            order: [[JackpotContribution.sequelize.fn('DATE', JackpotContribution.sequelize.col('created_at')), 'DESC']],
            raw: true
        });
        
        return {
            jackpot_id: jackpotId,
            period_days: days,
            total_contributions: totalContributions,
            total_amount: parseFloat(totalAmount),
            average_contribution: parseFloat(averageContribution.toFixed(4)),
            largest_contribution: parseFloat(largestContribution),
            smallest_contribution: parseFloat(smallestContribution),
            daily_breakdown: dailyContributions.map(d => ({
                date: d.date,
                count: parseInt(d.count),
                total: parseFloat(d.total) || 0
            }))
        };
    }
    
    /**
     * Get contributions by spin for analysis
     * @param {string} spinId - Spin ID
     * @returns {Array<JackpotContribution>} All contributions for this spin
     */
    static async getSpinContributions(spinId) {
        return await JackpotContribution.findAll({
            where: { spin_id: spinId },
            include: [{
                model: JackpotContribution.sequelize.models.Jackpot,
                as: 'jackpot',
                attributes: ['id', 'name', 'contribution_rate']
            }],
            order: [['contribution_amount', 'DESC']]
        });
    }
    
    /**
     * Get global contribution statistics
     * @param {number} days - Number of days to analyze
     * @returns {Object} Global contribution statistics
     */
    static async getGlobalContributionStats(days = 30) {
        const dateFilter = days > 0 ? {
            created_at: {
                [JackpotContribution.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
            }
        } : {};
        
        const totalContributions = await JackpotContribution.count({ where: dateFilter });
        const totalAmount = await JackpotContribution.sum('contribution_amount', { where: dateFilter }) || 0;
        
        // Get contributions by jackpot
        const contributionsByJackpot = await JackpotContribution.findAll({
            attributes: [
                'jackpot_id',
                [JackpotContribution.sequelize.fn('COUNT', JackpotContribution.sequelize.col('id')), 'count'],
                [JackpotContribution.sequelize.fn('SUM', JackpotContribution.sequelize.col('contribution_amount')), 'total']
            ],
            where: dateFilter,
            group: ['jackpot_id'],
            include: [{
                model: JackpotContribution.sequelize.models.Jackpot,
                as: 'jackpot',
                attributes: ['name', 'current_value']
            }],
            raw: false
        });
        
        return {
            period_days: days,
            total_contributions: totalContributions,
            total_amount: parseFloat(totalAmount),
            average_contribution: totalContributions > 0 ? parseFloat((totalAmount / totalContributions).toFixed(4)) : 0,
            by_jackpot: contributionsByJackpot.map(c => ({
                jackpot_id: c.jackpot_id,
                jackpot_name: c.jackpot?.name || 'Unknown',
                current_value: c.jackpot?.current_value || 0,
                contribution_count: parseInt(c.getDataValue('count')),
                contribution_total: parseFloat(c.getDataValue('total')) || 0
            }))
        };
    }
    
    /**
     * Get recent large contributions
     * @param {number} threshold - Minimum contribution amount
     * @param {number} limit - Number of contributions to return
     * @returns {Array<JackpotContribution>} Recent large contributions
     */
    static async getRecentLargeContributions(threshold = 5, limit = 20) {
        return await JackpotContribution.findAll({
            where: {
                contribution_amount: {
                    [JackpotContribution.sequelize.Sequelize.Op.gte]: threshold
                }
            },
            order: [['created_at', 'DESC']],
            limit,
            include: [
                {
                    model: JackpotContribution.sequelize.models.Jackpot,
                    as: 'jackpot',
                    attributes: ['id', 'name']
                },
                {
                    model: JackpotContribution.sequelize.models.SpinResult,
                    as: 'spinResult',
                    attributes: ['id', 'player_id', 'bet_amount'],
                    include: [{
                        model: JackpotContribution.sequelize.models.Player,
                        as: 'player',
                        attributes: ['id', 'username']
                    }]
                }
            ]
        });
    }
    
    /**
     * Calculate growth rate for a jackpot
     * @param {string} jackpotId - Jackpot ID
     * @param {number} hours - Time period in hours
     * @returns {Object} Growth rate data
     */
    static async calculateGrowthRate(jackpotId, hours = 24) {
        const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
        
        const contributions = await JackpotContribution.findAll({
            where: {
                jackpot_id: jackpotId,
                created_at: {
                    [JackpotContribution.sequelize.Sequelize.Op.gte]: startTime
                }
            },
            order: [['created_at', 'ASC']]
        });
        
        const totalContributed = contributions.reduce((sum, c) => sum + c.contribution_amount, 0);
        const contributionCount = contributions.length;
        const growthRate = contributionCount > 0 ? totalContributed / hours : 0; // per hour
        
        return {
            jackpot_id: jackpotId,
            period_hours: hours,
            total_contributed: parseFloat(totalContributed),
            contribution_count: contributionCount,
            growth_rate_per_hour: parseFloat(growthRate.toFixed(4)),
            projected_24h_growth: parseFloat((growthRate * 24).toFixed(2))
        };
    }
    
    /**
     * Get contribution trends over time
     * @param {string} jackpotId - Jackpot ID
     * @param {number} days - Number of days to analyze
     * @returns {Array<Object>} Daily contribution trends
     */
    static async getContributionTrends(jackpotId, days = 7) {
        const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
        
        const trends = await JackpotContribution.findAll({
            attributes: [
                [JackpotContribution.sequelize.fn('DATE', JackpotContribution.sequelize.col('created_at')), 'date'],
                [JackpotContribution.sequelize.fn('COUNT', JackpotContribution.sequelize.col('id')), 'count'],
                [JackpotContribution.sequelize.fn('SUM', JackpotContribution.sequelize.col('contribution_amount')), 'total'],
                [JackpotContribution.sequelize.fn('AVG', JackpotContribution.sequelize.col('contribution_amount')), 'average']
            ],
            where: {
                jackpot_id: jackpotId,
                created_at: {
                    [JackpotContribution.sequelize.Sequelize.Op.gte]: startDate
                }
            },
            group: [JackpotContribution.sequelize.fn('DATE', JackpotContribution.sequelize.col('created_at'))],
            order: [[JackpotContribution.sequelize.fn('DATE', JackpotContribution.sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        return trends.map(t => ({
            date: t.date,
            contribution_count: parseInt(t.count),
            total_contributed: parseFloat(t.total) || 0,
            average_contribution: parseFloat(parseFloat(t.average).toFixed(4)) || 0
        }));
    }
}

module.exports = JackpotContribution;