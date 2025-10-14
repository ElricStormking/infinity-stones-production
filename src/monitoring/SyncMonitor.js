/**
 * Synchronization Monitoring System
 * 
 * Tracks and reports on server-client synchronization quality,
 * performance metrics, and triggers alerts for anomalies.
 * 
 * Features:
 * - Real-time sync rate monitoring
 * - Performance metrics collection
 * - Automatic anomaly detection
 * - Alert threshold management
 * - Historical metrics retention
 */

class SyncMonitor {
    constructor() {
        this.metrics = {
            totalSpins: 0,
            successfulSyncs: 0,
            checksumMismatches: 0,
            networkErrors: 0,
            timeoutErrors: 0,
            averageResponseTime: 0,
            peakResponseTime: 0,
            lastAlertTime: 0,
            startTime: Date.now()
        };
        
        this.responseTimes = [];
        this.maxResponseTimeSamples = 100;
        
        this.recentErrors = [];
        this.maxErrorHistory = 50;
        
        this.alertConfig = {
            minSyncRate: 0.999, // 99.9% sync rate threshold
            maxResponseTime: 1000, // 1 second
            alertCooldown: 300000, // 5 minutes between alerts
            enabled: true
        };
        
        // Metrics buffer for batched reporting
        this.metricsBuffer = [];
        this.reportInterval = 30000; // Report every 30 seconds
        
        // Start reporting if metrics are enabled
        if (this.isMetricsEnabled()) {
            this.startMetricsReporting();
        }
        
        console.log('📊 SyncMonitor initialized');
    }
    
    /**
     * Record a spin result
     */
    recordSpinResult(result) {
        this.metrics.totalSpins++;
        
        // Check checksum validation
        if (result.checksumValid !== false) {
            this.metrics.successfulSyncs++;
        } else {
            this.metrics.checksumMismatches++;
            this.recordError('CHECKSUM_MISMATCH', result);
            this.checkAlertThresholds();
        }
        
        // Record response time
        if (result.processingTime) {
            this.recordResponseTime(result.processingTime);
        }
        
        // Buffer for reporting
        this.bufferMetric({
            type: 'spin_result',
            timestamp: Date.now(),
            success: result.checksumValid !== false,
            responseTime: result.processingTime
        });
    }
    
    /**
     * Record network error
     */
    recordNetworkError(error) {
        this.metrics.networkErrors++;
        this.recordError('NETWORK_ERROR', error);
        
        if (this.metrics.networkErrors > 10) {
            this.checkAlertThresholds();
        }
    }
    
    /**
     * Record timeout error
     */
    recordTimeoutError(error) {
        this.metrics.timeoutErrors++;
        this.recordError('TIMEOUT_ERROR', error);
    }
    
    /**
     * Record response time
     */
    recordResponseTime(time) {
        this.responseTimes.push(time);
        
        // Keep only recent samples
        if (this.responseTimes.length > this.maxResponseTimeSamples) {
            this.responseTimes.shift();
        }
        
        // Update average
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageResponseTime = Math.round(sum / this.responseTimes.length);
        
        // Update peak
        if (time > this.metrics.peakResponseTime) {
            this.metrics.peakResponseTime = time;
        }
        
        // Check if response time is concerning
        if (time > this.alertConfig.maxResponseTime) {
            this.checkAlertThresholds();
        }
    }
    
    /**
     * Record error with details
     */
    recordError(type, details) {
        const error = {
            type,
            timestamp: Date.now(),
            details: this.sanitizeError(details)
        };
        
        this.recentErrors.push(error);
        
        // Keep only recent errors
        if (this.recentErrors.length > this.maxErrorHistory) {
            this.recentErrors.shift();
        }
        
        // Buffer for reporting
        this.bufferMetric({
            type: 'error',
            error
        });
    }
    
    /**
     * Sanitize error object for logging
     */
    sanitizeError(error) {
        if (!error) return null;
        
        if (typeof error === 'string') {
            return { message: error };
        }
        
        return {
            message: error.message || error.error || 'Unknown error',
            code: error.code,
            status: error.status || error.response?.status,
            timestamp: error.timestamp
        };
    }
    
    /**
     * Check if alerts should be triggered
     */
    checkAlertThresholds() {
        if (!this.alertConfig.enabled) return;
        
        const now = Date.now();
        const timeSinceLastAlert = now - this.metrics.lastAlertTime;
        
        // Cooldown check
        if (timeSinceLastAlert < this.alertConfig.alertCooldown) {
            return;
        }
        
        const syncRate = this.getSyncRate();
        const avgResponseTime = this.metrics.averageResponseTime;
        
        // Check sync rate threshold
        if (syncRate < this.alertConfig.minSyncRate) {
            this.sendAlert('SYNC_RATE_LOW', {
                syncRate: (syncRate * 100).toFixed(2) + '%',
                threshold: (this.alertConfig.minSyncRate * 100).toFixed(2) + '%',
                mismatches: this.metrics.checksumMismatches,
                totalSpins: this.metrics.totalSpins
            });
        }
        
        // Check response time threshold
        if (avgResponseTime > this.alertConfig.maxResponseTime) {
            this.sendAlert('RESPONSE_TIME_HIGH', {
                averageResponseTime: avgResponseTime + 'ms',
                threshold: this.alertConfig.maxResponseTime + 'ms',
                peakResponseTime: this.metrics.peakResponseTime + 'ms'
            });
        }
        
        // Check network errors
        if (this.metrics.networkErrors > 20) {
            this.sendAlert('NETWORK_ERRORS_HIGH', {
                networkErrors: this.metrics.networkErrors,
                timeoutErrors: this.metrics.timeoutErrors
            });
        }
    }
    
    /**
     * Send alert
     */
    sendAlert(type, data) {
        const alert = {
            type,
            timestamp: Date.now(),
            data,
            metrics: this.getMetricsSummary()
        };
        
        console.warn('🚨 SYNC MONITOR ALERT:', type, data);
        
        // Dispatch event for UI handling
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-monitor-alert', {
                detail: alert
            }));
        }
        
        // Send to server if available
        this.reportAlertToServer(alert);
        
        this.metrics.lastAlertTime = Date.now();
    }
    
    /**
     * Get current sync rate
     */
    getSyncRate() {
        if (this.metrics.totalSpins === 0) return 1.0;
        return this.metrics.successfulSyncs / this.metrics.totalSpins;
    }
    
    /**
     * Get metrics summary
     */
    getMetricsSummary() {
        const uptime = Date.now() - this.metrics.startTime;
        
        return {
            syncRate: this.getSyncRate(),
            totalSpins: this.metrics.totalSpins,
            successfulSyncs: this.metrics.successfulSyncs,
            checksumMismatches: this.metrics.checksumMismatches,
            networkErrors: this.metrics.networkErrors,
            timeoutErrors: this.metrics.timeoutErrors,
            averageResponseTime: this.metrics.averageResponseTime,
            peakResponseTime: this.metrics.peakResponseTime,
            uptime: uptime,
            recentErrors: this.recentErrors.slice(-5) // Last 5 errors
        };
    }
    
    /**
     * Get recent errors
     */
    getRecentErrors(count = 10) {
        return this.recentErrors.slice(-count);
    }
    
    /**
     * Buffer metric for batched reporting
     */
    bufferMetric(metric) {
        this.metricsBuffer.push(metric);
        
        // Limit buffer size
        if (this.metricsBuffer.length > 1000) {
            this.metricsBuffer.shift();
        }
    }
    
    /**
     * Start metrics reporting
     */
    startMetricsReporting() {
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
        }
        
        this.reportingInterval = setInterval(() => {
            this.reportMetrics();
        }, this.reportInterval);
        
        console.log('📊 Metrics reporting started (interval: 30s)');
    }
    
    /**
     * Stop metrics reporting
     */
    stopMetricsReporting() {
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
            this.reportingInterval = null;
        }
    }
    
    /**
     * Report metrics to server
     */
    async reportMetrics() {
        if (this.metricsBuffer.length === 0) return;
        
        const report = {
            timestamp: Date.now(),
            summary: this.getMetricsSummary(),
            events: [...this.metricsBuffer]
        };
        
        // Clear buffer
        this.metricsBuffer = [];
        
        try {
            // Send to server if NetworkService is available
            if (window.NetworkService && window.NetworkService.api) {
                await window.NetworkService.api.post('/api/admin/sync-metrics', report);
            }
        } catch (error) {
            console.warn('📊 Failed to report metrics:', error.message);
        }
    }
    
    /**
     * Report alert to server
     */
    async reportAlertToServer(alert) {
        try {
            if (window.NetworkService && window.NetworkService.api) {
                await window.NetworkService.api.post('/api/admin/sync-alert', alert);
            }
        } catch (error) {
            console.warn('🚨 Failed to report alert:', error.message);
        }
    }
    
    /**
     * Check if metrics collection is enabled
     */
    isMetricsEnabled() {
        return !window.FeatureFlags || window.FeatureFlags.isMetricsEnabled();
    }
    
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalSpins: 0,
            successfulSyncs: 0,
            checksumMismatches: 0,
            networkErrors: 0,
            timeoutErrors: 0,
            averageResponseTime: 0,
            peakResponseTime: 0,
            lastAlertTime: 0,
            startTime: Date.now()
        };
        
        this.responseTimes = [];
        this.recentErrors = [];
        this.metricsBuffer = [];
        
        console.log('📊 Metrics reset');
    }
    
    /**
     * Get full state for debugging
     */
    getState() {
        return {
            metrics: { ...this.metrics },
            syncRate: this.getSyncRate(),
            responseTimes: [...this.responseTimes],
            recentErrors: [...this.recentErrors],
            alertConfig: { ...this.alertConfig },
            bufferedEventsCount: this.metricsBuffer.length
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.stopMetricsReporting();
        this.metricsBuffer = [];
        console.log('📊 SyncMonitor destroyed');
    }
}

// Create global instance
window.SyncMonitor = new SyncMonitor();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncMonitor;
}

