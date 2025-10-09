# Shooting Star Formula Race Condition Fix

## Issue
The formula plaque was showing incorrect multiplier totals:
- **Displayed**: $4.75 x6 = $228.00
- **Expected**: $4.75 x14 = $66.50 (if base is correct) or correct server calculation
- **Problem**: Shooting stars increment `spinAccumulatedRM` asynchronously, causing race conditions

## Root Cause
The old flow had a fundamental race condition:

1. `showRandomMultiplierResult()` resets `spinAccumulatedRM = 0` (line 498)
2. Events are processed and shooting stars fired **asynchronously**
3. `updateWinDisplay()` is called immediately (line 542)
4. Formula displays using `spinAccumulatedRM` (which is still 0 or partially incremented)
5. Shooting stars gradually land and increment `spinAccumulatedRM` (line 1177)
6. Final multiplier is incorrect because not all stars have landed

### The Problem Cascade
```javascript
// Old flow (BROKEN):
spinAccumulatedRM = 0;  // Reset to 0
fireShootingStars();    // Fire async animations
updateWinDisplay();     // Shows formula NOW (spinAccumulatedRM is 0!)
// ... later ...
shootingStarLands();    // Increments spinAccumulatedRM
// Result: Formula shown before all multipliers counted!
```

## Solution
Treat the server's `totalAppliedMultiplier` as the **authoritative source** and initialize `spinAccumulatedRM` to it immediately:

1. **BonusManager.js line 500**: Initialize `spinAccumulatedRM` to server's total
   ```javascript
   this.scene.spinAccumulatedRM = appliedRounded || 0;
   ```

2. **GameScene.js line 1175-1180**: Remove incremental logic from shooting stars
   ```javascript
   // OLD (incremental - caused race condition):
   const prevSum = Math.max(0, this.spinAccumulatedRM || 0);
   this.spinAccumulatedRM = prevSum + multiplierValue;
   
   // NEW (just display the already-correct value):
   const mult = Math.max(0, this.spinAccumulatedRM || this.spinAppliedMultiplier || 0);
   this.uiManager.setWinFormula(base, mult, shownFinal);
   ```

## Files Modified
1. **src/managers/BonusManager.js** (line 498-500)
   - Changed: `spinAccumulatedRM = 0` → `spinAccumulatedRM = appliedRounded`
   - Effect: Formula shows correct total immediately

2. **src/scenes/GameScene.js** (line 1174-1180)
   - Removed: Incremental addition `prevSum + multiplierValue`
   - Changed: Shooting stars now just pulse the formula, don't modify the value
   - Effect: Shooting stars are pure visual effects, don't affect calculation

## New Flow (FIXED)
```javascript
// Server sends: totalAppliedMultiplier = 14
spinAccumulatedRM = 14;     // Initialize to server's total
fireShootingStars();         // Fire async animations (visual only)
updateWinDisplay();          // Shows correct x14 immediately ✅
// ... later ...
shootingStarLands();         // Just pulses the formula, value stays 14
// Result: Correct formula shown immediately!
```

## Testing
1. Reload browser (F5)
2. Spin until multiple multipliers appear (x2, x2, x8, x2)
3. Verify formula plaque shows correct total immediately (x14 in this case)
4. Verify final win amount matches: base × totalMultiplier
5. Check console for: `📊 Server multiplier: x14 ...`

## Benefits
- ✅ No race conditions
- ✅ Formula displays correct value immediately
- ✅ Shooting stars are pure visual effects
- ✅ Server remains authoritative source of truth
- ✅ Consistent with server-first architecture

