# Grid Display - Enhanced Debug Logging

## Issue

User reported that sometimes grids are displayed in the debug overlay but not rendering on the client game grid.

## Root Cause Investigation

The GridRenderer normalizes cascade steps and accepts multiple field name aliases from the server:
- `gridStateBefore` ← `gridBefore` ← `grid`
- `gridStateAfter` ← `gridAfter` ← `newGrid`
- `gridAfterRemoval` ← `gridMid` ← `gridStateMid`

If **all** aliases for a required grid are `null` or `undefined`, the grid won't render but the debug overlay might show data from other fields.

## The Fix

### File: `src/renderer/GridRenderer.js` (Lines 323-347)

Added comprehensive logging to track which grid fields are present:

```javascript
normalizeCascadeStep(step) {
    const normalized = Object.assign({}, step);
    normalized.stepIndex = normalized.stepIndex ?? normalized.stepNumber ?? 0;
    // ... cluster normalization ...
    
    // DEBUG: Log which grid fields are present in server response
    console.log(`🔍 GridRenderer Step ${normalized.stepIndex} - Grid fields received:`, {
        hasGridStateBefore: !!normalized.gridStateBefore,
        hasGridBefore: !!normalized.gridBefore,
        hasGrid: !!normalized.grid,
        hasGridStateAfter: !!normalized.gridStateAfter,
        hasGridAfter: !!normalized.gridAfter,
        hasNewGrid: !!normalized.newGrid,
        hasGridAfterRemoval: !!normalized.gridAfterRemoval,
        hasGridMid: !!normalized.gridMid,
        hasGridStateMid: !!normalized.gridStateMid
    });
    
    // Accept multiple aliases from server; prefer canonical gridState* fields.
    normalized.gridStateBefore = normalized.gridStateBefore || normalized.gridBefore || normalized.grid;
    normalized.gridStateAfter = normalized.gridStateAfter || normalized.gridAfter || normalized.newGrid;
    normalized.gridAfterRemoval = normalized.gridAfterRemoval || normalized.gridMid || normalized.gridStateMid || null;
    
    // ERROR: Log if critical grids are missing after normalization
    if (!normalized.gridStateBefore) {
        console.error(`❌ GridRenderer Step ${normalized.stepIndex} - MISSING gridStateBefore (tried: gridStateBefore, gridBefore, grid)`);
    }
    if (!normalized.gridStateAfter) {
        console.error(`❌ GridRenderer Step ${normalized.stepIndex} - MISSING gridStateAfter (tried: gridStateAfter, gridAfter, newGrid)`);
    }
    
    // ... rest of normalization ...
}
```

## Console Output

### When Grids Are Present ✅
```
🔍 GridRenderer Step 1 - Grid fields received: {
  hasGridStateBefore: true,
  hasGridBefore: true,
  hasGrid: false,
  hasGridStateAfter: true,
  hasGridAfter: true,
  hasNewGrid: true,
  hasGridAfterRemoval: true,
  hasGridMid: true,
  hasGridStateMid: false
}
```

### When Grids Are Missing ❌
```
🔍 GridRenderer Step 1 - Grid fields received: {
  hasGridStateBefore: false,
  hasGridBefore: false,
  hasGrid: false,
  hasGridStateAfter: false,
  hasGridAfter: false,
  hasNewGrid: false,
  hasGridAfterRemoval: true,
  hasGridMid: true,
  hasGridStateMid: false
}

❌ GridRenderer Step 1 - MISSING gridStateBefore (tried: gridStateBefore, gridBefore, grid)
❌ GridRenderer Step 1 - MISSING gridStateAfter (tried: gridStateAfter, gridAfter, newGrid)
```

## How to Use

### When Testing
1. Open browser console (F12)
2. Spin the game
3. Look for `🔍 GridRenderer Step N - Grid fields received:` messages
4. Check if any `❌ MISSING` errors appear

### Identifying Issues

**If debug overlay shows grids but game doesn't render:**
1. Check console for `❌ MISSING gridStateBefore` or `❌ MISSING gridStateAfter`
2. This means the server sent grid data in a field that's NOT in the alias list
3. Check what fields the debug overlay is reading from
4. Add those fields as new aliases in `GridRenderer.js`

**If both debug overlay AND game don't show grids:**
1. This is a server-side issue - grids not being generated
2. Check server console for game engine logs
3. Verify the RNG seed is working correctly

## Server Side Check

The server should be returning grid data with these fields:

```javascript
cascadeStep.gridStateBefore = ...;  // Required
cascadeStep.gridStateAfter = ...;   // Required
cascadeStep.gridAfterRemoval = ...; // Optional

// Aliases (for backwards compatibility)
cascadeStep.gridBefore = cascadeStep.gridStateBefore;
cascadeStep.gridAfter = cascadeStep.gridStateAfter;
cascadeStep.gridMid = cascadeStep.gridAfterRemoval;
```

### Server Code Location
**File**: `infinity-storm-server/src/game/gameEngine.js` (Lines 311-313)

```javascript
cascadeStep.gridBefore = cascadeStep.gridStateBefore;
cascadeStep.gridAfter = cascadeStep.gridStateAfter;
cascadeStep.gridMid = cascadeStep.gridAfterRemoval;
```

## Expected Behavior

### Normal Operation ✅
```
Server generates:
  gridStateBefore: [...grid data...]
  gridStateAfter: [...grid data...]
  gridAfterRemoval: [...grid data...]
  
  gridBefore (alias): [...same as gridStateBefore...]
  gridAfter (alias): [...same as gridStateAfter...]
  gridMid (alias): [...same as gridAfterRemoval...]

Client receives:
  🔍 GridRenderer Step 1 - Grid fields received: {
    hasGridStateBefore: true,
    hasGridBefore: true,
    hasGridStateAfter: true,
    hasGridAfter: true,
    hasGridAfterRemoval: true,
    hasGridMid: true
  }

Client renders: ✅ Grid displays correctly
```

### Missing Aliases ❌
```
Server generates:
  gridStateBefore: [...grid data...]
  gridStateAfter: [...grid data...]
  (But forgot to set aliases!)

Client receives:
  🔍 GridRenderer Step 1 - Grid fields received: {
    hasGridStateBefore: true,
    hasGridBefore: false,  ← Missing alias
    hasGridStateAfter: true,
    hasGridAfter: false,   ← Missing alias
  }

Client still renders: ✅ Because gridStateBefore and gridStateAfter exist
```

### Server Not Generating Grids ❌
```
Server error or bug:
  (No grid data generated)

Client receives:
  🔍 GridRenderer Step 1 - Grid fields received: {
    hasGridStateBefore: false,
    hasGridBefore: false,
    hasGrid: false,
    hasGridStateAfter: false,
    hasGridAfter: false,
    hasNewGrid: false
  }
  
  ❌ GridRenderer Step 1 - MISSING gridStateBefore
  ❌ GridRenderer Step 1 - MISSING gridStateAfter

Client error: ❌ Grid doesn't render
```

## Testing

1. ✅ **Server restarted** with alias generation (lines 311-313)
2. ✅ **Client updated** with debug logging
3. 🔄 **Reload browser** (F5)
4. 🔄 **Open console** (F12)
5. 🔄 **Spin the game**
6. ✅ **Check console** for grid field logs

### If Missing Grids Occur
1. **Look for**: `🔍 GridRenderer Step N - Grid fields received:`
2. **Check**: Are all `hasGrid*` flags `false`?
3. **If yes**: Server-side issue (not generating grids)
4. **If some true**: Check which fields are present
5. **Add aliases**: If server uses different field names, add them to the fallback chain

## Related Files

- **Client**: `src/renderer/GridRenderer.js` (Grid rendering)
- **Server**: `infinity-storm-server/src/game/gameEngine.js` (Grid generation)
- **Debug**: `src/debug/ServerDebugWindow.js` (Debug overlay display)

---

**Date**: 2025-10-11
**Status**: ✅ IMPLEMENTED
**Purpose**: Identify and diagnose missing grid display issues
**Method**: Enhanced console logging of grid field presence

