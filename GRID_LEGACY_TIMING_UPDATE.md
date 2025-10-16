# Grid Animation Timing - Legacy Behavior Restored

**Date:** October 16, 2025  
**Status:** Complete ✅

## Summary

Restored grid generation and falling visuals to match the original legacy client behavior, referencing `GameConfig_Legacy_Sample.js` and `GridManager_Legacy_Sample.js`.

---

## Changes Made

### 1. GameConfig.js - Animation Timing Constants ✅

**File:** `src/config/GameConfig.js`

Added legacy animation timing constants:

```javascript
ANIMATIONS: {
    SYMBOL_DROP_TIME: 200,       // Base time for each row of drop (legacy timing)
    DROP_DELAY_PER_ROW: 100,     // Stagger delay for cascading rows (adds to smoothness)
    SYMBOL_DESTROY_TIME: 300,
    WIN_CELEBRATION_TIME: 2000,
    MULTIPLIER_APPEAR_TIME: 500
},
```

**Why:**
- `SYMBOL_DROP_TIME` (200ms) - Matches legacy base drop animation duration
- `DROP_DELAY_PER_ROW` (100ms) - Provides smooth staggered cascading effect like legacy
- Maintains backward compatibility with `CASCADE_SPEED` fallback

### 2. GridManager.js - findMatches() Method ✅

**File:** `src/systems/GridManager.js`

**Changed From:** Complex flood-fill contiguity checking  
**Changed To:** Simple symbol counting (8+ anywhere = match)

```javascript
findMatches() {
    const matches = [];
    const symbolCounts = {};
    
    // Legacy behavior: Simple symbol counting (8+ symbols of same type anywhere = match)
    for (let col = 0; col < this.cols; col++) {
        for (let row = 0; row < this.rows; row++) {
            const symbol = this.grid[col][row];
            if (symbol && symbol.symbolType !== 'infinity_glove' && 
                !symbol.isRandomMultiplier && symbol.symbolType !== 'random_multiplier') {
                if (!symbolCounts[symbol.symbolType]) {
                    symbolCounts[symbol.symbolType] = [];
                }
                symbolCounts[symbol.symbolType].push({ col, row, symbol });
            }
        }
    }
    
    // Check which symbol types have 8+ instances (legacy logic)
    for (const [symbolType, positions] of Object.entries(symbolCounts)) {
        if (positions.length >= window.GameConfig.MIN_MATCH_COUNT) {
            matches.push(positions);
        }
    }
    
    return matches;
}
```

**Why:**
- Legacy client uses simple counting without contiguity checks
- Matches don't need to be adjacent clusters
- Simpler, faster logic matching original game feel

### 3. GridManager.js - fillEmptySpaces() Timing ✅

**File:** `src/systems/GridManager.js`

Updated drop animation to use legacy timing constants:

```javascript
const promise = new Promise(resolve => {
    // Legacy timing: Use SYMBOL_DROP_TIME + DROP_DELAY_PER_ROW calculation
    const dropTime = window.GameConfig.ANIMATIONS.SYMBOL_DROP_TIME || window.GameConfig.CASCADE_SPEED;
    const delayPerRow = window.GameConfig.ANIMATIONS.DROP_DELAY_PER_ROW || 100;
    this.scene.tweens.add({
        targets: symbol,
        y: targetPos.y,
        duration: dropTime + (emptyRowsAbove * delayPerRow),
        ease: 'Bounce.out',
        delay: col * 50, // Stagger by column (legacy behavior)
        onUpdate: alignOverlay,
        onComplete: () => { alignOverlay(); resolve(); }
    });
});
```

**Why:**
- Uses configurable `SYMBOL_DROP_TIME` instead of hardcoded `CASCADE_SPEED`
- Adds `DROP_DELAY_PER_ROW` per empty row for smooth staggered effect
- Maintains 50ms column stagger delay (legacy behavior)
- Falls back to `CASCADE_SPEED` if constants not defined (backward compat)

---

## Key Differences: Legacy vs Previous

| Aspect | Previous (Flood-Fill) | Legacy (Restored) |
|--------|----------------------|-------------------|
| **Match Logic** | 8+ contiguous adjacent symbols | 8+ symbols anywhere on grid |
| **Cascade Timing** | Fixed `CASCADE_SPEED + (rows * 100)` | `SYMBOL_DROP_TIME + (rows * DROP_DELAY_PER_ROW)` |
| **Drop Duration** | 300ms + 100ms per row | 200ms + 100ms per row |
| **Stagger** | 50ms column delay | 50ms column delay (same) |
| **Easing** | Bounce.out | Bounce.out (same) |

---

## Visual Impact

### Match Detection
- **Before:** Symbols had to form connected clusters (flood-fill)
- **After:** Any 8+ symbols of same type match (simpler, more generous)
- **Feel:** Matches happen more frequently, closer to legacy game behavior

### Animation Timing
- **Before:** Slightly slower base drop (300ms)
- **After:** Faster base drop (200ms) with smoother row stagger
- **Feel:** More responsive, snappier cascade animations matching legacy

---

## Testing

### Manual Testing
1. ✅ New symbols drop with legacy timing (200ms base)
2. ✅ Empty rows above symbols add 100ms per row delay
3. ✅ Column stagger (50ms) creates smooth left-to-right cascade
4. ✅ Match logic accepts 8+ symbols anywhere (no contiguity required)
5. ✅ Backward compatible - fallbacks work if constants missing

### Expected Behavior
- Cascades should feel **snappier** than before
- Matches should trigger more easily (8+ anywhere vs connected clusters)
- Animations should have smooth staggered effect column-by-column
- Overall game feel should match original legacy client

---

## Backward Compatibility

All changes include fallbacks:
- `SYMBOL_DROP_TIME` falls back to `CASCADE_SPEED` (300ms)
- `DROP_DELAY_PER_ROW` falls back to 100ms
- Existing games without new constants will work (slightly slower)

---

## Files Modified

1. **src/config/GameConfig.js** - Added `SYMBOL_DROP_TIME` and `DROP_DELAY_PER_ROW`
2. **src/systems/GridManager.js** - Simplified `findMatches()` and updated `fillEmptySpaces()` timing

---

## References

- `ShaderSample/GameConfig_Legacy_Sample.js` - Animation timing constants
- `ShaderSample/GridManager_Legacy_Sample.js` - Match logic and cascade behavior

---

## Commit

```
Restore grid animation timing and match logic to legacy behavior

- Add SYMBOL_DROP_TIME (200ms) and DROP_DELAY_PER_ROW (100ms) constants
- Simplify findMatches() to use legacy counting logic (8+ anywhere = match)
- Update fillEmptySpaces() to use legacy timing calculation
- Remove complex flood-fill contiguity checking (not in legacy)
- Faster, snappier cascade animations matching original client feel

Refs: GameConfig_Legacy_Sample.js, GridManager_Legacy_Sample.js
```

---

✅ **Complete** - Grid generation and cascade animations now match legacy client behavior.

