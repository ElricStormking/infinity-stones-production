/**
 * Demo Mode Math Profile
 * Boosted RTP (~300%), higher bonus triggers, more frequent big wins
 * NEVER use this for real money play
 */

const DEMO_RTP_TARGET = parseFloat(process.env.DEMO_RTP_TARGET) || 3.0;
const DEMO_RM_TRIGGER_MULTIPLIER = parseFloat(process.env.DEMO_RM_TRIGGER_MULTIPLIER) || 3.0;
const DEMO_SCATTER_TRIGGER_MULTIPLIER = parseFloat(process.env.DEMO_SCATTER_TRIGGER_MULTIPLIER) || 3.0;

/**
 * Demo game configuration
 * Higher symbol weights for better hits, boosted scatter and multiplier chances
 */
const DEMO_CONFIG = {
  GRID_COLS: 6,
  GRID_ROWS: 5,
  MIN_MATCH_COUNT: 8,
  CASCADE_SPEED: 300,
  RTP: DEMO_RTP_TARGET,
  MAX_WIN_MULTIPLIER: 5000,

  // Symbol payouts (same as real)
  SYMBOLS: {
    time_gem: { payouts: { 8: 8, 10: 15, 12: 40 }, type: 'low' },
    space_gem: { payouts: { 8: 9, 10: 18, 12: 80 }, type: 'low' },
    mind_gem: { payouts: { 8: 10, 10: 20, 12: 100 }, type: 'low' },
    power_gem: { payouts: { 8: 16, 10: 24, 12: 160 }, type: 'low' },
    reality_gem: { payouts: { 8: 20, 10: 30, 12: 200 }, type: 'low' },
    soul_gem: { payouts: { 8: 30, 10: 40, 12: 240 }, type: 'low' },
    thanos_weapon: { payouts: { 8: 40, 10: 100, 12: 300 }, type: 'high' },
    scarlet_witch: { payouts: { 8: 50, 10: 200, 12: 500 }, type: 'high' },
    thanos: { payouts: { 8: 200, 10: 500, 12: 1000 }, type: 'high' },
    infinity_glove: { payouts: { 4: 60, 5: 100, 6: 2000 }, type: 'scatter' }
  },

  // BOOSTED symbol weights for higher hit frequency
  // Shift weight towards higher-value symbols
  SYMBOL_WEIGHTS: {
    time_gem: 24,       // slightly reduced (was 26)
    space_gem: 24,      // slightly reduced (was 26)
    mind_gem: 22,       // same
    power_gem: 22,      // increased (was 20)
    reality_gem: 22,    // increased (was 20)
    soul_gem: 21,       // increased (was 19)
    thanos_weapon: 20,  // increased (was 17)
    scarlet_witch: 16,  // increased (was 12)
    thanos: 15          // increased (was 11)
  },

  // BOOSTED scatter chance (3x base)
  SCATTER_CHANCE: 0.035 * DEMO_SCATTER_TRIGGER_MULTIPLIER,

  // Free spins configuration (same spins, higher trigger rate via scatter)
  FREE_SPINS: {
    SCATTER_4_PLUS: 15,
    RETRIGGER_SPINS: 5,
    BUY_FEATURE_COST: 100,
    BUY_FEATURE_SPINS: 15,
    BASE_MULTIPLIER: 1,
    ACCUM_TRIGGER_CHANCE_PER_CASCADE: 0.45 // increased from 0.35
  },

  // BOOSTED random multiplier (3x trigger chance)
  RANDOM_MULTIPLIER: {
    TRIGGER_CHANCE: 0.4 * DEMO_RM_TRIGGER_MULTIPLIER,
    MIN_WIN_REQUIRED: 0.01,
    ANIMATION_DURATION: 2000,
    // Favor higher multipliers
    TABLE: [].concat(
      Array(25).fill(2),   // reduced from 30
      Array(20).fill(3),   // increased from 15
      Array(15).fill(4),   // increased from 12
      Array(12).fill(5),   // increased from 10
      Array(8).fill(10),   // same
      Array(5).fill(15),   // increased from 3
      Array(3).fill(20),   // increased from 2
      Array(2).fill(25)    // increased from 1
    )
  },

  // Shooting star (additive multipliers) - boosted
  SHOOTING_STAR: {
    MIN_CASCADES_FOR_TRIGGER: 2,
    TRIGGER_CHANCE_PER_CASCADE: 0.30,  // increased from 0.25
    BASE_BOOST: 0.5,                    // increased from 0.3
    PER_CASCADE_BOOST: 0.15,            // increased from 0.1
    MIN_MULTIPLIER: 2,
    MAX_MULTIPLIER: 100,
    ANIMATION_DURATION: 3000
  }
};

/**
 * Apply demo bias to RNG results (optional secondary boost)
 * Can be used to further tilt outcomes without changing symbol weights
 */
function applyDemoBias(rng, context = {}) {
  // For now, just return the RNG unchanged
  // Could add logic to reroll unfavorable outcomes
  return rng;
}

/**
 * Get demo configuration
 */
function getDemoConfig() {
  return { ...DEMO_CONFIG };
}

module.exports = {
  DEMO_CONFIG,
  getDemoConfig,
  applyDemoBias,
  DEMO_RTP_TARGET,
  DEMO_RM_TRIGGER_MULTIPLIER,
  DEMO_SCATTER_TRIGGER_MULTIPLIER
};

