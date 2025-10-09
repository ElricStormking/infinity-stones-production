/**
 * State Manager - Core Game State Management System
 *
 * Provides comprehensive game state management with:
 * - Session tracking and recovery
 * - State persistence and validation
 * - Anti-cheat protection integration
 * - Audit logging and compliance
 * - Redis caching for performance
 *
 * Features:
 * - Concurrent session support
 * - Automatic state recovery on disconnection
 * - Real-time state synchronization
 * - Complete audit trail
 * - Casino-grade security validation
 */

const { GameState, Player, Session } = require('../models');
const { getRedisClient, shouldSkipRedis } = require('../config/redis');
const AntiCheat = require('./antiCheat');
const StateValidator = require('./stateValidator');
const AuditLogger = require('./auditLogger');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class StateManager {
  constructor() {
    this.redis = null;
    this.activeSessions = new Map(); // In-memory active sessions
    this.stateCache = new Map();     // LRU state cache
    this.antiCheat = new AntiCheat();
    this.stateValidator = new StateValidator();
    this.auditLogger = new AuditLogger();
    this.demoState = null;
    this.demoSession = null;

    // State change event emitters
    this.eventHandlers = new Map();

    this.redisEnabled = !shouldSkipRedis;
    // Initialize Redis connection
    this.initializeRedis();

    // Cleanup intervals
    this.startCleanupTasks();
  }

  /**
     * Initialize Redis connection for caching
     */
  async initializeRedis() {
    if (!this.redisEnabled) {
      this.redis = null;
      console.log('StateManager: Redis disabled (SKIP_REDIS)');
      return;
    }

    try {
      this.redis = getRedisClient();
      await this.redis.ping();
      console.log('StateManager: Redis connection established');
    } catch (error) {
      console.error('StateManager: Redis connection failed:', error.message);
      // Continue without Redis - fallback to database only
      this.redis = null;
      this.redisEnabled = false;
    }
  }

  /**
     * Start background cleanup tasks
     */
  startCleanupTasks() {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    // Clean up state cache every 10 minutes
    setInterval(() => {
      this.cleanupStateCache();
    }, 10 * 60 * 1000);

    // Audit log rotation every hour
    setInterval(() => {
      this.auditLogger.rotateIfNeeded();
    }, 60 * 60 * 1000);
  }

  /**
     * Create or resume game session
     * @param {string} playerId - Player ID
     * @param {string} sessionId - Session ID (optional)
     * @param {Object} clientData - Client connection data
     * @returns {Promise<Object>} Session and state data
     */
  async createOrResumeSession(playerId, sessionId = null, clientData = {}) {
    const startTime = Date.now();

    try {
      // Validate player exists
      const player = await Player.findByPk(playerId);
      if (!player) {
        throw new Error(`Player not found: ${playerId}`);
      }

      // Check for existing active session
      let existingSession = null;
      if (sessionId) {
        existingSession = await Session.findByPk(sessionId);
        if (existingSession && existingSession.player_id !== playerId) {
          throw new Error('Session belongs to different player');
        }
      }

      // Get or create game state
      let gameState = await this.getPlayerState(playerId);
      if (!gameState) {
        gameState = await this.createInitialState(playerId, sessionId);
      }

      // Validate state integrity
      const validationResult = await this.stateValidator.validateState(gameState);
      if (!validationResult.valid) {
        await this.auditLogger.logStateValidationFailure(playerId, validationResult.errors);
        throw new Error(`State validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Anti-cheat verification
      const antiCheatResult = await this.antiCheat.validateSessionStart(playerId, gameState, clientData);
      if (!antiCheatResult.valid) {
        await this.auditLogger.logAntiCheatViolation(playerId, 'session_start', antiCheatResult.violations);
        throw new Error(`Anti-cheat validation failed: ${antiCheatResult.violations.join(', ')}`);
      }

      // Create session record
      const sessionData = {
        id: sessionId || uuidv4(),
        player_id: playerId,
        game_state_id: gameState.id,
        session_data: {
          client_data: clientData,
          resumed: !!existingSession,
          created_at: new Date().toISOString()
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      const session = existingSession ?
        await this.updateSession(existingSession, sessionData) :
        await Session.create(sessionData);

      // Update game state with session
      gameState.session_id = session.id;
      await gameState.save();

      // Cache active session
      this.activeSessions.set(session.id, {
        playerId,
        gameStateId: gameState.id,
        lastActivity: Date.now(),
        clientData
      });

      // Cache state in Redis
      await this.cacheState(gameState);

      // Log session creation/resume
      await this.auditLogger.logSessionEvent(playerId, session.id,
        existingSession ? 'session_resumed' : 'session_created', {
          session_duration: Date.now() - startTime,
          game_mode: gameState.game_mode,
          free_spins_remaining: gameState.free_spins_remaining
        });

      // Emit session event
      this.emitEvent('session_created', { playerId, sessionId: session.id, gameState });

      return {
        session: session.toJSON(),
        gameState: gameState.getSafeData(),
        resumed: !!existingSession,
        validationChecks: {
          stateValidation: validationResult,
          antiCheatValidation: antiCheatResult
        }
      };

    } catch (error) {
      await this.auditLogger.logError(playerId, 'session_creation_failed', {
        error: error.message,
        sessionId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
     * Get current player state with caching
     * @param {string} playerId - Player ID
     * @returns {Promise<GameState|null>} Game state or null
     */
  async getPlayerState(playerId) {
    if (playerId === 'demo-player' && this.demoState) {
      return this.demoState;
    }
    try {
      // Check cache first
      const cachedState = this.stateCache.get(playerId);
      if (cachedState && Date.now() - cachedState.cached_at < 30000) { // 30 second cache
        return cachedState.state;
      }

      // Check Redis cache
      if (this.redis) {
        const redisKey = `game_state:${playerId}`;
        const cachedData = await this.redis.get(redisKey);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          // Recreate GameState instance from cached data
          const gameState = GameState.build(parsedData, { isNewRecord: false });
          this.stateCache.set(playerId, { state: gameState, cached_at: Date.now() });
          return gameState;
        }
      }

      // Get from database
      const gameState = await GameState.getCurrentState(playerId);
      if (gameState) {
        await this.cacheState(gameState);
      }

      return gameState;

    } catch (error) {
      console.error(`StateManager: Error getting player state for ${playerId}:`, error);
      throw error;
    }
  }

  /**
     * Create initial state for new player
     * @param {string} playerId - Player ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<GameState>} New game state
     */
  async createInitialState(playerId, sessionId = null) {
    const gameState = await GameState.create({
      player_id: playerId,
      session_id: sessionId,
      game_mode: 'base',
      free_spins_remaining: 0,
      accumulated_multiplier: 1.00,
      state_data: {
        created_at: new Date().toISOString(),
        initial_state: true,
        state_version: 1
      }
    });

    await this.auditLogger.logStateCreation(playerId, gameState.id);
    return gameState;
  }

  /**
     * Update game state with validation and audit
     * @param {string} playerId - Player ID
     * @param {Object} stateUpdates - State updates to apply
     * @param {string} reason - Reason for state update
     * @returns {Promise<GameState>} Updated game state
     */
  async updateState(playerId, stateUpdates, reason = 'state_update') {
    const startTime = Date.now();

    try {
      // Get current state
      const currentState = await this.getPlayerState(playerId);
      if (!currentState) {
        throw new Error(`No game state found for player: ${playerId}`);
      }

      // Create state snapshot for audit
      const stateSnapshot = {
        before: currentState.toJSON(),
        updates: stateUpdates,
        reason,
        timestamp: new Date().toISOString()
      };

      // Validate state transition
      const transitionValidation = await this.stateValidator.validateStateTransition(
        currentState, stateUpdates, reason
      );

      if (!transitionValidation.valid) {
        await this.auditLogger.logStateValidationFailure(playerId, transitionValidation.errors);
        throw new Error(`State transition validation failed: ${transitionValidation.errors.join(', ')}`);
      }

      // Anti-cheat validation
      const antiCheatResult = await this.antiCheat.validateStateUpdate(
        playerId, currentState, stateUpdates, reason
      );

      if (!antiCheatResult.valid) {
        await this.auditLogger.logAntiCheatViolation(playerId, 'state_update', antiCheatResult.violations);
        throw new Error(`Anti-cheat validation failed: ${antiCheatResult.violations.join(', ')}`);
      }

      // Apply updates
      Object.assign(currentState, stateUpdates);

      // Update state data with metadata
      currentState.state_data = {
        ...currentState.state_data,
        last_updated: new Date().toISOString(),
        update_reason: reason,
        state_version: (currentState.state_data.state_version || 1) + 1
      };

      // Save to database
      await currentState.save();

      // Update caches
      await this.cacheState(currentState);

      // Create audit snapshot
      stateSnapshot.after = currentState.toJSON();

      // Log state update
      await this.auditLogger.logStateUpdate(playerId, stateSnapshot, {
        duration: Date.now() - startTime,
        validation_checks: {
          transition: transitionValidation,
          anti_cheat: antiCheatResult
        }
      });

      // Emit state change event
      this.emitEvent('state_updated', {
        playerId,
        gameState: currentState,
        updates: stateUpdates,
        reason
      });

      return currentState;

    } catch (error) {
      await this.auditLogger.logError(playerId, 'state_update_failed', {
        error: error.message,
        updates: stateUpdates,
        reason,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
     * Process spin result and update state
     * @param {string} playerId - Player ID
     * @param {Object} spinResult - Spin result data
     * @returns {Promise<Object>} Updated state and validation results
     */
  async processSpinResult(playerId, spinResult) {
    try {
      const currentState = await this.getPlayerState(playerId);
      if (!currentState) {
        throw new Error(`No game state found for player: ${playerId}`);
      }

      // Determine state updates based on spin result
      const stateUpdates = this.calculateStateUpdates(currentState, spinResult);

      // Update state
      const updatedState = await this.updateState(playerId, stateUpdates, 'spin_result');

      // Log spin processing
      await this.auditLogger.logSpinProcessed(playerId, spinResult, stateUpdates);

      return {
        gameState: updatedState.getSafeData(),
        stateUpdates,
        spinResult
      };

    } catch (error) {
      await this.auditLogger.logError(playerId, 'spin_processing_failed', {
        error: error.message,
        spinResult
      });
      throw error;
    }
  }

  /**
     * Calculate state updates based on spin result
     * @param {GameState} currentState - Current game state
     * @param {Object} spinResult - Spin result data
     * @returns {Object} State updates to apply
     */
  calculateStateUpdates(currentState, spinResult) {
    const updates = {};

    // Handle free spins mode
    if (currentState.isInFreeSpins()) {
      updates.free_spins_remaining = Math.max(0, currentState.free_spins_remaining - 1);

      // Check if free spins are ending
      if (updates.free_spins_remaining === 0) {
        updates.game_mode = 'base';
        updates.accumulated_multiplier = 1.00;
      }
    }

    // Handle free spins trigger
    if (spinResult.features?.free_spins) {
      updates.game_mode = 'free_spins';
      updates.free_spins_remaining = spinResult.features.free_spins.count;
      updates.accumulated_multiplier = spinResult.features.free_spins.multiplier || 1.00;
    }

    // Handle multiplier updates during free spins
    if (currentState.isInFreeSpins() && spinResult.multiplier) {
      updates.accumulated_multiplier = currentState.accumulated_multiplier + spinResult.multiplier;
    }

    const currentStateData = currentState.state_data || {};
    const nextStateData = {
      ...currentStateData,
      last_spin: {
        spin_id: spinResult.id,
        timestamp: new Date().toISOString(),
        win_amount: spinResult.totalWin,
        bet_amount: spinResult.betAmount,
        rng_seed: spinResult.rngSeed || spinResult.seed || null,
        features: spinResult.features || {},
        cascade_count: Array.isArray(spinResult.cascadeSteps) ? spinResult.cascadeSteps.length : 0
      }
    };

    if (Array.isArray(spinResult.finalGrid)) {
      nextStateData.current_grid = JSON.parse(JSON.stringify(spinResult.finalGrid));
    }
    if (spinResult.rngSeed || spinResult.seed) {
      nextStateData.last_rng_seed = spinResult.rngSeed || spinResult.seed;
    }

    updates.state_data = nextStateData;

    return updates;
  }

  /**
     * Cache state in Redis and memory
     * @param {GameState} gameState - Game state to cache
     */
  async cacheState(gameState) {
    if (gameState?.id === undefined && this.demoState && gameState === this.demoState) {
      return;
    }
    try {
      // Memory cache
      this.stateCache.set(gameState.player_id, {
        state: gameState,
        cached_at: Date.now()
      });

      // Redis cache
      if (this.redis) {
        const redisKey = `game_state:${gameState.player_id}`;
        const cacheData = JSON.stringify(gameState.toJSON());
        await this.redis.setex(redisKey, 300, cacheData); // 5 minute expiry
      }

    } catch (error) {
      console.error('StateManager: Error caching state:', error);
      // Don't throw - caching failure shouldn't break the game
    }
  }

  /**
     * Invalidate cached state
     * @param {string} playerId - Player ID
     */
  async invalidateStateCache(playerId) {
    try {
      // Remove from memory cache
      this.stateCache.delete(playerId);

      // Remove from Redis cache
      if (this.redis) {
        await this.redis.del(`game_state:${playerId}`);
      }

    } catch (error) {
      console.error('StateManager: Error invalidating cache:', error);
    }
  }

  /**
     * Handle session disconnection
     * @param {string} sessionId - Session ID
     * @param {string} reason - Disconnection reason
     */
  async handleDisconnection(sessionId, reason = 'client_disconnect') {
    try {
      const sessionInfo = this.activeSessions.get(sessionId);
      if (!sessionInfo) {
        return; // Session not found in active sessions
      }

      const { playerId, gameStateId } = sessionInfo;

      // Update session with disconnection info
      const session = await Session.findByPk(sessionId);
      if (session) {
        session.session_data = {
          ...session.session_data,
          disconnected_at: new Date().toISOString(),
          disconnect_reason: reason
        };
        await session.save();
      }

      // Log disconnection
      await this.auditLogger.logSessionEvent(playerId, sessionId, 'session_disconnected', {
        reason,
        session_duration: Date.now() - sessionInfo.lastActivity
      });

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      // Emit disconnection event
      this.emitEvent('session_disconnected', { playerId, sessionId, reason });

    } catch (error) {
      console.error('StateManager: Error handling disconnection:', error);
    }
  }

  /**
     * Get active session information
     * @param {string} sessionId - Session ID
     * @returns {Object|null} Session information or null
     */
  getActiveSession(sessionId) {
    if (sessionId === 'demo-session' && this.demoSession) {
      return this.demoSession;
    }
    return this.activeSessions.get(sessionId) || null;
  }

  async setDemoState(playerId, stateData, sessionInfo) {
    if (playerId !== 'demo-player') {return;}

    const safeData = {
      balance: stateData.balance ?? 5000,
      free_spins_remaining: stateData.free_spins_remaining ?? 0,
      accumulated_multiplier: stateData.accumulated_multiplier ?? 1,
      game_mode: stateData.game_mode || 'base',
      updated_at: stateData.updated_at || new Date().toISOString()
    };

    this.demoState = {
      player_id: 'demo-player',
      getSafeData: () => safeData,
      game_mode: safeData.game_mode,
      free_spins_remaining: safeData.free_spins_remaining,
      accumulated_multiplier: safeData.accumulated_multiplier,
      updated_at: safeData.updated_at
    };

    this.demoSession = sessionInfo ? {
      ...sessionInfo,
      id: sessionInfo.id || 'demo-session',
      playerId: 'demo-player'
    } : {
      id: 'demo-session',
      playerId: 'demo-player',
      lastActivity: Date.now()
    };
  }

  /**
     * Update session activity
     * @param {string} sessionId - Session ID
     */
  updateSessionActivity(sessionId) {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (sessionInfo) {
      sessionInfo.lastActivity = Date.now();
    }
  }

  /**
     * Clean up expired sessions
     */
  async cleanupExpiredSessions() {
    try {
      const now = Date.now();
      const expiredSessions = [];

      // Check active sessions for expiration
      for (const [sessionId, sessionInfo] of this.activeSessions) {
        const inactiveTime = now - sessionInfo.lastActivity;
        const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

        if (inactiveTime > maxInactiveTime) {
          expiredSessions.push(sessionId);
        }
      }

      // Clean up expired sessions
      for (const sessionId of expiredSessions) {
        await this.handleDisconnection(sessionId, 'session_expired');
      }

      if (expiredSessions.length > 0) {
        console.log(`StateManager: cleaned up ${expiredSessions.length} expired sessions`);
      }

    } catch (error) {
      console.error('StateManager: Error cleaning up sessions:', error);
    }
  }

  /**
     * Clean up state cache
     */
  async cleanupStateCache() {
    const now = Date.now();
    const staleCacheEntries = [];

    for (const [playerId, cacheEntry] of this.stateCache) {
      if (now - cacheEntry.cached_at > 10 * 60 * 1000) { // 10 minutes
        staleCacheEntries.push(playerId);
      }
    }

    for (const playerId of staleCacheEntries) {
      this.stateCache.delete(playerId);
      if (this.redis) {
        await this.redis.del(`game_state:${playerId}`);
      }
    }
    console.log(`StateManager: Cleaned up ${staleCacheEntries.length} stale state cache entries.`);
  }

  /**
     * Register event handler
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler function
     */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  /**
     * Emit event
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
  emitEvent(eventName, data) {
    if (this.eventHandlers.has(eventName)) {
      this.eventHandlers.get(eventName).forEach(handler => handler(data));
    }
  }

  /**
     * Get audit logger
     * @returns {AuditLogger} Audit logger instance
     */
  getAuditLogger() {
    return this.auditLogger;
  }

  /**
     * Get state validator
     * @returns {StateValidator} State validator instance
     */
  getStateValidator() {
    return this.stateValidator;
  }

  /**
     * Get anti-cheat
     * @returns {AntiCheat} Anti-cheat instance
     */
  getAntiCheat() {
    return this.antiCheat;
  }

  /**
     * Get demo state
     * @returns {GameState|null} Demo game state or null
     */
  getDemoState() {
    return this.demoState;
  }

  /**
     * Get demo session
     * @returns {Object|null} Demo session information or null
     */
  getDemoSession() {
    return this.demoSession;
  }

  /**
     * Set demo state
     * @param {string} playerId - Demo player ID
     * @param {Object} stateData - State data for demo
     * @param {Object} sessionInfo - Session info for demo
     */
  setDemoState(playerId, stateData, sessionInfo) {
    if (playerId !== 'demo-player') {return;}

    const safeData = {
      balance: stateData.balance ?? 5000,
      free_spins_remaining: stateData.free_spins_remaining ?? 0,
      accumulated_multiplier: stateData.accumulated_multiplier ?? 1,
      game_mode: stateData.game_mode || 'base',
      updated_at: stateData.updated_at || new Date().toISOString()
    };

    this.demoState = {
      player_id: 'demo-player',
      getSafeData: () => safeData,
      game_mode: safeData.game_mode,
      free_spins_remaining: safeData.free_spins_remaining,
      accumulated_multiplier: safeData.accumulated_multiplier,
      updated_at: safeData.updated_at
    };

    this.demoSession = sessionInfo ? {
      ...sessionInfo,
      id: sessionInfo.id || 'demo-session',
      playerId: 'demo-player'
    } : {
      id: 'demo-session',
      playerId: 'demo-player',
      lastActivity: Date.now()
    };
  }
}

module.exports = StateManager;