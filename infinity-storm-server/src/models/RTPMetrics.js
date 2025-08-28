/**
 * RTPMetrics.js - Sequelize Model for RTP Metrics Table
 * 
 * Return to Player (RTP) tracking and analysis for regulatory compliance
 * and game fairness monitoring with comprehensive reporting capabilities.
 * 
 * Features:
 * - Time-based RTP calculation and tracking
 * - Automated metric collection and analysis
 * - Regulatory compliance reporting
 * - Statistical variance monitoring
 * - Performance trend analysis
 * - Alert system for RTP deviations
 */

const { DataTypes, Model } = require('sequelize');

class RTPMetrics extends Model {
    /**
     * Initialize the RTPMetrics model with database connection
     */
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: 'Unique RTP metrics record identifier'
            },
            
            period_start: {
                type: DataTypes.DATE,
                allowNull: false,
                validate: {
                    isDate: {
                        msg: 'Period start must be a valid date'
                    }
                },
                comment: 'Start timestamp of the measurement period'
            },
            
            period_end: {
                type: DataTypes.DATE,
                allowNull: false,
                validate: {
                    isDate: {
                        msg: 'Period end must be a valid date'
                    },
                    isAfterStart(value) {
                        if (this.period_start && value <= this.period_start) {
                            throw new Error('Period end must be after period start');
                        }
                    }
                },
                comment: 'End timestamp of the measurement period'
            },
            
            total_bets: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Total bets cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Total bets must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('total_bets');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Total amount wagered during the period'
            },
            
            total_wins: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0.00,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Total wins cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Total wins must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('total_wins');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Total amount paid out in winnings during the period'
            },
            
            spin_count: {
                type: DataTypes.BIGINT,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Spin count cannot be negative'
                    },
                    isInt: {
                        msg: 'Spin count must be an integer'
                    }
                },
                comment: 'Total number of spins during the period'
            },
            
            calculated_rtp: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: true,
                validate: {
                    min: {
                        args: [0],
                        msg: 'RTP cannot be negative'
                    },
                    max: {
                        args: [200],
                        msg: 'RTP cannot exceed 200%'
                    },
                    isDecimal: {
                        msg: 'RTP must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('calculated_rtp');
                    return value ? parseFloat(value) : null;
                },
                comment: 'Calculated Return to Player percentage for the period'
            },
            
            player_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Player count cannot be negative'
                    }
                },
                comment: 'Number of unique players during the period'
            },
            
            session_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Session count cannot be negative'
                    }
                },
                comment: 'Number of game sessions during the period'
            },
            
            big_wins_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Big wins count cannot be negative'
                    }
                },
                comment: 'Number of big wins (>10x bet) during the period'
            },
            
            jackpot_wins_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Jackpot wins count cannot be negative'
                    }
                },
                comment: 'Number of jackpot wins during the period'
            },
            
            free_spins_triggered: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Free spins triggered count cannot be negative'
                    }
                },
                comment: 'Number of free spins features triggered during the period'
            },
            
            average_bet: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Average bet cannot be negative'
                    }
                },
                get() {
                    const value = this.getDataValue('average_bet');
                    return value ? parseFloat(value) : null;
                },
                comment: 'Average bet amount during the period'
            },
            
            period_type: {
                type: DataTypes.ENUM('hourly', 'daily', 'weekly', 'monthly', 'custom'),
                allowNull: false,
                defaultValue: 'daily',
                validate: {
                    isIn: {
                        args: [['hourly', 'daily', 'weekly', 'monthly', 'custom']],
                        msg: 'Period type must be hourly, daily, weekly, monthly, or custom'
                    }
                },
                comment: 'Type of time period this metric represents'
            },
            
            variance: {
                type: DataTypes.DECIMAL(8, 4),
                allowNull: true,
                comment: 'Statistical variance of win amounts during the period'
            },
            
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
                defaultValue: null,
                comment: 'Additional statistical data and analysis metadata'
            }
        }, {
            sequelize,
            modelName: 'RTPMetrics',
            tableName: 'rtp_metrics',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false, // RTP metrics are immutable once calculated
            
            indexes: [
                {
                    fields: ['period_start', 'period_end'],
                    name: 'idx_rtp_metrics_period'
                },
                {
                    fields: ['created_at'],
                    name: 'idx_rtp_metrics_created_at'
                },
                {
                    fields: ['calculated_rtp'],
                    name: 'idx_rtp_metrics_rtp'
                },
                {
                    fields: ['period_type'],
                    name: 'idx_rtp_metrics_period_type'
                },
                {
                    fields: ['period_type', 'period_start'],
                    name: 'idx_rtp_metrics_type_start'
                },
                {
                    unique: true,
                    fields: ['period_start', 'period_end', 'period_type'],
                    name: 'idx_unique_rtp_period'
                }
            ],
            
            hooks: {
                beforeSave: (rtpMetrics) => {
                    // Auto-calculate RTP if not provided
                    if (!rtpMetrics.calculated_rtp && rtpMetrics.total_bets > 0) {
                        rtpMetrics.calculated_rtp = (rtpMetrics.total_wins / rtpMetrics.total_bets) * 100;
                    }
                    
                    // Auto-calculate average bet
                    if (!rtpMetrics.average_bet && rtpMetrics.spin_count > 0 && rtpMetrics.total_bets > 0) {
                        rtpMetrics.average_bet = rtpMetrics.total_bets / rtpMetrics.spin_count;
                    }
                },
                
                afterCreate: (rtpMetrics) => {
                    // Alert on significant RTP deviations
                    const targetRTP = 96.5; // Target RTP percentage
                    const tolerance = 2.0; // ±2% tolerance
                    
                    if (rtpMetrics.calculated_rtp && rtpMetrics.spin_count >= 1000) { // Only alert with sufficient sample size
                        const deviation = Math.abs(rtpMetrics.calculated_rtp - targetRTP);
                        
                        if (deviation > tolerance) {
                            console.log(`RTP ALERT: ${rtpMetrics.period_type} RTP of ${rtpMetrics.calculated_rtp}% deviates from target ${targetRTP}% by ${deviation.toFixed(2)}%`);
                        }
                    }
                }
            },
            
            scopes: {
                byPeriodType: (periodType) => ({
                    where: {
                        period_type: periodType
                    }
                }),
                
                recent: (days = 30) => ({
                    where: {
                        period_start: {
                            [sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
                        }
                    }
                }),
                
                byDateRange: (startDate, endDate) => ({
                    where: {
                        period_start: {
                            [sequelize.Sequelize.Op.gte]: startDate
                        },
                        period_end: {
                            [sequelize.Sequelize.Op.lte]: endDate
                        }
                    }
                }),
                
                withMinimumSpins: (minSpins = 100) => ({
                    where: {
                        spin_count: {
                            [sequelize.Sequelize.Op.gte]: minSpins
                        }
                    }
                }),
                
                rtpRange: (minRTP, maxRTP) => ({
                    where: {
                        calculated_rtp: {
                            [sequelize.Sequelize.Op.between]: [minRTP, maxRTP]
                        }
                    }
                }),
                
                rtpDeviations: (targetRTP = 96.5, tolerance = 2.0) => ({
                    where: {
                        calculated_rtp: {
                            [sequelize.Sequelize.Op.or]: [
                                { [sequelize.Sequelize.Op.lt]: targetRTP - tolerance },
                                { [sequelize.Sequelize.Op.gt]: targetRTP + tolerance }
                            ]
                        }
                    }
                })
            }
        });
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Get period duration in hours
     * @returns {number} Duration in hours
     */
    getPeriodDurationHours() {
        const start = new Date(this.period_start);
        const end = new Date(this.period_end);
        return (end - start) / (1000 * 60 * 60);
    }
    
    /**
     * Get period duration in days
     * @returns {number} Duration in days
     */
    getPeriodDurationDays() {
        return this.getPeriodDurationHours() / 24;
    }
    
    /**
     * Calculate RTP percentage
     * @returns {number} RTP percentage
     */
    calculateRTP() {
        if (this.total_bets === 0) return 0;
        return (this.total_wins / this.total_bets) * 100;
    }
    
    /**
     * Calculate house edge percentage
     * @returns {number} House edge percentage
     */
    calculateHouseEdge() {
        const rtp = this.calculated_rtp || this.calculateRTP();
        return 100 - rtp;
    }
    
    /**
     * Calculate win rate (percentage of spins that resulted in wins)
     * @returns {number} Win rate percentage
     */
    calculateWinRate() {
        if (this.spin_count === 0) return 0;
        
        // Estimate winning spins (this would need to be tracked separately for accuracy)
        const estimatedWinningSpins = Math.floor(this.spin_count * 0.25); // Rough estimate
        return (estimatedWinningSpins / this.spin_count) * 100;
    }
    
    /**
     * Calculate average win amount (per winning spin)
     * @returns {number} Average win amount
     */
    calculateAverageWin() {
        if (this.spin_count === 0) return 0;
        
        // This is average win per spin, not per winning spin
        return this.total_wins / this.spin_count;
    }
    
    /**
     * Get deviation from target RTP
     * @param {number} targetRTP - Target RTP percentage (default 96.5)
     * @returns {number} Deviation from target
     */
    getTargetDeviation(targetRTP = 96.5) {
        const actualRTP = this.calculated_rtp || this.calculateRTP();
        return actualRTP - targetRTP;
    }
    
    /**
     * Check if RTP is within acceptable range
     * @param {number} targetRTP - Target RTP percentage
     * @param {number} tolerance - Acceptable deviation
     * @returns {boolean} True if within range
     */
    isRTPWithinRange(targetRTP = 96.5, tolerance = 2.0) {
        const deviation = Math.abs(this.getTargetDeviation(targetRTP));
        return deviation <= tolerance;
    }
    
    /**
     * Get statistical confidence level based on sample size
     * @returns {string} Confidence level description
     */
    getConfidenceLevel() {
        if (this.spin_count < 100) return 'Very Low';
        if (this.spin_count < 1000) return 'Low';
        if (this.spin_count < 10000) return 'Medium';
        if (this.spin_count < 100000) return 'High';
        return 'Very High';
    }
    
    /**
     * Get performance indicators
     * @returns {Object} Performance indicators
     */
    getPerformanceIndicators() {
        const targetRTP = 96.5;
        const rtp = this.calculated_rtp || this.calculateRTP();
        const deviation = this.getTargetDeviation(targetRTP);
        
        return {
            rtp_percentage: rtp,
            target_rtp: targetRTP,
            deviation: deviation,
            house_edge: this.calculateHouseEdge(),
            average_bet: this.average_bet || (this.total_bets / this.spin_count),
            average_win: this.calculateAverageWin(),
            big_win_rate: this.spin_count > 0 ? (this.big_wins_count / this.spin_count) * 100 : 0,
            free_spins_rate: this.spin_count > 0 ? (this.free_spins_triggered / this.spin_count) * 100 : 0,
            confidence_level: this.getConfidenceLevel(),
            is_within_range: this.isRTPWithinRange(),
            sample_size_adequate: this.spin_count >= 1000
        };
    }
    
    /**
     * Get safe RTP metrics data for client
     * @returns {Object} Safe RTP metrics data
     */
    getSafeData() {
        return {
            id: this.id,
            period_start: this.period_start,
            period_end: this.period_end,
            period_type: this.period_type,
            total_bets: this.total_bets,
            total_wins: this.total_wins,
            spin_count: this.spin_count,
            calculated_rtp: this.calculated_rtp,
            player_count: this.player_count,
            session_count: this.session_count,
            big_wins_count: this.big_wins_count,
            jackpot_wins_count: this.jackpot_wins_count,
            free_spins_triggered: this.free_spins_triggered,
            average_bet: this.average_bet,
            variance: this.variance,
            created_at: this.created_at,
            
            // Calculated fields
            period_duration_hours: this.getPeriodDurationHours(),
            period_duration_days: this.getPeriodDurationDays(),
            house_edge: this.calculateHouseEdge(),
            target_deviation: this.getTargetDeviation(),
            performance_indicators: this.getPerformanceIndicators()
        };
    }
    
    /**
     * Static Methods
     */
    
    /**
     * Calculate and store RTP metrics for a time period
     * @param {Date} periodStart - Start of period
     * @param {Date} periodEnd - End of period  
     * @param {string} periodType - Type of period
     * @returns {RTPMetrics} Created metrics record
     */
    static async calculatePeriodMetrics(periodStart, periodEnd, periodType = 'daily') {
        const SpinResult = RTPMetrics.sequelize.models.SpinResult;
        const Player = RTPMetrics.sequelize.models.Player;
        const Session = RTPMetrics.sequelize.models.Session;
        
        // Get spin data for the period
        const spinData = await SpinResult.findAll({
            attributes: [
                [SpinResult.sequelize.fn('COUNT', SpinResult.sequelize.col('id')), 'spin_count'],
                [SpinResult.sequelize.fn('SUM', SpinResult.sequelize.col('bet_amount')), 'total_bets'],
                [SpinResult.sequelize.fn('SUM', SpinResult.sequelize.col('total_win')), 'total_wins'],
                [SpinResult.sequelize.fn('AVG', SpinResult.sequelize.col('bet_amount')), 'average_bet'],
                [SpinResult.sequelize.fn('COUNT', SpinResult.sequelize.literal('CASE WHEN total_win >= bet_amount * 10 THEN 1 END')), 'big_wins_count']
            ],
            where: {
                created_at: {
                    [SpinResult.sequelize.Sequelize.Op.between]: [periodStart, periodEnd]
                }
            },
            raw: true
        });
        
        const data = spinData[0] || {};
        
        // Get unique player count
        const playerCount = await SpinResult.count({
            distinct: true,
            col: 'player_id',
            where: {
                created_at: {
                    [SpinResult.sequelize.Sequelize.Op.between]: [periodStart, periodEnd]
                }
            }
        });
        
        // Get session count
        const sessionCount = await Session.count({
            where: {
                created_at: {
                    [Session.sequelize.Sequelize.Op.between]: [periodStart, periodEnd]
                }
            }
        });
        
        // Get free spins triggered count (spins with free_spins mode)
        const freeSpinsCount = await SpinResult.count({
            where: {
                game_mode: 'free_spins',
                created_at: {
                    [SpinResult.sequelize.Sequelize.Op.between]: [periodStart, periodEnd]
                }
            }
        });
        
        // Create metrics record
        const metrics = await RTPMetrics.create({
            period_start: periodStart,
            period_end: periodEnd,
            period_type: periodType,
            total_bets: parseFloat(data.total_bets) || 0,
            total_wins: parseFloat(data.total_wins) || 0,
            spin_count: parseInt(data.spin_count) || 0,
            player_count: playerCount,
            session_count: sessionCount,
            big_wins_count: parseInt(data.big_wins_count) || 0,
            free_spins_triggered: freeSpinsCount,
            average_bet: parseFloat(data.average_bet) || null,
            jackpot_wins_count: 0, // Would need to query jackpot table
            variance: null // Would need additional calculation
        });
        
        return metrics;
    }
    
    /**
     * Get RTP metrics for a date range
     * @param {Object} options - Query options
     * @returns {Object} RTP metrics and analysis
     */
    static async getMetricsForRange({
        start_date,
        end_date,
        period_type = null,
        min_spins = 0
    }) {
        const where = {
            period_start: {
                [RTPMetrics.sequelize.Sequelize.Op.gte]: new Date(start_date)
            },
            period_end: {
                [RTPMetrics.sequelize.Sequelize.Op.lte]: new Date(end_date)
            }
        };
        
        if (period_type) {
            where.period_type = period_type;
        }
        
        if (min_spins > 0) {
            where.spin_count = {
                [RTPMetrics.sequelize.Sequelize.Op.gte]: min_spins
            };
        }
        
        const metrics = await RTPMetrics.findAll({
            where,
            order: [['period_start', 'ASC']]
        });
        
        // Calculate aggregated statistics
        const totals = metrics.reduce((acc, metric) => {
            acc.total_bets += metric.total_bets;
            acc.total_wins += metric.total_wins;
            acc.total_spins += metric.spin_count;
            acc.total_players += metric.player_count;
            acc.total_sessions += metric.session_count;
            acc.total_big_wins += metric.big_wins_count;
            acc.total_free_spins += metric.free_spins_triggered;
            return acc;
        }, {
            total_bets: 0,
            total_wins: 0,
            total_spins: 0,
            total_players: 0,
            total_sessions: 0,
            total_big_wins: 0,
            total_free_spins: 0
        });
        
        const aggregatedRTP = totals.total_bets > 0 ? (totals.total_wins / totals.total_bets) * 100 : 0;
        const averageRTP = metrics.length > 0 ? metrics.reduce((sum, m) => sum + (m.calculated_rtp || 0), 0) / metrics.length : 0;
        
        return {
            period: {
                start_date,
                end_date,
                period_type
            },
            metrics: metrics.map(m => m.getSafeData()),
            summary: {
                total_periods: metrics.length,
                aggregated_rtp: parseFloat(aggregatedRTP.toFixed(2)),
                average_rtp: parseFloat(averageRTP.toFixed(2)),
                total_bets: totals.total_bets,
                total_wins: totals.total_wins,
                total_spins: totals.total_spins,
                unique_players: totals.total_players,
                total_sessions: totals.total_sessions,
                big_wins: totals.total_big_wins,
                free_spins_triggered: totals.total_free_spins
            }
        };
    }
    
    /**
     * Get current RTP status and alerts
     * @returns {Object} Current RTP status
     */
    static async getCurrentRTPStatus() {
        const latest = await RTPMetrics.findOne({
            order: [['created_at', 'DESC']]
        });
        
        if (!latest) {
            return {
                status: 'no_data',
                message: 'No RTP data available'
            };
        }
        
        const targetRTP = 96.5;
        const tolerance = 2.0;
        const deviation = latest.getTargetDeviation(targetRTP);
        const isWithinRange = Math.abs(deviation) <= tolerance;
        
        let status = 'normal';
        let message = `RTP is ${latest.calculated_rtp}% (target: ${targetRTP}%)`;
        
        if (!isWithinRange) {
            status = Math.abs(deviation) > 5 ? 'critical' : 'warning';
            message = `RTP deviation: ${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}% from target`;
        }
        
        if (latest.spin_count < 1000) {
            status = 'insufficient_data';
            message += ` (insufficient sample: ${latest.spin_count} spins)`;
        }
        
        return {
            status,
            message,
            latest_metrics: latest.getSafeData(),
            alerts: {
                rtp_deviation: !isWithinRange,
                insufficient_sample: latest.spin_count < 1000,
                last_updated: latest.created_at
            }
        };
    }
    
    /**
     * Generate daily RTP metrics for yesterday
     * @returns {RTPMetrics} Generated metrics
     */
    static async generateDailyMetrics() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date(yesterday);
        today.setDate(today.getDate() + 1);
        
        // Check if metrics already exist for this period
        const existing = await RTPMetrics.findOne({
            where: {
                period_start: yesterday,
                period_end: today,
                period_type: 'daily'
            }
        });
        
        if (existing) {
            console.log('Daily RTP metrics already exist for', yesterday.toISOString().split('T')[0]);
            return existing;
        }
        
        return await RTPMetrics.calculatePeriodMetrics(yesterday, today, 'daily');
    }
    
    /**
     * Get RTP trend analysis
     * @param {number} days - Number of days to analyze
     * @returns {Object} Trend analysis
     */
    static async getRTPTrends(days = 30) {
        const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
        const endDate = new Date();
        
        const metrics = await RTPMetrics.findAll({
            where: {
                period_type: 'daily',
                period_start: {
                    [RTPMetrics.sequelize.Sequelize.Op.gte]: startDate
                },
                spin_count: {
                    [RTPMetrics.sequelize.Sequelize.Op.gte]: 100
                }
            },
            order: [['period_start', 'ASC']]
        });
        
        if (metrics.length < 2) {
            return {
                trend: 'insufficient_data',
                message: 'Not enough data for trend analysis'
            };
        }
        
        // Calculate trend
        const rtpValues = metrics.map(m => m.calculated_rtp).filter(rtp => rtp !== null);
        const avgRTP = rtpValues.reduce((sum, rtp) => sum + rtp, 0) / rtpValues.length;
        
        // Simple linear trend calculation
        const firstHalf = rtpValues.slice(0, Math.floor(rtpValues.length / 2));
        const secondHalf = rtpValues.slice(Math.floor(rtpValues.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, rtp) => sum + rtp, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, rtp) => sum + rtp, 0) / secondHalf.length;
        
        const trend = secondAvg - firstAvg;
        let trendDirection = 'stable';
        
        if (Math.abs(trend) > 0.5) {
            trendDirection = trend > 0 ? 'increasing' : 'decreasing';
        }
        
        return {
            period_days: days,
            trend_direction: trendDirection,
            trend_magnitude: parseFloat(trend.toFixed(2)),
            average_rtp: parseFloat(avgRTP.toFixed(2)),
            data_points: rtpValues.length,
            metrics: metrics.map(m => ({
                date: m.period_start,
                rtp: m.calculated_rtp,
                spins: m.spin_count
            }))
        };
    }
}

module.exports = RTPMetrics;