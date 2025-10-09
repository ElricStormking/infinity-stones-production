# Base Win Formula Fix

## Issue
Formula plaque sometimes shows **"$0.00 x1 = $4.00"** when it should show the actual base win amount.

## Root Cause
The `baseWinForFormula` variable tracks the win amount **before** random multipliers are applied. It's used to show formulas like "$4.75 x14 = $66.50".

### The Problem Flow (OLD)
```javascript
// startSpin(): Reset to 0
this.baseWinForFormula = 0;

// processServerSpinResult(): Check for multipliers
if (multiplierSummary) {
    // Only set baseWinForFormula if multipliers exist!
    bonusManager.showRandomMultiplierResult(multiplierSummary);
        // Inside showRandomMultiplierResult:
        this.scene.baseWinForFormula = summary.originalWin;
}

// If NO multipliers:
// baseWinForFormula stays at 0! ❌
```

### Why It Shows "$0.00 x1"
1. Spin without multipliers completes
2. `baseWinForFormula` = 0 (never updated)
3. `spinAppliedMultiplier` = 1 (no multipliers)
4. Formula displays: "$0.00 x1 = $4.00" ❌

## Solution
Set `baseWinForFormula` in `processServerSpinResult()` **BEFORE** checking for multipliers, so it's set for ALL spins (with or without multipliers).

### The Fix (src/scenes/GameScene.js lines 2494-2501)
```javascript
// Set baseWinForFormula for all spins (with or without multipliers)
// This is the win BEFORE any random multipliers are applied
if (typeof normalized.baseWin === 'number') {
    this.baseWinForFormula = normalized.baseWin;
} else if (typeof normalized.totalWin === 'number') {
    // Fallback: if no multipliers, baseWin = totalWin
    this.baseWinForFormula = normalized.totalWin;
}

// THEN check for multipliers...
const multiplierSummary = normalized.multiplierAwarded || ...
```

## Server Data Structure
The server sends:
```json
{
  "baseWin": 4.00,        // Win before multipliers
  "totalWin": 56.00,      // Final win after multipliers
  "multiplierAwarded": {
    "originalWin": 4.00,  // Same as baseWin
    "finalWin": 56.00,    // Same as totalWin
    "totalAppliedMultiplier": 14
  }
}
```

If no multipliers:
```json
{
  "baseWin": 4.00,
  "totalWin": 4.00,       // Same as baseWin
  "multiplierAwarded": null
}
```

## Formula Display Logic (UIManager.js lines 1168-1184)
The formula intelligently decides what to show:

1. **With meaningful multiplier** (mult >= 1.01):
   ```
   "$4.75 x14 = $66.50"
   ```

2. **Without multiplier** (mult < 1.01):
   ```
   "$4.00"  (no formula, just amount)
   ```

3. **Never shows**:
   ```
   "$0.00 x1 = $4.00"  ❌ (this bug is now fixed)
   ```

## Files Modified
1. **src/scenes/GameScene.js** (lines 2494-2501)
   - Added: Set `baseWinForFormula` from server data BEFORE multiplier processing
   - Effect: All spins (with or without multipliers) have correct base win

## Testing
1. Reload browser (F5)
2. **Test Case 1**: Spin without multipliers
   - Expected: Formula shows just "$4.00" (no "x1")
   - Or: Formula shows "$4.00 x1 = $4.00" with correct base (not $0.00)

3. **Test Case 2**: Spin with multipliers
   - Expected: Formula shows correct base, e.g. "$4.75 x14 = $66.50"
   - Should NEVER show "$0.00" as base

## Benefits
- ✅ Formula always shows correct base win amount
- ✅ No more "$0.00 x1 = $4.00" confusion
- ✅ Works for spins with or without multipliers
- ✅ Server data is authoritative source

