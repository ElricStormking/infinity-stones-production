# Multiplier Overlay Fix - Stale Client Multipliers

## Issue
User reported: "The client display showed Random Multipliers occurred but server RNG in debug overlay is showing no multipliers triggered."

Screenshot showed x6 and x2 multiplier overlays on the grid, but debug overlay showed "No multipliers triggered".

## Root Cause
The multiplier overlays (x6, x2) were **stale from a previous spin** and were not being cleared. The client was displaying old multiplier overlays that should have been removed when the new spin started.

## Analysis

### Server Behavior: ✅ CORRECT
- Server correctly generates multipliers when triggered
- Server sends `multiplierEvents`, `bonusFeatures.randomMultipliers`, and `multiplierAwarded` in response
- Example from test: Server sent x4 multiplier at position (0,2) with Scarlet Witch character

### Client Behavior: ❌ BUG
1. **Stale Overlays**: Multiplier overlays from previous spins were not being cleared
2. **Display Mismatch**: Old overlays remained visible on grid even though server didn't send new multipliers
3. **Debug Overlay**: Correctly showed "No multipliers triggered" for current spin (which was accurate)

## Fix Applied

### 1. Added `clearAllRandomMultiplierOverlays()` Method
**File**: `src/managers/BonusManager.js`

```javascript
clearAllRandomMultiplierOverlays() {
    // Clear all multiplier overlays (called at start of new spin to prevent stale overlays)
    Object.keys(this.randomMultiplierOverlays).forEach(key => {
        const overlay = this.randomMultiplierOverlays[key];
        if (overlay) {
            if (overlay.container && !overlay.container.destroyed) {
                overlay.container.destroy();
            }
            if (overlay.symbol && overlay.symbol.destroy && !overlay.symbol.destroyed) {
                overlay.symbol.destroy();
            }
        }
    });
    this.randomMultiplierOverlays = {};
}
```

### 2. Clear Overlays at Start of New Spin
**File**: `src/scenes/GameScene.js` - `processServerSpinResult()`

Added call to clear overlays BEFORE rendering new spin result:

```javascript
// Clear any stale multiplier overlays from previous spins
if (this.bonusManager && typeof this.bonusManager.clearAllRandomMultiplierOverlays === 'function') {
    this.bonusManager.clearAllRandomMultiplierOverlays();
}
```

### 3. Clear Overlays Before Showing Server Multipliers
**File**: `src/managers/BonusManager.js` - `showRandomMultiplierResult()`

```javascript
async showRandomMultiplierResult(summary) {
    // Clear any existing multiplier overlays from previous spins
    this.clearAllRandomMultiplierOverlays();
    
    if (!summary) {
        return;
    }
    // ... rest of logic
}
```

### 4. Improved Debug Overlay Timing
**File**: `src/scenes/GameScene.js`

Moved debug overlay call to BEFORE rendering, so it shows server data immediately:

```javascript
// Show server data in debug overlay BEFORE rendering
if (window.serverDebugWindow && typeof window.serverDebugWindow.show === 'function') {
    window.serverDebugWindow.show(normalized);
}
```

### 5. Removed Client-Side Random Multiplier in Demo Mode
**File**: `src/scenes/GameScene.js` - Demo spin flow

Removed calls to `checkRandomMultiplier()` that were generating client-side multipliers in demo mode:

```javascript
// Random Multiplier is now server-authoritative
// Server sends multiplierEvents in the spin response, processed in processServerSpinResult
// No need to call checkRandomMultiplier() - it's handled by server data
```

## Expected Behavior After Fix

### When Multipliers Are Triggered
1. Server generates multiplier(s) in `multiplierEvents`
2. Debug overlay shows multiplier details (character, position, value, RNG metadata)
3. Client displays multiplier overlays at correct positions
4. Character animations play (Thanos/Scarlet Witch)

### When No Multipliers Triggered
1. Server sends empty `multiplierEvents` array
2. Debug overlay shows "No multipliers triggered" for each cascade
3. Client displays NO multiplier overlays (x2, x6, etc.)
4. Grid is clean with no stale overlays

## Testing
1. Start game with `?debug=1`
2. Play multiple spins
3. Verify debug overlay matches what you see on screen:
   - If debug says "No multipliers", grid should show NO x2/x6/etc overlays
   - If debug shows multipliers, grid should show them at correct positions
4. Verify no stale overlays remain between spins

## Files Modified
- `src/managers/BonusManager.js` - Added clearAllRandomMultiplierOverlays(), called at start of showRandomMultiplierResult
- `src/scenes/GameScene.js` - Clear overlays in processServerSpinResult, removed demo mode checkRandomMultiplier calls, improved debug overlay timing
- `src/renderer/GridRenderer.js` - Commented out duplicate debug overlay call (now handled in GameScene)
- `src/debug/ServerDebugWindow.js` - Previously enhanced to show detailed multiplier info per cascade

## Related Issues Fixed
- ✅ Stale multiplier overlays from previous spins
- ✅ Mismatch between debug overlay and visual display
- ✅ Client-side RNG generating multipliers in demo mode (removed)
- ✅ Debug overlay now shows immediately before rendering

## Date
2025-10-08

