# Accumulated Multiplier Not Updating - Investigation

## Issue

After the last fix, the accumulated multiplier badge stays at **x1** in Free Spins mode, even though the server is correctly calculating new multipliers and applying them to the current spin's win.

## Server Logs Show

### Spin 1 (x8 + x2 = x10 new multipliers)
```
🎰 FREE SPINS MODE: Applying NEW x10 multipliers to current spin
🎰 Calculation: Base $5.75 × (accumulated 1 + new 10) = $5.75 × 11 = $63.25

🎰 GAME ENGINE: New accumulated multiplier for NEXT spin: {
  previousAccumulated: 1,
  newMultipliersFromCurrentSpin: [ 8, 2 ],
  newAccumulated: 11,  ← Server calculated correctly!
  note: 'This total was ALREADY applied to current spin win'
}
```

**Expected**: Badge should show **x11** for next spin
**Actual**: Badge shows **x1**

### Missing Log

The log `🎰 STATE MANAGER: Updating accumulated multiplier` is **NOT appearing** in the server console. This means the `stateManager` is not updating the `accumulated_multiplier` field.

## Root Cause Hypothesis

There are two possible reasons why the stateManager is not updating:

### Option 1: `isInFreeSpins()` returning `false`
The condition `currentState.isInFreeSpins()` might be returning `false`, even though the player is in free spins mode.

### Option 2: `spinResult.newAccumulatedMultiplier` is `undefined`
The `newAccumulatedMultiplier` field might not be set on the `spinResult` object.

Looking at the game engine code at line 595:
```javascript
spinResult.newAccumulatedMultiplier = newAccumulatedMultiplier;
```

This is inside the condition:
```javascript
if (freeSpinsActive && spinResult.bonusFeatures.randomMultipliers.length > 0)
```

**AHA!** If no multipliers are triggered, `newAccumulatedMultiplier` won't be set at all!

But wait - the logs show multipliers ARE being triggered. So the issue must be that the condition is not being met, or the value is not being set correctly.

## Debug Logging Added

Added comprehensive logging to `infinity-storm-server/src/game/stateManager.js` (lines 428-454):

```javascript
console.log(`🎰 STATE MANAGER: Checking accumulated multiplier update:`, {
  isInFreeSpins: currentState.isInFreeSpins(),
  hasNewAccumulatedMultiplier: typeof spinResult.newAccumulatedMultiplier === 'number',
  newAccumulatedMultiplierValue: spinResult.newAccumulatedMultiplier,
  currentAccumulated: currentState.accumulated_multiplier,
  randomMultipliersCount: spinResult.bonusFeatures?.randomMultipliers?.length || 0
});
```

## Testing Steps

1. ✅ **Server restarted** with new debug logging
2. 🔄 **Reload browser** (F5)
3. 🔄 **Enter Free Spins mode**
4. 🔄 **Trigger a multiplier** (x2, x3, etc.)
5. 🔄 **Check server console** for new debug logs

### Expected Console Output

**If working correctly:**
```
🎰 STATE MANAGER: Checking accumulated multiplier update: {
  isInFreeSpins: true,
  hasNewAccumulatedMultiplier: true,
  newAccumulatedMultiplierValue: 11,
  currentAccumulated: 1,
  randomMultipliersCount: 2
}

🎰 STATE MANAGER: ✅ Updating accumulated multiplier: {
  before: 1,
  after: 11,
  randomMultipliers: 2
}
```

**If broken:**
```
🎰 STATE MANAGER: Checking accumulated multiplier update: {
  isInFreeSpins: false,  ← OR
  hasNewAccumulatedMultiplier: false,  ← OR
  newAccumulatedMultiplierValue: undefined,
  currentAccumulated: 1,
  randomMultipliersCount: 2
}

🎰 STATE MANAGER: ❌ NOT updating accumulated multiplier (conditions not met)
```

## Next Steps Based on Findings

### If `isInFreeSpins` is `false`
- Check `currentState.game_mode` - should be `'free_spins'`
- Check if `isInFreeSpins()` method is correct

### If `newAccumulatedMultiplier` is `undefined`
- Check if game engine is setting it correctly
- Check if the value is being lost between gameEngine and stateManager
- Verify the condition at gameEngine line 577 is being met

### If both are correct but still not updating
- Check if `updates` object is being applied to the database
- Check if there's an error in the state update transaction

## Likely Fix

Based on the logs, the most likely issue is that `spinResult.newAccumulatedMultiplier` is `undefined` for spins that **don't have random multipliers**.

**Current code** (gameEngine.js lines 575-602):
```javascript
// ONLY sets newAccumulatedMultiplier if randomMultipliers.length > 0
if (freeSpinsActive && spinResult.bonusFeatures.randomMultipliers.length > 0) {
  const newMultipliersSum = ...;
  const newAccumulatedMultiplier = accumulatedMultiplier + newMultipliersSum;
  spinResult.newAccumulatedMultiplier = newAccumulatedMultiplier;
}
```

**Problem**: If a spin has NO new multipliers, `newAccumulatedMultiplier` won't be set, so the stateManager won't know the current accumulated value.

**Fix**: Always set `newAccumulatedMultiplier` during free spins, even if no new multipliers are triggered:

```javascript
if (freeSpinsActive) {
  if (spinResult.bonusFeatures.randomMultipliers.length > 0) {
    const newMultipliersSum = ...;
    const newAccumulatedMultiplier = accumulatedMultiplier + newMultipliersSum;
    spinResult.newAccumulatedMultiplier = newAccumulatedMultiplier;
  } else {
    // No new multipliers, but still set the field to maintain current accumulated
    spinResult.newAccumulatedMultiplier = accumulatedMultiplier;
  }
}
```

---

**Date**: 2025-10-11
**Status**: 🔍 INVESTIGATING
**Next**: Test with new debug logging to confirm hypothesis

