/**
 * Config Manager Service
 * 
 * Handles reading, writing, validating, and backing up game configuration.
 * Manages config versioning and rollback functionality.
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, '../game/gameEngine.js');
    this.backupDir = path.join(__dirname, '../../backups/config');
    this.configHistory = [];
  }

  /**
   * Read current game configuration
   * @returns {Promise<Object>} Current game config
   */
  async readCurrentConfig() {
    try {
      // Clear require cache to get fresh config
      delete require.cache[require.resolve('../game/gameEngine.js')];
      const GameEngine = require('../game/gameEngine');
      
      // Extract GAME_CONFIG from the file
      const fileContent = await fs.readFile(this.configPath, 'utf8');
      const configMatch = fileContent.match(/const GAME_CONFIG = ({[\s\S]*?^});/m);
      
      if (!configMatch) {
        throw new Error('Could not parse GAME_CONFIG from gameEngine.js');
      }

      // Get the actual config object
      const gameEngine = new GameEngine();
      const config = gameEngine.gameConfig;

      return {
        symbolWeights: config.SYMBOL_WEIGHTS,
        scatterChance: config.SCATTER_CHANCE,
        multiplierTable: config.RANDOM_MULTIPLIER.WEIGHTED_TABLE,
        rtp: config.RTP,
        freeSpinsConfig: {
          scatter4PlusSpins: config.FREE_SPINS.SCATTER_4_PLUS,
          retriggerSpins: config.FREE_SPINS.RETRIGGER_SPINS,
          buyFeatureCost: config.FREE_SPINS.BUY_FEATURE_COST,
          buyFeatureSpins: config.FREE_SPINS.BUY_FEATURE_SPINS,
          baseMultiplier: config.FREE_SPINS.BASE_MULTIPLIER,
          accumTriggerChance: config.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE
        },
        cascadeMultiplier: config.CASCADE_RANDOM_MULTIPLIER
      };
    } catch (error) {
      logger.error('Failed to read current config', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate symbol weights
    if (config.symbolWeights) {
      Object.entries(config.symbolWeights).forEach(([symbol, weight]) => {
        if (typeof weight !== 'number' || weight <= 0) {
          errors.push(`Invalid weight for ${symbol}: must be positive number`);
        }
      });

      // Check for required symbols
      const requiredSymbols = [
        'time_gem', 'space_gem', 'mind_gem', 'power_gem', 
        'reality_gem', 'soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos'
      ];
      requiredSymbols.forEach(symbol => {
        if (!config.symbolWeights[symbol]) {
          errors.push(`Missing required symbol: ${symbol}`);
        }
      });
    }

    // Validate scatter chance
    if (config.scatterChance !== undefined) {
      if (typeof config.scatterChance !== 'number' || 
          config.scatterChance < 0.001 || 
          config.scatterChance > 0.2) {
        errors.push('Scatter chance must be between 0.001 and 0.2');
      }
    }

    // Validate multiplier table
    if (config.multiplierTable) {
      if (!Array.isArray(config.multiplierTable)) {
        errors.push('Multiplier table must be an array');
      } else {
        let totalWeight = 0;
        config.multiplierTable.forEach((entry, index) => {
          if (!entry.multiplier || !entry.weight) {
            errors.push(`Multiplier table entry ${index} missing multiplier or weight`);
          }
          if (typeof entry.weight !== 'number' || entry.weight <= 0) {
            errors.push(`Invalid weight at multiplier table entry ${index}`);
          }
          totalWeight += entry.weight || 0;
        });

        // Check total weight (should be close to 100)
        if (Math.abs(totalWeight - 100) > 1) {
          warnings.push(`Multiplier weights sum to ${totalWeight.toFixed(2)}%, not 100%`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create backup of current configuration
   * @param {String} adminId - Admin who initiated the backup
   * @returns {Promise<String>} Backup file path
   */
  async createBackup(adminId) {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `gameEngine_${timestamp}_${adminId}.backup.js`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Copy current config file
      const currentContent = await fs.readFile(this.configPath, 'utf8');
      await fs.writeFile(backupPath, currentContent, 'utf8');

      logger.info('Config backup created', {
        adminId,
        backupPath,
        timestamp
      });

      return backupPath;
    } catch (error) {
      logger.error('Failed to create config backup', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Apply new configuration to gameEngine.js
   * @param {Object} newConfig - New configuration
   * @param {String} adminId - Admin applying the config
   * @returns {Promise<Object>} Apply result
   */
  async applyConfig(newConfig, adminId) {
    try {
      // Validate config first
      const validation = this.validateConfig(newConfig);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Create backup before applying
      const backupPath = await this.createBackup(adminId);

      // Read current file
      let fileContent = await fs.readFile(this.configPath, 'utf8');

      // Update SYMBOL_WEIGHTS
      if (newConfig.symbolWeights) {
        const weightsStr = this.formatSymbolWeights(newConfig.symbolWeights);
        fileContent = fileContent.replace(
          /SYMBOL_WEIGHTS:\s*{[^}]*}/,
          `SYMBOL_WEIGHTS: ${weightsStr}`
        );
      }

      // Update SCATTER_CHANCE
      if (newConfig.scatterChance !== undefined) {
        fileContent = fileContent.replace(
          /SCATTER_CHANCE:\s*[\d.]+/,
          `SCATTER_CHANCE: ${newConfig.scatterChance}`
        );
      }

      // Update RANDOM_MULTIPLIER.WEIGHTED_TABLE
      if (newConfig.multiplierTable) {
        const tableStr = this.formatMultiplierTable(newConfig.multiplierTable);
        fileContent = fileContent.replace(
          /WEIGHTED_TABLE:\s*\[[^\]]*\]/s,
          `WEIGHTED_TABLE: ${tableStr}`
        );
      }

      // Write updated config
      await fs.writeFile(this.configPath, fileContent, 'utf8');

      // Clear require cache to force reload
      delete require.cache[require.resolve('../game/gameEngine.js')];

      // Add to history
      this.configHistory.push({
        timestamp: new Date().toISOString(),
        adminId,
        backupPath,
        changes: newConfig
      });

      logger.info('Config applied successfully', {
        adminId,
        backupPath,
        changes: Object.keys(newConfig)
      });

      return {
        success: true,
        backupPath,
        warnings: validation.warnings
      };
    } catch (error) {
      logger.error('Failed to apply config', {
        adminId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Rollback to a previous backup
   * @param {String} backupPath - Path to backup file
   * @param {String} adminId - Admin performing rollback
   * @returns {Promise<Boolean>}
   */
  async rollback(backupPath, adminId) {
    try {
      // Verify backup exists
      await fs.access(backupPath);

      // Create backup of current state before rollback
      const currentBackupPath = await this.createBackup(`${adminId}_pre_rollback`);

      // Read backup content
      const backupContent = await fs.readFile(backupPath, 'utf8');

      // Write backup content to current config
      await fs.writeFile(this.configPath, backupContent, 'utf8');

      // Clear require cache
      delete require.cache[require.resolve('../game/gameEngine.js')];

      logger.info('Config rolled back successfully', {
        adminId,
        backupPath,
        currentBackupPath
      });

      return true;
    } catch (error) {
      logger.error('Failed to rollback config', {
        adminId,
        backupPath,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get list of available backups
   * @returns {Promise<Array>} List of backups
   */
  async listBackups() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const files = await fs.readdir(this.backupDir);
      
      const backups = await Promise.all(
        files
          .filter(f => f.endsWith('.backup.js'))
          .map(async (file) => {
            const filePath = path.join(this.backupDir, file);
            const stats = await fs.stat(filePath);
            return {
              filename: file,
              path: filePath,
              created: stats.mtime,
              size: stats.size
            };
          })
      );

      // Sort by date descending
      backups.sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      logger.error('Failed to list backups', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Format symbol weights for file output
   */
  formatSymbolWeights(weights) {
    const entries = Object.entries(weights)
      .map(([symbol, weight]) => `    ${symbol}: ${weight}`)
      .join(',\n');
    return `{\n${entries}\n  }`;
  }

  /**
   * Format multiplier table for file output
   */
  formatMultiplierTable(table) {
    const entries = table
      .map(entry => `      { multiplier: ${entry.multiplier},   weight: ${entry.weight} }`)
      .join(',\n');
    return `[\n${entries}\n    ]`;
  }

  /**
   * Get config change history
   * @returns {Array} History of config changes
   */
  getHistory() {
    return [...this.configHistory];
  }
}

// Singleton instance
const configManagerInstance = new ConfigManager();

module.exports = configManagerInstance;

