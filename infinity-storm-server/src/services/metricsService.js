// Metrics service with simulated data for dashboard functionality
// Database integration will be added when PostgreSQL is set up

class MetricsService {
    constructor() {
        this.realtimeCache = {
            activePlayers: 0,
            totalSpinsLastHour: 0,
            revenueLastHour: 0,
            avgResponseTime: 0,
            systemHealth: 'healthy',
            lastUpdated: new Date()
        };
        
        // Start background metrics collection
        this.startMetricsCollection();
    }

    /**
     * Get comprehensive dashboard metrics
     */
    async getDashboardMetrics(timeframe = '24h') {
        try {
            const [
                financialMetrics,
                gameMetrics,
                playerMetrics,
                systemMetrics,
                rtpMetrics,
                complianceMetrics
            ] = await Promise.all([
                this.getFinancialMetrics(timeframe),
                this.getGameMetrics(timeframe),
                this.getPlayerMetrics(timeframe),
                this.getSystemMetrics(timeframe),
                this.getRTPMetrics(timeframe),
                this.getComplianceMetrics(timeframe)
            ]);

            return {
                timestamp: new Date(),
                timeframe,
                financial: financialMetrics,
                game: gameMetrics,
                player: playerMetrics,
                system: systemMetrics,
                rtp: rtpMetrics,
                compliance: complianceMetrics,
                realtime: this.realtimeCache
            };
        } catch (error) {
            console.error('Error getting dashboard metrics:', error);
            throw error;
        }
    }

    /**
     * Get financial metrics and trends
     */
    async getFinancialMetrics(timeframe) {
        try {
            // For now, return simulated data with realistic casino metrics
            // In a production environment, this would query the actual database
            const baseWagered = 25000 + Math.random() * 10000;
            const targetRTP = 96.5;
            const totalWagered = Math.round(baseWagered);
            const totalWon = Math.round(totalWagered * (targetRTP / 100));
            const revenue = totalWagered - totalWon;
            const rtp = totalWagered > 0 ? (totalWon / totalWagered * 100) : 0;
            const totalSpins = Math.round(totalWagered / 2.5); // Avg bet $2.50
            const avgBetSize = totalSpins > 0 ? totalWagered / totalSpins : 0;

            // Credit flow simulation
            const creditsAdded = Math.round(totalWagered * 1.2); // Players add more than they wager
            const creditsWithdrawn = Math.round(totalWon * 0.8); // Not all winnings are withdrawn
            
            // Generate hourly trend data
            const revenueTrend = this.generateHourlyTrend(24, revenue / 24);
            const rtpTrend = this.generateHourlyTrend(24, rtp, 2);

            return {
                totalWagered,
                totalWon,
                revenue,
                rtp: parseFloat(rtp.toFixed(2)),
                totalSpins,
                avgBetSize: parseFloat(avgBetSize.toFixed(2)),
                creditsAdded,
                creditsWithdrawn,
                netCreditFlow: creditsAdded - creditsWithdrawn,
                revenueTrend,
                rtpTrend,
                profitMargin: totalWagered > 0 ? ((revenue / totalWagered) * 100) : 0
            };
        } catch (error) {
            console.error('Error getting financial metrics:', error);
            // Return default metrics on error
            return {
                totalWagered: 0,
                totalWon: 0,
                revenue: 0,
                rtp: 0,
                totalSpins: 0,
                avgBetSize: 0,
                creditsAdded: 0,
                creditsWithdrawn: 0,
                netCreditFlow: 0,
                revenueTrend: [],
                rtpTrend: [],
                profitMargin: 0
            };
        }
    }

    /**
     * Get game analytics and feature usage
     */
    async getGameMetrics(timeframe) {
        try {
            // Simulate realistic game metrics
            const totalSessions = Math.round(150 + Math.random() * 100);
            const featureUsage = {
                freeSpinsTriggered: Math.round(totalSessions * 0.15), // 15% trigger free spins
                burstModeActivations: Math.round(totalSessions * 0.08), // 8% burst mode
                bigWins: Math.round(totalSessions * 0.03), // 3% big wins
                maxWins: Math.round(totalSessions * 0.005) // 0.5% max wins
            };

            const symbolPopularity = {
                'time_gem': Math.round(totalSessions * 2.1),
                'space_gem': Math.round(totalSessions * 2.0),
                'mind_gem': Math.round(totalSessions * 1.9),
                'power_gem': Math.round(totalSessions * 1.8),
                'reality_gem': Math.round(totalSessions * 1.7),
                'soul_gem': Math.round(totalSessions * 1.6),
                'thanos_weapon': Math.round(totalSessions * 0.8),
                'scarlet_witch': Math.round(totalSessions * 0.6),
                'thanos': Math.round(totalSessions * 0.4)
            };

            const betSizeDistribution = {
                '<$1': Math.round(totalSessions * 0.2),
                '$1-$9': Math.round(totalSessions * 0.4),
                '$10-$49': Math.round(totalSessions * 0.25),
                '$50-$99': Math.round(totalSessions * 0.1),
                '$100+': Math.round(totalSessions * 0.05)
            };

            const hourlyActivity = this.generateHourlyActivity();
            const avgSessionDuration = 8.5 + Math.random() * 3; // 8.5-11.5 minutes avg

            return {
                featureUsage,
                symbolPopularity,
                betSizeDistribution,
                hourlyActivity,
                avgSessionDuration,
                totalSessions
            };
        } catch (error) {
            console.error('Error getting game metrics:', error);
            return {
                featureUsage: { freeSpinsTriggered: 0, burstModeActivations: 0, bigWins: 0, maxWins: 0 },
                symbolPopularity: {},
                betSizeDistribution: {},
                hourlyActivity: new Array(24).fill(0),
                avgSessionDuration: 0,
                totalSessions: 0
            };
        }
    }

    /**
     * Get player analytics and behavior metrics
     */
    async getPlayerMetrics(timeframe) {
        try {
            // Simulate realistic player metrics
            const totalPlayers = 850 + Math.round(Math.random() * 200);
            const activeUsers = Math.round(totalPlayers * 0.25); // 25% active in 24h
            const newUsers = Math.round(totalPlayers * 0.08); // 8% new users

            const playerSegments = {
                whales: Math.round(totalPlayers * 0.02), // 2% whales
                highRollers: Math.round(totalPlayers * 0.08), // 8% high rollers
                regular: Math.round(totalPlayers * 0.35), // 35% regular
                casual: Math.round(totalPlayers * 0.55) // 55% casual
            };

            const retentionData = {
                day1: 85.2 + Math.random() * 5,
                day7: 42.1 + Math.random() * 8,
                day30: 18.5 + Math.random() * 5
            };

            const avgSessionsPerUser = 3.2 + Math.random() * 1.5;

            const topPlayers = [
                { username: 'Player***1', totalWagered: 15420, totalWon: 14890, profit: 530 },
                { username: 'Player***2', totalWagered: 12850, totalWon: 12200, profit: 650 },
                { username: 'Player***3', totalWagered: 9750, totalWon: 9100, profit: 650 },
                { username: 'Player***4', totalWagered: 8900, totalWon: 8450, profit: 450 },
                { username: 'Player***5', totalWagered: 7650, totalWon: 7200, profit: 450 }
            ];

            return {
                totalPlayers,
                activeUsers,
                newUsers,
                playerSegments,
                retentionData,
                avgSessionsPerUser: parseFloat(avgSessionsPerUser.toFixed(1)),
                topPlayers
            };
        } catch (error) {
            console.error('Error getting player metrics:', error);
            return {
                totalPlayers: 0,
                activeUsers: 0,
                newUsers: 0,
                playerSegments: { whales: 0, highRollers: 0, regular: 0, casual: 0 },
                retentionData: { day1: 0, day7: 0, day30: 0 },
                avgSessionsPerUser: 0,
                topPlayers: []
            };
        }
    }

    /**
     * Get system health and performance metrics
     */
    async getSystemMetrics(timeframe) {
        try {
            // Simulate realistic system metrics
            const totalRequests = 1250 + Math.round(Math.random() * 500);
            const errorCount = Math.round(totalRequests * 0.02); // 2% error rate
            const avgResponseTime = 45 + Math.random() * 30; // 45-75ms
            const errorRate = totalRequests > 0 ? (errorCount / totalRequests * 100) : 0;

            const systemHealth = {
                cpu_usage: 15 + Math.random() * 25, // 15-40%
                memory_usage: 35 + Math.random() * 20, // 35-55%
                disk_usage: 28 + Math.random() * 15, // 28-43%
                uptime_hours: 168 + Math.random() * 336 // 1-3 weeks
            };

            const dbMetrics = {
                active_connections: 8 + Math.round(Math.random() * 12),
                query_performance: 'good',
                cache_hit_ratio: 95.2 + Math.random() * 3
            };

            const apiEndpointStats = {
                '/api/spin': {
                    requests: Math.round(totalRequests * 0.4),
                    avgResponseTime: 65 + Math.random() * 20,
                    errorRate: 1.2 + Math.random() * 1,
                    errors: Math.round(errorCount * 0.6)
                },
                '/api/auth/login': {
                    requests: Math.round(totalRequests * 0.15),
                    avgResponseTime: 120 + Math.random() * 30,
                    errorRate: 3.1 + Math.random() * 2,
                    errors: Math.round(errorCount * 0.25)
                },
                '/api/wallet/balance': {
                    requests: Math.round(totalRequests * 0.2),
                    avgResponseTime: 35 + Math.random() * 15,
                    errorRate: 0.8 + Math.random() * 0.5,
                    errors: Math.round(errorCount * 0.1)
                }
            };

            return {
                avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
                errorRate: parseFloat(errorRate.toFixed(2)),
                totalRequests,
                errorCount,
                systemHealth,
                dbMetrics,
                apiEndpointStats
            };
        } catch (error) {
            console.error('Error getting system metrics:', error);
            return {
                avgResponseTime: 0,
                errorRate: 0,
                totalRequests: 0,
                errorCount: 0,
                systemHealth: { cpu_usage: 0, memory_usage: 0, disk_usage: 0, uptime_hours: 0 },
                dbMetrics: {},
                apiEndpointStats: {}
            };
        }
    }

    /**
     * Get RTP monitoring and compliance metrics
     */
    async getRTPMetrics(timeframe) {
        try {
            const targetRTP = 96.5;
            // Simulate realistic RTP with small variance
            const currentRTP = targetRTP + (Math.random() - 0.5) * 1.5; // ±0.75% variance
            const deviation = Math.abs(currentRTP - targetRTP);
            
            // RTP alerts
            const alerts = [];
            if (deviation > 2.0) {
                alerts.push({
                    type: 'critical',
                    message: `RTP deviation of ${deviation.toFixed(2)}% exceeds acceptable range`,
                    timestamp: new Date()
                });
            } else if (deviation > 1.0) {
                alerts.push({
                    type: 'warning',
                    message: `RTP deviation of ${deviation.toFixed(2)}% requires monitoring`,
                    timestamp: new Date()
                });
            }

            // Generate RTP trend data
            const rtpTrend = this.generateRTPTrend(24, currentRTP);

            return {
                currentRTP: parseFloat(currentRTP.toFixed(2)),
                targetRTP,
                deviation: parseFloat(deviation.toFixed(2)),
                status: deviation > 2.0 ? 'critical' : deviation > 1.0 ? 'warning' : 'healthy',
                alerts,
                rtpTrend,
                complianceScore: Math.max(0, 100 - (deviation * 10))
            };
        } catch (error) {
            console.error('Error getting RTP metrics:', error);
            return {
                currentRTP: 96.5,
                targetRTP: 96.5,
                deviation: 0,
                status: 'healthy',
                alerts: [],
                rtpTrend: [],
                complianceScore: 100
            };
        }
    }

    /**
     * Get compliance and audit metrics
     */
    async getComplianceMetrics(timeframe) {
        try {
            // Simulate compliance status
            const complianceChecks = {
                rtp_compliance: true,
                transaction_integrity: true,
                audit_trail_complete: true,
                player_protection: true,
                responsible_gaming: true
            };

            // Simulate audit events
            const auditSummary = {
                total_events: 1420 + Math.round(Math.random() * 200),
                admin_actions: 89 + Math.round(Math.random() * 20),
                system_events: 1250 + Math.round(Math.random() * 150),
                player_events: 81 + Math.round(Math.random() * 30)
            };

            // Simulate suspicious transaction count
            const suspiciousTransactions = Math.round(Math.random() * 3); // 0-3 flagged

            return {
                complianceChecks,
                auditSummary,
                suspiciousTransactions,
                regulatoryStatus: 'compliant',
                lastAuditDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                nextAuditDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000)
            };
        } catch (error) {
            console.error('Error getting compliance metrics:', error);
            return {
                complianceChecks: {
                    rtp_compliance: true,
                    transaction_integrity: true,
                    audit_trail_complete: true,
                    player_protection: true,
                    responsible_gaming: true
                },
                auditSummary: {
                    total_events: 0,
                    admin_actions: 0,
                    system_events: 0,
                    player_events: 0
                },
                suspiciousTransactions: 0,
                regulatoryStatus: 'unknown',
                lastAuditDate: new Date(),
                nextAuditDate: new Date()
            };
        }
    }

    /**
     * Get real-time metrics for WebSocket updates
     */
    async getRealtimeMetrics() {
        try {
            // Simulate real-time data updates
            this.realtimeCache.activePlayers = Math.max(0, this.realtimeCache.activePlayers + Math.floor(Math.random() * 6 - 3)); // ±3 variance
            this.realtimeCache.totalSpinsLastHour = 150 + Math.round(Math.random() * 50);
            this.realtimeCache.revenueLastHour = 875 + Math.round(Math.random() * 200);
            this.realtimeCache.avgResponseTime = 45 + Math.random() * 30;
            this.realtimeCache.systemHealth = 'healthy';
            this.realtimeCache.lastUpdated = new Date();
            
            return this.realtimeCache;
        } catch (error) {
            console.error('Error updating realtime metrics:', error);
            return this.realtimeCache;
        }
    }

    /**
     * Start background metrics collection
     */
    startMetricsCollection() {
        // Update realtime metrics every minute
        setInterval(() => {
            this.getRealtimeMetrics();
        }, 60000);

        // Update RTP monitoring every 5 minutes
        setInterval(() => {
            this.updateRTPMonitoring();
        }, 5 * 60000);

        console.log('Metrics collection started');
    }

    /**
     * Update RTP monitoring data
     */
    async updateRTPMonitoring() {
        try {
            // Simulate RTP monitoring updates
            // In production, this would update RTP data in the database
            console.log('RTP monitoring updated with simulated data');
        } catch (error) {
            console.error('Error updating RTP monitoring:', error);
        }
    }

    // Helper methods
    getTimeClause(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case '1h':
                return new Date(now.getTime() - 60 * 60 * 1000);
            case '24h':
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            default:
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
    }

    getBetRange(betSize) {
        if (betSize >= 100) return '$100+';
        if (betSize >= 50) return '$50-$99';
        if (betSize >= 10) return '$10-$49';
        if (betSize >= 1) return '$1-$9';
        return '<$1';
    }

    generateHourlyTrend(hours, baseValue, variance = 0.3) {
        const trend = [];
        for (let i = 0; i < hours; i++) {
            const variation = (Math.random() - 0.5) * 2 * variance;
            const value = Math.max(0, baseValue * (1 + variation));
            trend.push({
                hour: i,
                value: parseFloat(value.toFixed(2))
            });
        }
        return trend;
    }

    generateHourlyActivity() {
        // Simulate realistic activity patterns (peak hours: 8pm-11pm)
        const hourlyActivity = [];
        for (let hour = 0; hour < 24; hour++) {
            let baseActivity = 20; // Base activity level
            
            // Peak hours simulation
            if (hour >= 20 && hour <= 23) {
                baseActivity = 80;
            } else if (hour >= 18 && hour <= 21) {
                baseActivity = 60;
            } else if (hour >= 12 && hour <= 17) {
                baseActivity = 40;
            } else if (hour >= 6 && hour <= 11) {
                baseActivity = 35;
            } else {
                baseActivity = 15; // Late night/early morning
            }
            
            const variance = baseActivity * 0.3 * (Math.random() - 0.5);
            hourlyActivity.push(Math.max(0, Math.round(baseActivity + variance)));
        }
        return hourlyActivity;
    }

    generateRTPTrend(hours, currentRTP) {
        const trend = [];
        for (let i = 0; i < hours; i++) {
            const variance = (Math.random() - 0.5) * 0.5; // Small RTP variance
            const rtp = currentRTP + variance;
            trend.push({
                timestamp: new Date(Date.now() - (hours - i) * 60 * 60 * 1000),
                rtp: parseFloat(rtp.toFixed(2)),
                sample_size: 100 + Math.round(Math.random() * 200)
            });
        }
        return trend;
    }


}

module.exports = new MetricsService();