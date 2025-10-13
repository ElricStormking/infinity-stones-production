# Normal Mode Progressive Multiplier Update Fix

## Issue
In normal (base) mode, when random multipliers occurred, the formula plaque displayed the total multiplier immediately, before any shooting star visuals finished. This was inconsistent with Free Spins mode, where the accumulated multiplier updated progressively as each shooting star reached the badge.

## Root Cause
In `BonusManager.showRandomMultiplierResult()` (line 513), the client was setting `this.scene.spinAccumulatedRM` to the full server total immediately:
```javascript
// OLD (BROKEN):
this.scene.spinAccumulatedRM = appliedRounded || 0; // Full total set immediately
```

The shooting star animations were purely visual and didn't update the formula plaque progressively.

## Solution

### 1. Progressive Initialization in BonusManager
**File**: `src/managers/BonusManager.js` (lines 512-516)

Changed from setting the full total immediately to starting at 0 and storing the target:
```javascript
// PROGRESSIVE UPDATE: Start at 0, let shooting stars increment to server's total
// Store server's target value for verification after all stars arrive
this.scene.normalModeTargetMultiplier = appliedRounded || 0;
this.scene.spinAccumulatedRM = 0; // Will increment as each star arrives
this.scene.normalModePendingStars = 0; // Will count how many stars are pending
```

### 2. Count Pending Stars When Fired
**File**: `src/managers/BonusManager.js`

Added counter increment when firing shooting stars:
- Line 649: Single multiplier entry
- Line 697: Cascading multipliers

```javascript
this.scene.normalModePendingStars = (this.scene.normalModePendingStars || 0) + 1;
this.scene.playRandomMultiplierShootingStar(col, row, multiplier);
```

### 3. Progressive Update on Star Arrival
**File**: `src/scenes/GameScene.js` (lines 1174-1213)

Changed the plaque target shooting star arrival logic from just pulsing to incrementing:

**Before**:
```javascript
if (target.type === 'plaque') {
    // Just pulse the formula, don't increment
    // spinAccumulatedRM is already set to the correct server total
    const mult = Math.max(0, this.spinAccumulatedRM || this.spinAppliedMultiplier || 0);
    this.uiManager.setWinFormula(base, mult, shownFinal);
    // ... pulse animation ...
}
```

**After**:
```javascript
if (target.type === 'plaque') {
    // INCREMENT progressively as each star arrives!
    const currentMult = this.spinAccumulatedRM || 0;
    const newMult = currentMult + multiplierValue;
    
    console.log(`⭐ Normal mode shooting star arrived! Incrementing multiplier: x${currentMult} + x${multiplierValue} = x${newMult}`);
    
    this.spinAccumulatedRM = newMult;
    
    // Update formula display progressively
    const base = Math.max(0, this.baseWinForFormula || 0);
    const shownFinal = this.totalWin;
    this.uiManager.setWinFormula(base, newMult, shownFinal);
    
    // ... pulse animation ...
    
    // Decrement pending star counter
    this.normalModePendingStars = Math.max(0, (this.normalModePendingStars || 0) - 1);
    
    // When all stars have arrived, verify we reached the server's target value
    if ((this.normalModePendingStars || 0) === 0) {
        const finalMult = this.spinAccumulatedRM;
        const targetMult = this.normalModeTargetMultiplier;
        
        // Safety check: ensure we match the server's target value
        if (typeof targetMult === 'number' && Math.abs(finalMult - targetMult) > 0.01) {
            console.warn(`⚠️ Normal mode multiplier mismatch! Client: x${finalMult}, Server target: x${targetMult}. Correcting...`);
            this.spinAccumulatedRM = targetMult;
            this.uiManager.setWinFormula(base, targetMult, shownFinal);
        }
        
        console.log(`✅ All normal mode shooting stars arrived! Final multiplier: x${this.spinAccumulatedRM}`);
    }
}
```

## Result
✅ **Normal mode random multipliers now update progressively**, matching the Free Spins mode behavior:
- Formula plaque starts with the base multiplier (0 or 1)
- As each shooting star reaches the plaque, the multiplier increments by that star's value
- Formula is updated after each star arrival with a pulse animation
- When all stars have arrived, a safety check ensures the client value matches the server's authoritative total
- Visual synchronization creates a satisfying gameplay experience

## Files Modified
1. `src/managers/BonusManager.js` - Initialize progressive counters, count stars
2. `src/scenes/GameScene.js` - Progressive increment on star arrival
3. `src/managers/UIManager.js` - Use `spinAccumulatedRM` for formula display, hide formula until stars start arriving

### 4. UIManager Formula Display Update
**File**: `src/managers/UIManager.js` (lines 1175-1185)

Changed formula display to use progressive multiplier value and hide formula when stars are pending:

```javascript
} else {
    // Normal mode: Use progressively updated spinAccumulatedRM instead of spinAppliedMultiplier
    // spinAccumulatedRM starts at 0 and increments as each shooting star arrives
    base = Math.max(0, this.scene.baseWinForFormula || 0);
    mult = Math.max(0, this.scene.spinAccumulatedRM !== undefined ? this.scene.spinAccumulatedRM : (this.scene.spinAppliedMultiplier || 1));
}
// Avoid showing misleading formula when values are effectively 0/1 due to rounding noise
const baseRounded = Math.round(base * 100) / 100;
const multRounded = Math.round(mult * 100) / 100;
// CRITICAL: In normal mode, if we have pending stars, don't show formula yet (wait for stars to complete)
const hasPendingStars = !inFreeSpins && (this.scene.normalModePendingStars || 0) > 0;
const meaningfulFormula = (baseRounded >= 0.01) && (multRounded >= 1.01) && !hasPendingStars;
```

This ensures:
- Formula uses `spinAccumulatedRM` (progressive value) not `spinAppliedMultiplier` (full total)
- Formula is hidden when stars haven't started yet (`normalModePendingStars > 0`)
- Formula appears and updates as each star arrives
- No misleading `$5.90 x0 = $35.40` display

## Testing
Test with normal mode spins that trigger random multipliers:
1. Observe that the formula plaque shows just `$35.40` initially (no formula yet, stars pending)
2. As first shooting star arrives, formula appears: `$5.90 x2 = $11.80`
3. As second star arrives, formula updates: `$5.90 x6 = $35.40`
4. Each increment triggers a pulse animation on the formula plaque
5. Final multiplier matches the server's calculated total
6. Behavior is now consistent with Free Spins mode accumulated multiplier updates

