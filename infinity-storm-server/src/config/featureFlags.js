/**
 * Server-Side Feature Flags
 * 
 * Centralized feature flag management for controlled rollout and A/B testing.
 * Flags can be toggled via environment variables or runtime API calls.
 * 
 * Usage:
 *   const { featureFlags } = require('./config/featureFlags');
 *   if (featureFlags.isEnabled('SERVER_CASCADE_PREEXPANSION')) {
 *     // use droppingSymbols
 *   }
 */

class FeatureFlags {
  constructor() {
    // Default flag states (can be overridden by environment variables)
    this.flags = {
      // Client-Server Sync Features
      SERVER_CASCADE_PREEXPANSION: this.getEnvFlag('SERVER_CASCADE_PREEXPANSION', true),
      PAYLOAD_SIZE_MONITORING: this.getEnvFlag('PAYLOAD_SIZE_MONITORING', true),
      SUPABASE_SPIN_RECORDING: this.getEnvFlag('SUPABASE_SPIN_RECORDING', true),
      
      // Performance & Optimization
      RESPONSE_COMPRESSION: this.getEnvFlag('RESPONSE_COMPRESSION', true),
      CASCADE_RESULT_CACHING: this.getEnvFlag('CASCADE_RESULT_CACHING', false),
      
      // Validation & Security
      STRICT_RNG_VALIDATION: this.getEnvFlag('STRICT_RNG_VALIDATION', true),
      ANTI_CHEAT_ENABLED: this.getEnvFlag('ANTI_CHEAT_ENABLED', true),
      RATE_LIMIT_STRICT: this.getEnvFlag('RATE_LIMIT_STRICT', false),
      
      // Debug & Monitoring
      VERBOSE_SPIN_LOGGING: this.getEnvFlag('VERBOSE_SPIN_LOGGING', false),
      ADMIN_METRICS_ENABLED: this.getEnvFlag('ADMIN_METRICS_ENABLED', true),
      SERVER_DEBUG_ENDPOINTS: this.getEnvFlag('SERVER_DEBUG_ENDPOINTS', false),
      
      // Game Features
      FREE_SPINS_ENABLED: this.getEnvFlag('FREE_SPINS_ENABLED', true),
      PROGRESSIVE_MULTIPLIERS: this.getEnvFlag('PROGRESSIVE_MULTIPLIERS', true),
      BONUS_BUY_FEATURE: this.getEnvFlag('BONUS_BUY_FEATURE', false),
      
      // Database
      POSTGRES_FALLBACK: this.getEnvFlag('POSTGRES_FALLBACK', true),
      REDIS_SESSIONS: this.getEnvFlag('REDIS_SESSIONS', false),
    };
    
    // Track flag state changes for audit
    this.flagHistory = [];
  }
  
  /**
   * Get flag value from environment variable
   * @param {string} flagName 
   * @param {boolean} defaultValue 
   * @returns {boolean}
   */
  getEnvFlag(flagName, defaultValue) {
    const envKey = `FEATURE_${flagName}`;
    const envValue = process.env[envKey];
    
    if (envValue === undefined) {
      return defaultValue;
    }
    
    // Parse various truthy/falsy strings
    const normalized = String(envValue).toLowerCase().trim();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
    
    return defaultValue;
  }
  
  /**
   * Check if a feature flag is enabled
   * @param {string} flagName 
   * @returns {boolean}
   */
  isEnabled(flagName) {
    if (!(flagName in this.flags)) {
      console.warn(`FeatureFlag: Unknown flag '${flagName}', returning false`);
      return false;
    }
    return Boolean(this.flags[flagName]);
  }
  
  /**
   * Set a feature flag at runtime (for admin control or A/B testing)
   * @param {string} flagName 
   * @param {boolean} enabled 
   * @param {string} [reason] - Optional reason for audit trail
   */
  setFlag(flagName, enabled, reason = 'Runtime toggle') {
    if (!(flagName in this.flags)) {
      throw new Error(`FeatureFlag: Cannot set unknown flag '${flagName}'`);
    }
    
    const oldValue = this.flags[flagName];
    this.flags[flagName] = Boolean(enabled);
    
    // Audit trail
    this.flagHistory.push({
      timestamp: new Date().toISOString(),
      flag: flagName,
      oldValue,
      newValue: this.flags[flagName],
      reason
    });
    
    console.log(`FeatureFlag: ${flagName} changed from ${oldValue} to ${this.flags[flagName]} - ${reason}`);
  }
  
  /**
   * Get all current flag states
   * @returns {Object}
   */
  getAllFlags() {
    return { ...this.flags };
  }
  
  /**
   * Get flag change history (for admin dashboard)
   * @returns {Array}
   */
  getHistory() {
    return [...this.flagHistory];
  }
  
  /**
   * Bulk enable/disable flags by category
   * @param {string} category - 'debug', 'security', 'performance', etc.
   * @param {boolean} enabled 
   */
  setCategoryFlags(category, enabled) {
    const categoryMap = {
      debug: ['VERBOSE_SPIN_LOGGING', 'SERVER_DEBUG_ENDPOINTS'],
      security: ['STRICT_RNG_VALIDATION', 'ANTI_CHEAT_ENABLED', 'RATE_LIMIT_STRICT'],
      performance: ['RESPONSE_COMPRESSION', 'CASCADE_RESULT_CACHING'],
      sync: ['SERVER_CASCADE_PREEXPANSION', 'PAYLOAD_SIZE_MONITORING', 'SUPABASE_SPIN_RECORDING']
    };
    
    const flagsInCategory = categoryMap[category.toLowerCase()];
    if (!flagsInCategory) {
      throw new Error(`FeatureFlag: Unknown category '${category}'`);
    }
    
    flagsInCategory.forEach(flagName => {
      this.setFlag(flagName, enabled, `Category '${category}' bulk toggle`);
    });
  }
}

// Singleton instance
const featureFlags = new FeatureFlags();

// Log initial state in non-production
if (process.env.NODE_ENV !== 'production') {
  console.log('FeatureFlags initialized:', featureFlags.getAllFlags());
}

module.exports = {
  featureFlags,
  FeatureFlags // Export class for testing
};

