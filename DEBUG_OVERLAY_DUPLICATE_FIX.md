# Debug Overlay Duplicate Multipliers Fix

## Issue
User reported: "There is only 1 x5 random multiplier, but in debug overlay there was showing 3 x5 in debug overlay."

### Visual Evidence
- **Client Grid**: Showed 1 x5 multiplier overlay at position (1,0)
- **Debug Overlay**: Showed 3 "random_multiplier" events, all with "total x5"

## Root Cause
The debug overlay was collecting multiplier data from **multiple sources** and displaying all of them, causing duplicates:

1. `root.multiplierEvents[]` - Canonical source from gameEngine
2. `root.bonusFeatures.randomMultipliers[]` - Compatibility copy of same data
3. `root.randomMultipliers[]` - Legacy field with same data
4. `root.events[]` - Additional events array

The server intentionally sends multiplier data in multiple places for backwards compatibility, but the debug overlay was treating each source as independent data and showing all of them.

### Code Issue Location
**File**: `src/debug/ServerDebugWindow.js`
**Function**: `collectMultiplierSummaries()`
**Lines**: 362-378

```javascript
// BEFORE (BUGGY):
// 1. Check multiplierEvents array
if (Array.isArray(root?.multiplierEvents)) {
    root.multiplierEvents.forEach(evt => pushEvent(evt));
}

// 2. Check bonusFeatures.randomMultipliers  
if (Array.isArray(root?.bonusFeatures?.randomMultipliers)) {
    root.bonusFeatures.randomMultipliers.forEach(mult => pushEvent(mult)); // DUPLICATE!
}

// 3. Check legacy fields
addCollection(root?.randomMultipliers); // DUPLICATE!
addCollection(root?.multipliers); // DUPLICATE!
```

Each of these sources contained the SAME x5 multiplier, so it was displayed 3 times.

## Fix Applied

Changed the logic to use `multiplierEvents` as the **primary source** and only fall back to legacy fields if `multiplierEvents` doesn't exist:

```javascript
// AFTER (FIXED):
// 1. Check multiplierEvents array (primary source from gameEngine)
// This is the canonical source - use ONLY this to avoid duplicates
if (Array.isArray(root?.multiplierEvents) && root.multiplierEvents.length > 0) {
    root.multiplierEvents.forEach(evt => pushEvent(evt));
} else {
    // Fallback to legacy fields only if multiplierEvents doesn't exist
    if (Array.isArray(root?.bonusFeatures?.randomMultipliers)) {
        root.bonusFeatures.randomMultipliers.forEach(mult => pushEvent(mult));
    }
    addCollection(root?.randomMultipliers);
    addCollection(root?.multipliers);
    if (Array.isArray(root?.events)) {
        root.events.filter(e => e && (e.type || e.multiplier)).forEach(e => pushEvent(e));
    }
}
```

### Strategy
- **Primary Path**: Use `multiplierEvents` exclusively (modern server response)
- **Fallback Path**: Only use legacy fields if `multiplierEvents` is missing (backwards compatibility)
- **Result**: Each multiplier event is displayed exactly once

## Expected Behavior After Fix

### Example: Single x5 Multiplier
**Server Response**:
```json
{
  "multiplierEvents": [
    {
      "type": "random_multiplier",
      "totalMultiplier": 5,
      "multipliers": [...]
    }
  ],
  "bonusFeatures": {
    "randomMultipliers": [...] // Same data, for compatibility
  }
}
```

**Debug Overlay Display** (BEFORE fix):
```
🎯 Random Multipliers
  type=random_multiplier, total x5
  type=random_multiplier, total x5  
  type=random_multiplier, total x5
```
❌ Shows 3 events (duplicates)

**Debug Overlay Display** (AFTER fix):
```
🎯 Random Multipliers
  Event #1: random_multiplier | Total: x5 | Win: 1.30 → 6.50
```
✅ Shows 1 event (correct)

### Example: Multiple Cascading Multipliers
**Server Response**:
```json
{
  "multiplierEvents": [
    {
      "type": "cascade_random_multiplier",
      "totalMultiplier": 8,
      "multipliers": [
        { "multiplier": 2, "position": {"col": 1, "row": 0} },
        { "multiplier": 3, "position": {"col": 2, "row": 1} },
        { "multiplier": 3, "position": {"col": 3, "row": 2} }
      ]
    }
  ]
}
```

**Debug Overlay Display**:
```
🎯 Random Multipliers
  Event #1: cascade_random_multiplier | Total: x8 | Win: 10.00 → 80.00
    Multiplier 1: x2 | pos(col=2, row=1) | 👊 Thanos
    Multiplier 2: x3 | pos(col=3, row=2) | 🔴 Scarlet Witch
    Multiplier 3: x3 | pos(col=4, row=3) | 👊 Thanos
```
✅ Shows 1 event with 3 individual multipliers (correct)

## Testing
1. Start game with `?debug=1`
2. Play spins until multipliers trigger
3. Verify debug overlay shows:
   - Correct number of multiplier events (not duplicated)
   - Events match what's displayed on the grid
   - Cascade multipliers show individual breakdown

## Files Modified
- `src/debug/ServerDebugWindow.js` - Fixed `collectMultiplierSummaries()` to avoid duplicate data collection

## Related Issues Fixed
- ✅ Debug overlay no longer shows duplicate multiplier events
- ✅ Debug overlay multiplier count matches client visual display
- ✅ Maintains backwards compatibility with legacy server responses

## Date
2025-10-08

