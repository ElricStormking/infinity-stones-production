/**
 * Feature Flags System
 * 
 * Enables gradual rollout of server synchronization and other features
 * with instant rollback capability and A/B testing support.
 * 
 * Features:
 * - Gradual rollout (percentage-based)
 * - Consistent player assignment (hash-based)
 * - Validation mode (run both systems for comparison)
 * - Instant rollback via environment variable
 * - A/B testing framework
 */

class FeatureFlags {
    constructor() {
        // Load configuration from environment or localStorage
        this.flags = this.loadFlags();
        
        // Cache for player assignments
        this.playerAssignments = new Map();
        
        console.log('🚩 FeatureFlags initialized:', this.flags);
    }
    
    /**
     * Load feature flags from configuration
     */
    loadFlags() {
        // Try to load from window.GameConfig first (set by server)
        if (window.GameConfig && window.GameConfig.featureFlags) {
            return window.GameConfig.featureFlags;
        }
        
        // Fallback to defaults
        return {
            serverSync: {
                enabled: this.getEnvBoolean('SERVER_SYNC_ENABLED', true),
                rolloutPercent: this.getEnvNumber('SERVER_SYNC_ROLLOUT', 100),
                validationMode: this.getEnvBoolean('SYNC_VALIDATION_MODE', false),
                forceDemo: this.getEnvBoolean('FORCE_DEMO_MODE', false)
            },
            spritePooling: {
                enabled: this.getEnvBoolean('SPRITE_POOLING_ENABLED', true),
                maxPoolSize: this.getEnvNumber('MAX_POOL_SIZE', 1000)
            },
            errorRecovery: {
                enabled: this.getEnvBoolean('ERROR_RECOVERY_ENABLED', true),
                maxRetries: this.getEnvNumber('MAX_RETRIES', 3),
                offlineQueueEnabled: this.getEnvBoolean('OFFLINE_QUEUE_ENABLED', true)
            },
            performance: {
                fpsMonitoring: this.getEnvBoolean('FPS_MONITORING', window.DEBUG),
                metricsEnabled: this.getEnvBoolean('METRICS_ENABLED', true)
            },
            experimental: {
                webGL: this.getEnvBoolean('EXPERIMENTAL_WEBGL', false),
                advancedShaders: this.getEnvBoolean('ADVANCED_SHADERS', false)
            }
        };
    }
    
    /**
     * Get boolean from environment or localStorage
     */
    getEnvBoolean(key, defaultValue) {
        // Check localStorage first
        const stored = localStorage.getItem(`feature_${key}`);
        if (stored !== null) {
            return stored === 'true';
        }
        
        // Check window config
        if (window.GameConfig && typeof window.GameConfig[key] !== 'undefined') {
            return Boolean(window.GameConfig[key]);
        }
        
        return defaultValue;
    }
    
    /**
     * Get number from environment or localStorage
     */
    getEnvNumber(key, defaultValue) {
        const stored = localStorage.getItem(`feature_${key}`);
        if (stored !== null) {
            const num = parseInt(stored, 10);
            return isNaN(num) ? defaultValue : num;
        }
        
        if (window.GameConfig && typeof window.GameConfig[key] !== 'undefined') {
            return parseInt(window.GameConfig[key], 10) || defaultValue;
        }
        
        return defaultValue;
    }
    
    /**
     * Check if player should use server synchronization
     * Uses consistent hashing to ensure same player always gets same assignment
     */
    shouldUseServerSync(playerId = null) {
        const config = this.flags.serverSync;
        
        // Check if feature is enabled at all
        if (!config.enabled) {
            console.log('🚩 Server sync: disabled globally');
            return false;
        }
        
        // Force demo mode if configured
        if (config.forceDemo) {
            console.log('🚩 Server sync: force demo mode');
            return false;
        }
        
        // If no player ID, check if we're authenticated
        if (!playerId) {
            playerId = localStorage.getItem('playerId') || 'anonymous';
        }
        
        // Check cached assignment
        if (this.playerAssignments.has(playerId)) {
            return this.playerAssignments.get(playerId);
        }
        
        // 100% rollout means everyone gets it
        if (config.rolloutPercent >= 100) {
            this.playerAssignments.set(playerId, true);
            console.log('🚩 Server sync: enabled (100% rollout)');
            return true;
        }
        
        // 0% rollout means no one gets it
        if (config.rolloutPercent <= 0) {
            this.playerAssignments.set(playerId, false);
            console.log('🚩 Server sync: disabled (0% rollout)');
            return false;
        }
        
        // Hash player ID for consistent assignment
        const hash = this.hashPlayerId(playerId);
        const assigned = (hash % 100) < config.rolloutPercent;
        
        this.playerAssignments.set(playerId, assigned);
        console.log(`🚩 Server sync: ${assigned ? 'enabled' : 'disabled'} (${config.rolloutPercent}% rollout, hash: ${hash})`);
        
        return assigned;
    }
    
    /**
     * Hash player ID to a consistent number 0-99
     * Simple hash function for consistent A/B assignment
     */
    hashPlayerId(playerId) {
        if (!playerId) return 0;
        
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            const char = playerId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return Math.abs(hash) % 100;
    }
    
    /**
     * Check if validation mode is enabled
     * In validation mode, both server and client calculate results for comparison
     */
    isValidationMode() {
        return this.flags.serverSync.validationMode;
    }
    
    /**
     * Check if sprite pooling is enabled
     */
    isSpritePoolingEnabled() {
        return this.flags.spritePooling.enabled;
    }
    
    /**
     * Get sprite pool configuration
     */
    getSpritePoolConfig() {
        return this.flags.spritePooling;
    }
    
    /**
     * Check if error recovery is enabled
     */
    isErrorRecoveryEnabled() {
        return this.flags.errorRecovery.enabled;
    }
    
    /**
     * Get error recovery configuration
     */
    getErrorRecoveryConfig() {
        return this.flags.errorRecovery;
    }
    
    /**
     * Check if FPS monitoring is enabled
     */
    isFPSMonitoringEnabled() {
        return this.flags.performance.fpsMonitoring;
    }
    
    /**
     * Check if metrics collection is enabled
     */
    isMetricsEnabled() {
        return this.flags.performance.metricsEnabled;
    }
    
    /**
     * Check if experimental feature is enabled
     */
    isExperimentalEnabled(feature) {
        return this.flags.experimental[feature] || false;
    }
    
    /**
     * Override flag for testing/debugging
     */
    setFlag(category, flag, value) {
        if (this.flags[category]) {
            this.flags[category][flag] = value;
            localStorage.setItem(`feature_${category}_${flag}`, value.toString());
            console.log(`🚩 Flag override: ${category}.${flag} = ${value}`);
            
            // Clear player assignments cache when server sync changes
            if (category === 'serverSync') {
                this.playerAssignments.clear();
            }
        }
    }
    
    /**
     * Get all flags for debugging
     */
    getAllFlags() {
        return JSON.parse(JSON.stringify(this.flags));
    }
    
    /**
     * Reset all flags to defaults
     */
    resetFlags() {
        // Clear localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('feature_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Reload flags
        this.flags = this.loadFlags();
        this.playerAssignments.clear();
        
        console.log('🚩 Feature flags reset to defaults');
    }
    
    /**
     * Log current feature flag state
     */
    logState() {
        console.group('🚩 Feature Flags State');
        console.log('Server Sync:', this.flags.serverSync);
        console.log('Sprite Pooling:', this.flags.spritePooling);
        console.log('Error Recovery:', this.flags.errorRecovery);
        console.log('Performance:', this.flags.performance);
        console.log('Experimental:', this.flags.experimental);
        console.log('Player Assignments:', Array.from(this.playerAssignments.entries()));
        console.groupEnd();
    }
}

// Create global instance
window.FeatureFlags = new FeatureFlags();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeatureFlags;
}

