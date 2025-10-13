# Free Spins Deterministic RNG Fix - Multiplier Race Condition

## Problem
Random multipliers during Free Spins mode were sometimes not being added to the accumulated multiplier UI display (x1 showing when x3 expected). The root cause was **non-deterministic RNG** causing race conditions and inconsistent multiplier generation between server instances.

## Root Cause
The `freeSpinsEngine.processCascadeMultiplier()` function was using `this.rng` (the freeSpinsEngine's instance RNG) instead of a **deterministic RNG seeded from the cascade seed**.

### Why This Caused Issues
1. **Non-Reproducible**: Same spin with same seed could generate different multipliers on replay
2. **Race Conditions**: RNG state could change between different code paths
3. **State Pollution**: The instance RNG could be affected by other spins or sessions
4. **No Audit Trail**: Impossible to reproduce exact multiplier generation for debugging

### Code Location
**File**: `infinity-storm-server/src/game/freeSpinsEngine.js`
**Function**: `processCascadeMultiplier()`
**Line**: 357-381 (original)

```javascript
// WRONG: Using instance RNG (non-deterministic)
const triggerRoll = this.rng.random();  // ❌ Can change between calls!
const randomMultiplier = multiplierTable[
  this.rng.randomInt(0, multiplierTable.length - 1)  // ❌ Not reproducible!
];
const position = {
  col: this.rng.randomInt(0, this.gameConfig.GRID_COLS - 1),  // ❌ Race condition!
  row: this.rng.randomInt(0, this.gameConfig.GRID_ROWS - 1)
};
```

## Fix Applied

### 1. GameEngine - Pass Cascade Seed
**File**: `infinity-storm-server/src/game/gameEngine.js`
**Lines**: 317-341

```javascript
// FIXED: Pass cascadeSeed for deterministic RNG
if (freeSpinsActive && cascadeCount > 1) {
  const cascadeMultiplierResult = await this.freeSpinsEngine.processCascadeMultiplier(
    cascadeCount,
    cascadeWinTotal,
    betAmount,
    cascadeSeed  // NEW: Pass deterministic seed for this cascade
  );

  if (cascadeMultiplierResult.triggered) {
    // ...
    cascadeStep.randomMultiplier = {
      multiplier: cascadeMultiplierResult.multiplier,
      position: cascadeMultiplierResult.position,
      character: cascadeMultiplierResult.character,
      rngSeed: cascadeSeed  // Store seed for audit trail
    };
    // ...
  }
}
```

### 2. FreeSpinsEngine - Use Deterministic RNG
**File**: `infinity-storm-server/src/game/freeSpinsEngine.js`
**Lines**: 348-388

```javascript
async processCascadeMultiplier(cascadeCount, cascadeWin, betAmount, cascadeSeed) {
  // ...

  // CRITICAL FIX: Use deterministic RNG seeded from cascade seed
  // This ensures multipliers are consistent across server restarts and client replays
  const { getRNG } = require('./rng');
  const cascadeRng = getRNG(cascadeSeed + '_multiplier');  // Seed specific to multiplier generation

  // Check trigger probability
  const triggerRoll = cascadeRng.random();  // ✅ Deterministic!
  
  // Use the same multiplier table as regular random multipliers
  const multiplierTable = this.gameConfig.RANDOM_MULTIPLIER.TABLE;
  const randomMultiplier = multiplierTable[
    cascadeRng.randomInt(0, multiplierTable.length - 1)  // ✅ Reproducible!
  ];

  // Select random position for effect
  const position = {
    col: cascadeRng.randomInt(0, this.gameConfig.GRID_COLS - 1),  // ✅ No race!
    row: cascadeRng.randomInt(0, this.gameConfig.GRID_ROWS - 1)
  };

  // Select character for animation (80% Thanos, 20% Scarlet Witch)
  const character = cascadeRng.random() < 0.8 ? 'thanos' : 'scarlet_witch';  // ✅ Consistent!

  const result = {
    triggered: true,
    multiplier: randomMultiplier,
    position,
    character,
    cascadeCount,
    cascadeWin,
    type: 'free_spins_cascade_multiplier',
    animationDuration: this.gameConfig.RANDOM_MULTIPLIER.ANIMATION_DURATION,
    rngSeed: cascadeSeed,  // Store seed for audit trail
    metadata: {
      triggerRoll,
      triggerChance: this.config.accumTriggerChance,
      cascadeSeed  // Include seed in metadata
    }
  };
  // ...
}
```

## How It Works Now

### Seed Derivation
```
Spin RNG Seed: "5e2c374303286be25468207e77d5798a7cb67df345eb4e7a3a017ef27645623802"
    ↓
Cascade 1 Seed: "5e2c374303286be25468207e77d5798a7cb67df345eb4e7a3a017ef2764562380201"
Cascade 2 Seed: "5e2c374303286be25468207e77d5798a7cb67df345eb4e7a3a017ef2764562380202"
    ↓
Multiplier Seed: "5e2c374303286be25468207e77d5798a7cb67df345eb4e7a3a017ef2764562380202_multiplier"
    ↓
Deterministic RNG: getRNG(multiplierSeed)
```

### Benefits
1. **✅ Reproducible**: Same spin seed → Same multipliers every time
2. **✅ No Race Conditions**: Each cascade has isolated RNG
3. **✅ Audit Trail**: Full seed chain logged for debugging
4. **✅ Client Replay**: Client can verify server's RNG with seed
5. **✅ Testable**: Unit tests can use specific seeds
6. **✅ Server-Authoritative**: Client only displays, server controls all RNG

## Data Flow

### Before Fix (Broken)
```
GameEngine → FreeSpinsEngine.processCascadeMultiplier()
    ↓
Uses: this.rng (instance RNG, non-deterministic)
    ↓
Result: Different multipliers on each call with same cascade!
    ↓
Client: Receives inconsistent data, accumulated multiplier wrong
```

### After Fix (Correct)
```
GameEngine → Derives cascadeSeed = spinSeed + cascadeNumber
    ↓
FreeSpinsEngine.processCascadeMultiplier(cascadeCount, win, bet, cascadeSeed)
    ↓
Creates: cascadeRng = getRNG(cascadeSeed + '_multiplier')
    ↓
Uses: cascadeRng.random(), cascadeRng.randomInt() (deterministic)
    ↓
Result: Same multipliers every time for same cascadeSeed
    ↓
Client: Receives consistent data, accumulated multiplier correct
```

## Server-Authoritative Design

The fix enforces the principle: **"Server generates all RNG in advance, client only displays"**

### Server Responsibilities
- ✅ Generate all random multipliers using deterministic seeds
- ✅ Calculate accumulated multiplier total
- ✅ Store RNG seeds in response for audit
- ✅ Ensure reproducibility for testing and debugging

### Client Responsibilities
- ✅ Display server's generated multipliers
- ✅ Sync accumulated multiplier from server
- ✅ Animate visual effects based on server data
- ❌ Never generate random multipliers locally
- ❌ Never calculate accumulated total locally

## Logging Output

### Server Console
```
🎰 GAME ENGINE: Calculated new accumulated multiplier for free spins: {
  previousAccumulated: 1,
  newMultipliers: [2],
  newAccumulated: 3
}

🎰 STATE MANAGER: Updating accumulated multiplier: {
  before: 1,
  after: 3,
  randomMultipliers: 1
}

[AUDIT] FREE_SPINS_CASCADE_MULTIPLIER: {
  cascade_count: 2,
  multiplier: 2,
  position: '3,4',
  character: 'thanos',
  cascade_win: 2.60,
  trigger_roll: 0.15,
  rng_seed: '5e2c374303286be25468207e77d5798a7cb67df345eb4e7a3a017ef2764562380202'
}
```

### Browser Console
```
🎰 FREE SPINS ACCUMULATED MULTIPLIER UPDATE: {
  clientBefore: 1,
  serverValue: 3,
  updating: true
}
```

## Testing

### Deterministic Test
```javascript
// Run same spin twice with same seed
const seed = "test_seed_123";
const result1 = await gameEngine.processCompleteSpin({ rngSeed: seed, ... });
const result2 = await gameEngine.processCompleteSpin({ rngSeed: seed, ... });

// Should be identical
assert.deepEqual(result1.bonusFeatures.randomMultipliers, result2.bonusFeatures.randomMultipliers);
assert.equal(result1.newAccumulatedMultiplier, result2.newAccumulatedMultiplier);
```

### Steps to Verify
1. ✅ **Restart server** to apply fixes
2. 🔄 **Reload browser** (F5 or Ctrl+R)
3. 🎰 **Enter Free Spins mode**
4. 🎲 **Trigger random multipliers** in cascades
5. 📋 **Check server console** for deterministic seed logs
6. 👀 **Verify x64 badge** increments correctly every time
7. 🔁 **Click "Replay Last Spin"** - should get identical multipliers

## Related Fixes
1. **FREE_SPINS_ACCUMULATOR_SYNC_FIX.md** - Client syncing (2025-10-11)
2. **FREE_SPINS_ACCUMULATOR_SERVER_SYNC_FIX.md** - Server calculation (2025-10-11)
3. **This fix** - Deterministic RNG (2025-10-11)

Together, these three fixes ensure:
- ✅ Server generates multipliers deterministically
- ✅ Server calculates accumulated total correctly
- ✅ Client syncs and displays server's values faithfully

---

**Date**: 2025-10-11
**Status**: ✅ FIXED
**Version**: Post-multiplier-fix-v4-deterministic

