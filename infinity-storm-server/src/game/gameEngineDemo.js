/**
 * Demo Game Engine - Boosted 300% RTP for Free Play Mode
 *
 * This engine provides a fun, player-friendly experience with:
 * - 3x higher RTP (300% vs 96.5%)
 * - More frequent random multipliers
 * - Higher scatter symbol rates
 * - Boosted high-paying symbols
 * - Better multiplier values
 *
 * Used exclusively for non-authenticated free play demo mode.
 */

const GameEngine = require('./gameEngine');
const { GAME_CONFIG } = require('./gameEngine');
const GridGenerator = require('./gridGenerator');
const MultiplierEngine = require('./multiplierEngine');
const { getRNG } = require('./rng');

// Boosted configuration for demo mode (300% RTP)
const DEMO_CONFIG = {
  ...GAME_CONFIG,

  // 300% RTP (players win 3x more on average)
  RTP: 3.0,

  // Boost symbol weights to favor high-paying symbols
  SYMBOL_WEIGHTS: {
    time_gem: 18,        // Reduced from 26
    space_gem: 18,       // Reduced from 26
    mind_gem: 16,        // Reduced from 22
    power_gem: 18,       // Reduced from 20
    reality_gem: 20,     // Same as normal
    soul_gem: 20,        // Increased from 19
    thanos_weapon: 22,   // Increased from 17
    scarlet_witch: 25,   // Increased from 12
    thanos: 30           // Increased from 11
  },

  // Much higher scatter chance (0.15 vs 0.07)
  SCATTER_CHANCE: 0.15,

  // Free spins configuration - more spins awarded
  FREE_SPINS: {
    ...GAME_CONFIG.FREE_SPINS,
    SCATTER_4_PLUS: 20,  // Up from 15
    RETRIGGER_SPINS: 8,  // Up from 5
    BUY_FEATURE_SPINS: 20,  // Up from 15
    ACCUM_TRIGGER_CHANCE_PER_CASCADE: 0.50  // Up from 0.35
  },

  // Random multiplier - very high trigger chance
  RANDOM_MULTIPLIER: {
    ...GAME_CONFIG.RANDOM_MULTIPLIER,
    TRIGGER_CHANCE: 0.95,  // Up from 0.8 (95% chance!)

    // Boosted multiplier distribution - higher values more common
    WEIGHTED_TABLE: [
      { multiplier: 2,   weight: 30.0 },   // 30%
      { multiplier: 3,   weight: 20.0 },   // 20%
      { multiplier: 5,   weight: 15.0 },   // 15%
      { multiplier: 10,  weight: 12.0 },   // 12%
      { multiplier: 20,  weight: 10.0 },   // 10%
      { multiplier: 50,  weight: 8.0 },    // 8%
      { multiplier: 100, weight: 4.0 },    // 4% (up from 0.001%)
      { multiplier: 500, weight: 1.0 }     // 1% (up from 0.0001%)
    ]
  },

  // Cascade random multiplier - also boosted
  CASCADE_RANDOM_MULTIPLIER: {
    ...GAME_CONFIG.CASCADE_RANDOM_MULTIPLIER,
    TRIGGER_CHANCE: 0.60,  // Up from 0.40
    MIN_MULTIPLIERS: 1,
    MAX_MULTIPLIERS: 4     // Up from 3
  }
};

/**
 * Demo Game Engine with boosted probabilities for free play
 */
class GameEngineDemo extends GameEngine {
  constructor(options = {}) {
    super(options);

    // Override config with boosted values
    this.gameConfig = DEMO_CONFIG;

    // Re-initialize components with boosted config
    this.rng = getRNG({ auditLogging: false }); // Disable audit for demo
    this.gridGenerator = new GridGenerator({
      auditLogging: false,
      clusterInjection: false,
      minClustersPerGrid: 0
    });

    // Re-initialize engines with boosted config
    this.multiplierEngine = new MultiplierEngine(DEMO_CONFIG, this.rng);

    console.log('🎮 [DEMO ENGINE] Initialized with 300% RTP boost');
    console.log('🎮 [DEMO ENGINE] Random multiplier chance:', DEMO_CONFIG.RANDOM_MULTIPLIER.TRIGGER_CHANCE);
    console.log('🎮 [DEMO ENGINE] Scatter chance:', DEMO_CONFIG.SCATTER_CHANCE);
  }

  /**
   * Override to log demo spin processing
   */
  async processCompleteSpin(spinRequest) {
    if (spinRequest.playerId === 'demo-player' || spinRequest.sessionId === 'demo-session') {
      console.log('🎮 [DEMO ENGINE] Processing FREE PLAY demo spin with 300% RTP boost');
    }

    // Call parent implementation with boosted config
    const spin = await super.processCompleteSpin(spinRequest);

    try {
      // Demo-mode rule: If 4+ scatters triggered Free Spins in BASE game, do not apply random multipliers
      // (Free Spins mode remains unchanged)
      const fsTriggered = !!(spin?.bonusFeatures?.freeSpinsTriggered || spin?.bonusFeatures?.freeSpinsAwarded);
      const freeSpinsActive = !!spin?.freeSpinsActive; // base spins should have false/undefined
      if (fsTriggered && !freeSpinsActive) {
        // Remove random multiplier artifacts from the result
        if (Array.isArray(spin?.bonusFeatures?.randomMultipliers)) {
          spin.bonusFeatures.randomMultipliers = [];
        }
        if (Array.isArray(spin?.multiplierEvents)) {
          spin.multiplierEvents = spin.multiplierEvents.filter(e => e && e.type !== 'random_multiplier' && e.type !== 'cascade_random_multiplier');
        }
        // Reset totalWin back to pre-random-multiplier value if available
        if (typeof spin.baseWin === 'number') {
          spin.totalWin = spin.baseWin;
        } else if (Array.isArray(spin.multiplierEvents) && spin.multiplierEvents.length > 0) {
          // Fallback: try originalWin from the first event if present
          const firstEv = spin.multiplierEvents.find(e => typeof e.originalWin === 'number');
          if (firstEv) spin.totalWin = firstEv.originalWin;
        }
        console.log('🎮 [DEMO ENGINE] Random multipliers suppressed due to 4+ scatters (base game)');
      }
    } catch (_) {
      // Non-fatal; fall through with unmodified spin result
    }

    return spin;
  }
}

module.exports = GameEngineDemo;
module.exports.DEMO_CONFIG = DEMO_CONFIG;

