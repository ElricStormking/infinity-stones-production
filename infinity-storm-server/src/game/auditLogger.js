/**
 * Audit Logger - Comprehensive Game State Audit Trail System
 *
 * Provides complete audit logging for regulatory compliance including:
 * - State change tracking
 * - Transaction logging
 * - Player behavior monitoring
 * - Security event logging
 * - Performance metrics tracking
 *
 * Features:
 * - Multi-level logging (DEBUG, INFO, WARN, ERROR, AUDIT)
 * - Structured JSON logging
 * - Log rotation and archival
 * - Real-time log streaming
 * - Compliance-ready audit trails
 * - Performance-optimized logging
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class AuditLogger {
  constructor(config = {}) {
    this.config = {
      // Log file configuration
      logDir: config.logDir || path.join(__dirname, '../../logs'),
      maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
      maxFiles: config.maxFiles || 10,
      rotateInterval: config.rotateInterval || 24 * 60 * 60 * 1000, // 24 hours

      // Log levels
      logLevel: config.logLevel || 'INFO',
      auditLevel: config.auditLevel || 'AUDIT',

      // Compliance settings
      enableCompliance: config.enableCompliance !== false,
      enableEncryption: config.enableEncryption || false,
      encryptionKey: config.encryptionKey,

      // Performance settings
      bufferSize: config.bufferSize || 100,
      flushInterval: config.flushInterval || 5000, // 5 seconds
      asyncLogging: config.asyncLogging !== false
    };

    // Log levels hierarchy
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      AUDIT: 4,
      CRITICAL: 5
    };

    // Current log files
    this.logFiles = {
      audit: path.join(this.config.logDir, 'audit.log'),
      state: path.join(this.config.logDir, 'state.log'),
      security: path.join(this.config.logDir, 'security.log'),
      performance: path.join(this.config.logDir, 'performance.log'),
      error: path.join(this.config.logDir, 'error.log')
    };

    // Log buffer for batch processing
    this.logBuffer = [];
    this.bufferTimer = null;

    // Audit trail tracking
    this.auditChain = [];
    this.lastAuditHash = null;

    // Performance metrics
    this.metrics = {
      logsWritten: 0,
      bytesLogged: 0,
      errorsLogged: 0,
      auditsLogged: 0,
      averageWriteTime: 0
    };

    this.initializeLogger();
  }

  /**
     * Initialize the audit logger
     */
  async initializeLogger() {
    try {
      // Ensure log directory exists
      await this.ensureLogDirectory();

      // Start log rotation timer
      this.startRotationTimer();

      // Start buffer flush timer
      this.startFlushTimer();

      // Log system startup
      await this.logSystemEvent('audit_logger_initialized', {
        config: this.config,
        log_files: this.logFiles,
        timestamp: new Date().toISOString()
      });

      console.log('AuditLogger: Initialized successfully');

    } catch (error) {
      console.error('AuditLogger: Initialization failed:', error);
      throw error;
    }
  }

  /**
     * Log session event
     * @param {string} playerId - Player ID
     * @param {string} sessionId - Session ID
     * @param {string} eventType - Event type
     * @param {Object} data - Additional data
     */
  async logSessionEvent(playerId, sessionId, eventType, data = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      category: 'session',
      event_type: eventType,
      player_id: playerId,
      session_id: sessionId,
      data,
      source: 'state_manager',
      compliance_required: true
    };

    await this.writeAuditLog(auditEntry);
  }

  /**
     * Log state creation
     * @param {string} playerId - Player ID
     * @param {string} stateId - State ID
     * @param {Object} initialState - Initial state data
     */
  async logStateCreation(playerId, stateId, initialState = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      category: 'state',
      event_type: 'state_created',
      player_id: playerId,
      state_id: stateId,
      data: {
        initial_state: initialState,
        creation_context: 'new_player_state'
      },
      source: 'state_manager',
      compliance_required: true
    };

    await this.writeAuditLog(auditEntry);
  }

  /**
     * Log state update
     * @param {string} playerId - Player ID
     * @param {Object} stateSnapshot - State change snapshot
     * @param {Object} metadata - Update metadata
     */
  async logStateUpdate(playerId, stateSnapshot, metadata = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      category: 'state',
      event_type: 'state_updated',
      player_id: playerId,
      data: {
        state_snapshot: stateSnapshot,
        metadata,
        hash: this.generateStateHash(stateSnapshot)
      },
      source: 'state_manager',
      compliance_required: true
    };

    await this.writeAuditLog(auditEntry);
    await this.updateAuditChain(auditEntry);
  }

  /**
     * Log spin processing
     * @param {string} playerId - Player ID
     * @param {Object} spinResult - Spin result data
     * @param {Object} stateUpdates - State updates applied
     */
  async logSpinProcessed(playerId, spinResult, stateUpdates) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      category: 'gameplay',
      event_type: 'spin_processed',
      player_id: playerId,
      data: {
        spin_id: spinResult.id,
        spin_result: spinResult,
        state_updates: stateUpdates,
        win_amount: spinResult.totalWin,
        game_mode: stateUpdates.game_mode
      },
      source: 'state_manager',
      compliance_required: true
    };

    await this.writeAuditLog(auditEntry);
  }

  /**
     * Log state validation failure
     * @param {string} playerId - Player ID
     * @param {Array} errors - Validation errors
     * @param {Object} context - Validation context
     */
  async logStateValidationFailure(playerId, errors, context = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      category: 'validation',
      event_type: 'state_validation_failed',
      player_id: playerId,
      data: {
        validation_errors: errors,
        context,
        severity: 'HIGH'
      },
      source: 'state_validator',
      compliance_required: true,
      alert_required: true
    };

    await this.writeSecurityLog(auditEntry);
    this.metrics.errorsLogged++;
  }

  /**
     * Log anti-cheat violation
     * @param {string} playerId - Player ID
     * @param {string} violationType - Type of violation
     * @param {Array} violations - List of violations
     * @param {Object} context - Additional context
     */
  async logAntiCheatViolation(playerId, violationType, violations, context = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'CRITICAL',
      category: 'security',
      event_type: 'anti_cheat_violation',
      player_id: playerId,
      data: {
        violation_type: violationType,
        violations,
        context,
        risk_score: context.riskScore || 0
      },
      source: 'anti_cheat',
      compliance_required: true,
      alert_required: true,
      immediate_action_required: true
    };

    await this.writeSecurityLog(auditEntry);
    this.metrics.errorsLogged++;
  }

  /**
     * Log system event
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
  async logSystemEvent(eventType, data = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'system',
      event_type: eventType,
      data,
      source: 'system',
      compliance_required: false
    };

    await this.writeAuditLog(auditEntry);
  }

  /**
     * Log error event
     * @param {string} playerId - Player ID (optional)
     * @param {string} errorType - Error type
     * @param {Object} errorData - Error data
     */
  async logError(playerId, errorType, errorData = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      category: 'error',
      event_type: errorType,
      player_id: playerId || null,
      data: {
        error_data: errorData,
        stack_trace: errorData.stack || null
      },
      source: 'system',
      compliance_required: true
    };

    await this.writeErrorLog(auditEntry);
    this.metrics.errorsLogged++;
  }

  /**
     * Log performance metric
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {Object} context - Additional context
     */
  async logPerformanceMetric(metric, value, context = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'performance',
      event_type: 'metric_recorded',
      data: {
        metric_name: metric,
        metric_value: value,
        context,
        unit: context.unit || 'ms'
      },
      source: 'performance_monitor',
      compliance_required: false
    };

    await this.writePerformanceLog(auditEntry);
  }

  /**
     * Write audit log entry
     * @param {Object} auditEntry - Audit entry to write
     */
  async writeAuditLog(auditEntry) {
    const logEntry = this.formatLogEntry(auditEntry);
    await this.writeLog('audit', logEntry);

    if (auditEntry.compliance_required) {
      this.metrics.auditsLogged++;
    }
  }

  /**
     * Write security log entry
     * @param {Object} auditEntry - Security entry to write
     */
  async writeSecurityLog(auditEntry) {
    const logEntry = this.formatLogEntry(auditEntry);
    await this.writeLog('security', logEntry);

    // Also write to audit log for compliance
    if (auditEntry.compliance_required) {
      await this.writeLog('audit', logEntry);
      this.metrics.auditsLogged++;
    }
  }

  /**
     * Write state log entry
     * @param {Object} auditEntry - State entry to write
     */
  async writeStateLog(auditEntry) {
    const logEntry = this.formatLogEntry(auditEntry);
    await this.writeLog('state', logEntry);
  }

  /**
     * Write performance log entry
     * @param {Object} auditEntry - Performance entry to write
     */
  async writePerformanceLog(auditEntry) {
    const logEntry = this.formatLogEntry(auditEntry);
    await this.writeLog('performance', logEntry);
  }

  /**
     * Write error log entry
     * @param {Object} auditEntry - Error entry to write
     */
  async writeErrorLog(auditEntry) {
    const logEntry = this.formatLogEntry(auditEntry);
    await this.writeLog('error', logEntry);

    // Also write to audit log
    await this.writeLog('audit', logEntry);
    this.metrics.auditsLogged++;
  }

  /**
     * Write log to file
     * @param {string} logType - Log type (audit, state, security, etc.)
     * @param {string} logEntry - Formatted log entry
     */
  async writeLog(logType, logEntry) {
    const startTime = Date.now();

    try {
      if (this.config.asyncLogging) {
        // Add to buffer for batch processing
        this.logBuffer.push({
          type: logType,
          entry: logEntry,
          timestamp: Date.now()
        });

        // Flush buffer if it's full
        if (this.logBuffer.length >= this.config.bufferSize) {
          await this.flushBuffer();
        }
      } else {
        // Write immediately
        await this.writeToFile(logType, logEntry);
      }

      // Update metrics
      this.updateWriteMetrics(startTime, logEntry.length);

    } catch (error) {
      console.error(`AuditLogger: Error writing ${logType} log:`, error);
      // Fallback to console logging
      console.log(`AUDIT_LOG_FALLBACK: ${logEntry}`);
    }
  }

  /**
     * Write directly to file
     * @param {string} logType - Log type
     * @param {string} logEntry - Log entry
     */
  async writeToFile(logType, logEntry) {
    const logFile = this.logFiles[logType];
    if (!logFile) {
      throw new Error(`Unknown log type: ${logType}`);
    }

    // Check if rotation is needed
    await this.checkAndRotateLog(logFile);

    // Encrypt if enabled
    const finalEntry = this.config.enableEncryption ?
      this.encryptLogEntry(logEntry) : logEntry;

    // Write to file
    await fs.appendFile(logFile, finalEntry + '\n', 'utf8');
  }

  /**
     * Format log entry
     * @param {Object} auditEntry - Raw audit entry
     * @returns {string} Formatted log entry
     */
  formatLogEntry(auditEntry) {
    const entry = {
      timestamp: auditEntry.timestamp,
      level: auditEntry.level,
      id: auditEntry.id,
      category: auditEntry.category,
      event_type: auditEntry.event_type,
      player_id: auditEntry.player_id,
      session_id: auditEntry.session_id,
      data: auditEntry.data,
      source: auditEntry.source,
      compliance_required: auditEntry.compliance_required || false,
      alert_required: auditEntry.alert_required || false,
      immediate_action_required: auditEntry.immediate_action_required || false
    };

    // Add integrity hash for compliance
    if (this.config.enableCompliance) {
      entry.integrity_hash = this.generateIntegrityHash(entry);
    }

    return JSON.stringify(entry);
  }

  /**
     * Flush log buffer
     */
  async flushBuffer() {
    if (this.logBuffer.length === 0) {return;}

    const startTime = Date.now();
    const buffer = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Group by log type
      const logGroups = buffer.reduce((groups, item) => {
        if (!groups[item.type]) {groups[item.type] = [];}
        groups[item.type].push(item.entry);
        return groups;
      }, {});

      // Write each group
      const writePromises = Object.entries(logGroups).map(([logType, entries]) => {
        const content = entries.join('\n') + '\n';
        return this.writeToFile(logType, content.slice(0, -1)); // Remove extra newline
      });

      await Promise.all(writePromises);

      console.log(`AuditLogger: Flushed ${buffer.length} log entries in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('AuditLogger: Error flushing buffer:', error);
      // Re-add failed entries to buffer
      this.logBuffer.unshift(...buffer);
    }
  }

  /**
     * Start flush timer
     */
  startFlushTimer() {
    if (this.config.asyncLogging) {
      this.bufferTimer = setInterval(() => {
        this.flushBuffer().catch(error => {
          console.error('AuditLogger: Error in scheduled flush:', error);
        });
      }, this.config.flushInterval);
    }
  }

  /**
     * Start rotation timer
     */
  startRotationTimer() {
    setInterval(() => {
      this.rotateAllLogs().catch(error => {
        console.error('AuditLogger: Error in log rotation:', error);
      });
    }, this.config.rotateInterval);
  }

  /**
     * Ensure log directory exists
     */
  async ensureLogDirectory() {
    try {
      await fs.access(this.config.logDir);
    } catch (error) {
      await fs.mkdir(this.config.logDir, { recursive: true });
    }
  }

  /**
     * Check and rotate log if needed
     * @param {string} logFile - Log file path
     */
  async checkAndRotateLog(logFile) {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLog(logFile);
      }
    } catch (error) {
      // File doesn't exist yet, no need to rotate
    }
  }

  /**
     * Rotate a log file
     * @param {string} logFile - Log file path
     */
  async rotateLog(logFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = `${logFile}.${timestamp}`;

    try {
      await fs.rename(logFile, rotatedFile);
      console.log(`AuditLogger: Rotated log file: ${path.basename(logFile)}`);

      // Clean up old rotated files
      await this.cleanupOldLogs(logFile);

    } catch (error) {
      console.error('AuditLogger: Error rotating log file:', error);
    }
  }

  /**
     * Rotate all log files
     */
  async rotateAllLogs() {
    const rotatePromises = Object.values(this.logFiles).map(logFile =>
      this.checkAndRotateLog(logFile)
    );

    await Promise.all(rotatePromises);
  }

  /**
     * Check if rotation is needed
     * @returns {Promise<boolean>} True if rotation needed
     */
  async rotateIfNeeded() {
    // This method can be called externally to trigger rotation
    await this.rotateAllLogs();
    return true;
  }

  /**
     * Clean up old log files
     * @param {string} baseLogFile - Base log file path
     */
  async cleanupOldLogs(baseLogFile) {
    try {
      const logDir = path.dirname(baseLogFile);
      const baseName = path.basename(baseLogFile);
      const files = await fs.readdir(logDir);

      // Find all rotated versions of this log file
      const rotatedFiles = files
        .filter(file => file.startsWith(baseName + '.'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file)
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      // Keep only the configured number of files
      if (rotatedFiles.length > this.config.maxFiles) {
        const filesToDelete = rotatedFiles.slice(this.config.maxFiles);

        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          console.log(`AuditLogger: Cleaned up old log file: ${file.name}`);
        }
      }

    } catch (error) {
      console.error('AuditLogger: Error cleaning up old logs:', error);
    }
  }

  /**
     * Generate state hash for integrity
     * @param {Object} stateSnapshot - State snapshot
     * @returns {string} SHA-256 hash
     */
  generateStateHash(stateSnapshot) {
    const stateString = JSON.stringify(stateSnapshot, Object.keys(stateSnapshot).sort());
    return crypto.createHash('sha256').update(stateString).digest('hex');
  }

  /**
     * Generate integrity hash for log entry
     * @param {Object} entry - Log entry
     * @returns {string} Integrity hash
     */
  generateIntegrityHash(entry) {
    // Create a copy without the integrity_hash field
    const entryForHash = { ...entry };
    delete entryForHash.integrity_hash;

    const entryString = JSON.stringify(entryForHash, Object.keys(entryForHash).sort());
    return crypto.createHash('sha256').update(entryString).digest('hex');
  }

  /**
     * Update audit chain
     * @param {Object} auditEntry - Audit entry
     */
  async updateAuditChain(auditEntry) {
    const chainEntry = {
      id: auditEntry.id,
      timestamp: auditEntry.timestamp,
      previous_hash: this.lastAuditHash,
      entry_hash: this.generateIntegrityHash(auditEntry)
    };

    const chainString = JSON.stringify(chainEntry, Object.keys(chainEntry).sort());
    const chainHash = crypto.createHash('sha256').update(chainString).digest('hex');

    chainEntry.chain_hash = chainHash;
    this.lastAuditHash = chainHash;

    this.auditChain.push(chainEntry);

    // Keep only last 1000 chain entries in memory
    if (this.auditChain.length > 1000) {
      this.auditChain.shift();
    }
  }

  /**
     * Encrypt log entry
     * @param {string} logEntry - Log entry to encrypt
     * @returns {string} Encrypted log entry
     */
  encryptLogEntry(logEntry) {
    if (!this.config.encryptionKey) {
      return logEntry;
    }

    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
      let encrypted = cipher.update(logEntry, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `ENCRYPTED:${encrypted}`;

    } catch (error) {
      console.error('AuditLogger: Encryption failed:', error);
      return logEntry;
    }
  }

  /**
     * Update write metrics
     * @param {number} startTime - Write start time
     * @param {number} dataSize - Data size written
     */
  updateWriteMetrics(startTime, dataSize) {
    const writeTime = Date.now() - startTime;

    this.metrics.logsWritten++;
    this.metrics.bytesLogged += dataSize;

    // Update average write time (exponential moving average)
    this.metrics.averageWriteTime = this.metrics.averageWriteTime === 0 ?
      writeTime :
      (this.metrics.averageWriteTime * 0.9) + (writeTime * 0.1);
  }

  /**
     * Get audit statistics
     * @returns {Object} Audit statistics
     */
  getStats() {
    return {
      ...this.metrics,
      buffer_size: this.logBuffer.length,
      audit_chain_length: this.auditChain.length,
      last_audit_hash: this.lastAuditHash,
      log_files: this.logFiles,
      config: this.config
    };
  }

  /**
     * Search audit logs
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Search results
     */
  async searchLogs(criteria) {
    // This is a basic implementation - in production you'd want
    // a more sophisticated log search system

    const results = [];

    try {
      for (const [logType, logFile] of Object.entries(this.logFiles)) {
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);

            if (this.matchesCriteria(entry, criteria)) {
              results.push({
                log_type: logType,
                entry
              });
            }
          } catch (error) {
            // Skip malformed lines
          }
        }
      }

      return results.sort((a, b) =>
        new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime()
      );

    } catch (error) {
      console.error('AuditLogger: Error searching logs:', error);
      return [];
    }
  }

  /**
     * Check if entry matches search criteria
     * @param {Object} entry - Log entry
     * @param {Object} criteria - Search criteria
     * @returns {boolean} True if matches
     */
  matchesCriteria(entry, criteria) {
    for (const [key, value] of Object.entries(criteria)) {
      if (entry[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
     * Close audit logger
     */
  async close() {
    console.log('AuditLogger: Shutting down...');

    // Clear timers
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
    }

    // Flush any remaining logs
    if (this.logBuffer.length > 0) {
      await this.flushBuffer();
    }

    // Log shutdown
    await this.logSystemEvent('audit_logger_shutdown', {
      final_metrics: this.metrics,
      shutdown_timestamp: new Date().toISOString()
    });

    console.log('AuditLogger: Shutdown complete');
  }
}

module.exports = AuditLogger;