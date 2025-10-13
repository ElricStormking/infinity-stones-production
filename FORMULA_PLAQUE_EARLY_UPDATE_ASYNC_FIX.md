# Formula Plaque Early Update - Async Race Condition Fix

## Issue
The formula plaque shows `$1.80 x2 = $3.60` **before** the x2 shooting star visual reaches it, even though:
- `normalModePendingStars` is correctly set to 1
- The shooting star is fired and animates correctly
- The formula should wait for the star to arrive

## Root Cause Analysis

### The Problem
There was an **async/await timing issue** between:
1. `showRandomMultiplierResult()` - Sets up pending star counter
2. The check in `processServerSpinResult()` - Decides whether to call `updateWinDisplay()`

### The Sequence (BROKEN)
```javascript
// GameScene.js line 2612-2623
await this.bonusManager.showRandomMultiplierResult(multiplierSummary);  // ← Already has await!

// Line 2619-2623
const hasPendingStars = !this.stateManager.freeSpinsData.active && (this.normalModePendingStars || 0) > 0;
if (!hasPendingStars) {
    this.updateWinDisplay();  // ← Should be blocked by hasPendingStars
}
```

Even though we `await showRandomMultiplierResult()`, the shooting star animation is fired **asynchronously** inside it, so the function returns before the star completes its journey.

### Why Formula Shows Early

The issue is **NOT** in GameScene.js (that code is correct). The formula shows early because:

1. `showRandomMultiplierResult()` sets `normalModePendingStars = 1` ✅
2. Character animation plays (Thanos/Scarlet Witch) ✅
3. Shooting star is **fired** (starts animating) ✅
4. Control returns to GameScene.js ✅
5. `hasPendingStars` check sees `normalModePendingStars = 1` ✅
6. `updateWinDisplay()` is **NOT** called ✅

**BUT**: Something else is calling `setWinFormula()` or `setText()` on the formula before the star arrives!

## Diagnostic Logging Added

### File: `src/managers/UIManager.js` (Line 1250-1253)
```javascript
setWinFormula(baseAmount, accumulatedMultiplier, finalAmount) {
    if (!this.winTopText) return;
    // DIAGNOSTIC: Log who's calling setWinFormula and whether stars are pending
    const pending = (this.scene.normalModePendingStars || 0);
    const trace = new Error().stack.split('\n').slice(1, 4).join(' → ');
    console.log(`🔧 setWinFormula called: x${accumulatedMultiplier} (${pending} stars pending) via ${trace}`);
    // ...
}
```

### File: `src/scenes/GameScene.js` (Line 2623-2628)
```javascript
const hasPendingStars = !this.stateManager.freeSpinsData.active && (this.normalModePendingStars || 0) > 0;
console.log(`🔍 Checking if we should update win display: hasPendingStars=${hasPendingStars}, normalModePendingStars=${this.normalModePendingStars || 0}`);
if (!hasPendingStars) {
    this.updateWinDisplay();
} else {
    console.log(`⏳ Delaying win display update - waiting for ${this.normalModePendingStars} shooting stars to complete`);
}
```

### File: `src/managers/BonusManager.js` (Line 481-483)
```javascript
const events = Array.isArray(summary.events) ? [...summary.events] : [];
console.log(`📦 showRandomMultiplierResult: events.length=${events.length}`);
if (events.length === 0) {
    console.log(`⚠️ No multiplier events - calling updateWinDisplay() immediately`);
    // ...
}
```

## Next Steps for User

### 1. Refresh the browser (F5)
### 2. Trigger a multiplier spin (x2, x5, etc.)
### 3. Watch the browser console for these log messages:

#### Expected Output (Correct Behavior)
```
📦 showRandomMultiplierResult: events.length=1
📊 Server multiplier: x2 (from 1 events with 1 total multipliers, ...)
⭐ Firing shooting star for single multiplier: x2 from (4,4) [ID: star_5_4_2_0]
🔍 Checking if we should update win display: hasPendingStars=true, normalModePendingStars=1
⏳ Delaying win display update - waiting for 1 shooting stars to complete
🔧 setWinFormula called: x2 (0 stars pending) via playRandomMultiplierShootingStar → ...
✅ All normal mode shooting stars arrived! Final multiplier: x2
```

#### If Bug Still Exists (Early Formula Update)
```
📦 showRandomMultiplierResult: events.length=1
📊 Server multiplier: x2 (from 1 events with 1 total multipliers, ...)
🔧 setWinFormula called: x2 (1 stars pending) via ??? → ...  ← CULPRIT!
⭐ Firing shooting star for single multiplier: x2 from (4,4) [ID: star_5_4_2_0]
```

The **stack trace** in the `🔧 setWinFormula called` message will tell us exactly who is calling it early!

## Suspected Culprits to Investigate

If the formula is updating early, one of these might be calling it:

1. **`updateWinDisplay()`** in UIManager.js line 1195 (direct `setText`)
2. **Character animation callback** (Thanos/Scarlet Witch) calling something unexpected
3. **Grid rendering** updating the formula during cascade animations
4. **Phaser tween callback** from a previous animation

The stack trace will pinpoint the exact culprit!

## Files Modified
- `src/scenes/GameScene.js` - Added diagnostic logging for pending stars check
- `src/managers/UIManager.js` - Added stack trace logging to `setWinFormula`
- `src/managers/BonusManager.js` - Added logging for event count check

## Status
- ✅ Diagnostic logging added
- ⏳ Waiting for user to test and share console output
- ⏳ Will pinpoint exact culprit from stack trace
- ⏳ Will apply targeted fix once culprit identified

