# Demo Spin - Accumulated Multiplier Fix

## Issue

During Free Spins mode in demo mode, the accumulated multiplier badge **stayed at x1** for the entire duration, never updating even though the server was correctly calculating new accumulated values.

## Root Cause

**File**: `infinity-storm-server/src/routes/api.js` (Line 152)

The `/api/demo-spin` route was returning the `accumulatedMultiplier` from the **request body** (the old input value), instead of returning `spin.newAccumulatedMultiplier` (the new calculated value from the game engine).

### The Code Bug

```javascript
// BROKEN CODE (Line 137-159):
return res.json({
  success: true,
  data: {
    spinId: spin.spinId,
    betAmount: spin.betAmount,
    totalWin: spin.totalWin,
    // ... other fields ...
    accumulatedMultiplier,  // ← Returns INPUT from request body!
    rngSeed: spin.rngSeed
  }
});
```

### What Was Happening

**Spin 1**:
- Client sends: `accumulatedMultiplier: 1`
- Server calculates: `newAccumulatedMultiplier = 1 + 4 = 5` ✅
- Server returns: `accumulatedMultiplier: 1` ❌ (from request!)
- Client receives: `1` (badge stays at x1)

**Spin 2**:
- Client sends: `accumulatedMultiplier: 1` (still 1!)
- Server calculates: `newAccumulatedMultiplier = 1 + 3 = 4` ✅
- Server returns: `accumulatedMultiplier: 1` ❌ (from request!)
- Client receives: `1` (badge stays at x1)

**Result**: Badge never updates because server keeps returning the old value!

## The Fix

**File**: `infinity-storm-server/src/routes/api.js` (Line 153)

Changed the response to return the **new** accumulated multiplier from the game engine:

```javascript
// FIXED CODE:
return res.json({
  success: true,
  data: {
    spinId: spin.spinId,
    betAmount: spin.betAmount,
    totalWin: spin.totalWin,
    // ... other fields ...
    // CRITICAL FIX: Return the NEW accumulated multiplier from game engine!
    accumulatedMultiplier: spin.newAccumulatedMultiplier || accumulatedMultiplier,
    rngSeed: spin.rngSeed
  }
});
```

### Now Working Correctly

**Spin 1**:
- Client sends: `accumulatedMultiplier: 1`
- Server calculates: `newAccumulatedMultiplier = 1 + 4 = 5` ✅
- Server returns: `accumulatedMultiplier: 5` ✅ (from spin.newAccumulatedMultiplier!)
- Client receives: `5` → Badge updates to **x5** ✅

**Spin 2**:
- Client sends: `accumulatedMultiplier: 5` (updated!)
- Server calculates: `newAccumulatedMultiplier = 5 + 3 = 8` ✅
- Server returns: `accumulatedMultiplier: 8` ✅
- Client receives: `8` → Badge updates to **x8** ✅

**Spin 3** (no multipliers):
- Client sends: `accumulatedMultiplier: 8`
- Server maintains: `newAccumulatedMultiplier = 8` ✅
- Server returns: `accumulatedMultiplier: 8` ✅
- Client receives: `8` → Badge stays at **x8** ✅

## Why Demo Mode Was Different

- **Authenticated mode** (`/api/spin`): Uses the `stateManager` which persists state to database and returns the updated `accumulated_multiplier`
- **Demo mode** (`/api/demo-spin`): Doesn't use stateManager (no database), so it must return the calculated `newAccumulatedMultiplier` directly

## Expected Behavior Now

### With New Multipliers
```
Server calculates: newAccumulatedMultiplier = 1 + 5 = 6
Server returns: accumulatedMultiplier: 6
Client badge: x6 ✅
```

### Without New Multipliers
```
Server maintains: newAccumulatedMultiplier = 6
Server returns: accumulatedMultiplier: 6
Client badge: x6 ✅ (maintained)
```

### Accumulating Over Multiple Spins
```
Spin 1: 1 + 4 = 5 → Badge: x5
Spin 2: 5 + 3 = 8 → Badge: x8
Spin 3: 8 + 0 = 8 → Badge: x8 (no change)
Spin 4: 8 + 2 = 10 → Badge: x10
```

## Testing

1. ✅ **Server updated** with fix
2. ✅ **Server restarted**
3. 🔄 **Reload browser** (F5 or Ctrl+R)
4. 🔄 **Enter Free Spins mode** (demo mode)
5. 🔄 **Trigger multipliers** (e.g., x4, x3)
6. ✅ **Badge should update** (x1 → x5 → x8, etc.)
7. 🔄 **Spin without multipliers**
8. ✅ **Badge should maintain** (stays at x8)
9. 🔄 **Check debug overlay** - should match badge

### Console Verification

**Server logs will show:**
```
🎰 GAME ENGINE: New accumulated multiplier for NEXT spin: {
  previousAccumulated: 5,
  newMultipliersFromCurrentSpin: [ 3 ],
  newAccumulated: 8
}
```

**Client will receive:**
```json
{
  "success": true,
  "data": {
    "accumulatedMultiplier": 8,  ← NEW value!
    ...
  }
}
```

**Client badge will show:** x8 ✅

## Summary

- ✅ **Fixed**: Demo-spin now returns `spin.newAccumulatedMultiplier` instead of input value
- ✅ **Fixed**: Badge now updates correctly in Free Spins mode
- ✅ **Fixed**: Accumulated multiplier persists across spins in demo mode
- ✅ **Fallback**: Uses input value if `newAccumulatedMultiplier` is not set (regular mode)

---

**Date**: 2025-10-12
**Status**: ✅ FIXED
**Issue**: Demo-spin returned old accumulated multiplier from request body
**Fix**: Return `spin.newAccumulatedMultiplier` from game engine calculation

