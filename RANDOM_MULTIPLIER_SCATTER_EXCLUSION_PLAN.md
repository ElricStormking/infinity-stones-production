# Random Multiplier & Scatter Symbol Exclusion Plan

## Problem Statement

Currently, when 4+ scatter symbols appear on the grid in **NORMAL mode**, both Free Spins and Random Multipliers can occur simultaneously, causing:
- Visual conflicts (Free Spins celebration overlapping with multiplier animations)
- Confusion for players (two major events happening at once)
- UI overlapping issues

## Solution

**Remove all chances for Random Multipliers to occur when 4+ scatter symbols are detected in NORMAL game mode.**

This exclusion should apply to:
1. Initial grid scatter detection (before cascades)
2. Post-cascade scatter detection (after cascades complete)
3. Both single random multipliers and cascading random multipliers

**Note**: This exclusion only applies to **NORMAL mode**. During **FREE SPINS mode**, random multipliers should still trigger normally even with scatters present (for retriggers).

---

## Implementation Strategy

### Phase 1: Server-Side Changes (Primary Authority)

**File**: `infinity-storm-server/src/game/gameEngine.js`

The server `processCompleteSpin()` method processes spins in this order:
1. Generate initial grid
2. Process cascades
3. **Check scatter symbols** (initial grid at line ~377, post-cascade at line ~407)
4. **Process random multipliers** (cascading at line ~482, single at line ~506)

**Changes Required**:

#### A. Track Scatter Detection Flags
Add flags to track if 4+ scatters were found (lines ~376-425):
```javascript
let hasScatterTrigger = false; // Track if 4+ scatters detected in NORMAL mode

// After initial scatter check (line ~401)
if (scatterCount >= 4 && !freeSpinsActive) {
    hasScatterTrigger = true;
}

// After post-cascade scatter check (line ~425)
if (postCascadeScatterCount >= 4 && !freeSpinsActive && !pendingFreeSpinsCount) {
    hasScatterTrigger = true;
}
```

#### B. Block Cascading Random Multipliers When Scatters Present
Modify the cascading multiplier check (line ~482-503):
```javascript
// OLD CODE (line ~482):
if (cascadeCount > 0 && totalWin > GAME_CONFIG.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
    const cascadingMultiplierResult = await this.multiplierEngine.processCascadingRandomMultiplier(totalWin, betAmount, cascadeCount, { freeSpinsActive });
    // ...
}

// NEW CODE:
// Skip cascading multipliers if 4+ scatters triggered free spins in NORMAL mode
if (cascadeCount > 0 && totalWin > GAME_CONFIG.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED && !hasScatterTrigger) {
    const cascadingMultiplierResult = await this.multiplierEngine.processCascadingRandomMultiplier(totalWin, betAmount, cascadeCount, { freeSpinsActive });
    // ...
} else if (hasScatterTrigger) {
    console.log('  ❌ Cascade multipliers BLOCKED: 4+ scatters detected in NORMAL mode');
}
```

#### C. Block Single Random Multipliers When Scatters Present
Modify the single multiplier check (line ~505-520):
```javascript
// OLD CODE (line ~505):
if (totalWin > GAME_CONFIG.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
    const randomMultiplierResult = await this.multiplierEngine.processRandomMultiplier(totalWin, betAmount, { freeSpinsActive });
    // ...
}

// NEW CODE:
// Skip random multipliers if 4+ scatters triggered free spins in NORMAL mode
if (totalWin > GAME_CONFIG.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED && !hasScatterTrigger) {
    const randomMultiplierResult = await this.multiplierEngine.processRandomMultiplier(totalWin, betAmount, { freeSpinsActive });
    // ...
} else if (hasScatterTrigger) {
    console.log('  ❌ Random multiplier BLOCKED: 4+ scatters detected in NORMAL mode');
}
```

---

### Phase 2: Client-Side Changes (Demo Mode & Validation)

**File**: `src/managers/BonusManager.js`

The client-side `checkRandomMultiplier()` method is only active in **demo mode** (line 34-36). For server-authoritative mode, multipliers come from the server response.

However, we need to add client-side validation to prevent any legacy client-side multiplier triggers when scatters are present in demo mode.

#### A. Block Client-Side Random Multipliers When Scatters Present
Modify `checkRandomMultiplier()` (line ~27-55):
```javascript
async checkRandomMultiplier() {
    // Don't trigger Random Multiplier in burst mode to avoid slowdown
    if (this.scene.burstModeManager && this.scene.burstModeManager.isActive()) {
        return;
    }
    
    // Server-authoritative mode: do not trigger client RNG events
    if (window.NetworkService && typeof window.NetworkService.isDemoMode === 'function' && !window.NetworkService.isDemoMode()) {
        return;
    }

    // NEW: Check if 4+ scatter symbols are present in NORMAL mode
    const scatterCount = this.scene.gridManager.countScatters();
    const isInFreeSpins = this.scene.stateManager.freeSpinsData.active;
    
    if (scatterCount >= 4 && !isInFreeSpins) {
        console.log('❌ Random Multiplier BLOCKED: 4+ scatters detected in NORMAL mode (client-side check)');
        return;
    }

    // SECURITY: Use controlled RNG for Random Multiplier trigger
    // ... rest of existing code
}
```

#### B. Block Client-Side Cascading Random Multipliers When Scatters Present
Modify `checkCascadingRandomMultipliers()` (line ~355-394):
```javascript
async checkCascadingRandomMultipliers() {
    // Don't trigger Cascading Random Multipliers in burst mode to avoid slowdown
    if (this.scene.burstModeManager && this.scene.burstModeManager.isActive()) {
        return;
    }
    
    // NEW: Check if 4+ scatter symbols are present in NORMAL mode
    const scatterCount = this.scene.gridManager.countScatters();
    const isInFreeSpins = this.scene.stateManager.freeSpinsData.active;
    
    if (scatterCount >= 4 && !isInFreeSpins) {
        console.log('❌ Cascading Random Multipliers BLOCKED: 4+ scatters detected in NORMAL mode (client-side check)');
        return;
    }

    // SECURITY: Use controlled RNG
    // ... rest of existing code
}
```

---

## Files to Modify

### Server-Side (Primary)
1. **`infinity-storm-server/src/game/gameEngine.js`**
   - Add `hasScatterTrigger` flag tracking
   - Modify cascading multiplier check (line ~482)
   - Modify single multiplier check (line ~505)
   - Add logging for blocked multipliers

### Client-Side (Demo Mode & Validation)
2. **`src/managers/BonusManager.js`**
   - Modify `checkRandomMultiplier()` (line ~27)
   - Modify `checkCascadingRandomMultipliers()` (line ~355)
   - Add scatter count checks before triggering

---

## Testing Checklist

### Server-Side Testing
- [ ] **Initial Grid Scatter Trigger**: Spin until 4+ scatters appear on initial grid
  - Verify Free Spins triggered
  - Verify NO random multipliers appear
  - Check server logs for "BLOCKED: 4+ scatters detected"
  
- [ ] **Post-Cascade Scatter Trigger**: Spin until 4+ scatters appear after cascades
  - Verify Free Spins triggered
  - Verify NO random multipliers appear
  - Check server logs for "BLOCKED: 4+ scatters detected"

- [ ] **3 or Fewer Scatters**: Spin with 0-3 scatters
  - Verify random multipliers CAN still trigger normally
  - Verify no blocking occurs

- [ ] **Free Spins Mode with Scatters**: During free spins, get 4+ scatters (retrigger)
  - Verify random multipliers CAN still trigger (not blocked in free spins mode)
  - Verify retrigger works correctly

### Client-Side Testing (Demo Mode)
- [ ] **Demo Mode with 4+ Scatters**: Test in demo mode with scatter triggers
  - Verify NO client-side random multipliers appear
  - Check browser console for "BLOCKED" messages

- [ ] **Demo Mode with <4 Scatters**: Test in demo mode without scatter triggers
  - Verify random multipliers work normally

### Visual Validation
- [ ] **No Overlapping Animations**: When free spins trigger, confirm:
  - Only Free Spins celebration plays
  - No Thanos/Scarlet Witch multiplier animations
  - No multiplier overlay frames on grid
  - Clean visual experience

### Edge Cases
- [ ] **Exactly 4 Scatters**: Test boundary condition
- [ ] **5+ Scatters**: Test with maximum scatters
- [ ] **Burst Mode**: Verify burst mode behavior unchanged
- [ ] **Purchase Free Spins**: Verify purchased free spins work correctly

---

## Implementation Order

1. **Server-side changes first** (gameEngine.js)
   - This is the authoritative source of truth
   - Affects all authenticated game modes
   
2. **Client-side changes second** (BonusManager.js)
   - Only affects demo mode
   - Provides consistency and validation

3. **Testing**
   - Verify server behavior with authenticated account
   - Verify client behavior in demo mode
   - Check for any visual conflicts

---

## Expected Behavior Summary

### NORMAL Mode (Base Game)
- **0-3 Scatters**: Random multipliers can trigger ✅
- **4+ Scatters**: Random multipliers BLOCKED ❌, Free Spins trigger ✅

### FREE SPINS Mode
- **Any number of scatters**: Random multipliers can trigger ✅
- **4+ Scatters**: Random multipliers can trigger ✅, +5 retrigger spins ✅

### BURST Mode
- Random multipliers already disabled (performance)
- Scatter behavior unchanged

---

## Rollback Plan

If issues arise, the changes can be easily reverted by:
1. Removing the `hasScatterTrigger` flag and checks from gameEngine.js
2. Removing the scatter count checks from BonusManager.js
3. System will return to previous behavior (multipliers + scatters simultaneously)

---

## Notes

- This change only affects **NORMAL game mode** when 4+ scatters appear
- **FREE SPINS mode** is unaffected - multipliers still trigger normally
- **Demo mode** client-side checks provide consistency
- Logging added for debugging and verification
- No database migrations required
- No config changes required
- Changes are backward compatible

