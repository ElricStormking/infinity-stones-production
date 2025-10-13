# Formula Plaque - Show Base Win Before Shooting Stars Complete

## Modification Request
User requested: "DO NOT show the Final Total Result of the winning amount on formula plaque before shooting star visuals were displayed. Show the symbol payout amount before multiplying happen first."

## Implementation

### The Change
Modified the formula plaque to show **only the base win** (symbol payout before multipliers) while shooting stars are animating, instead of showing the final multiplied total.

### Visual Flow

**Before Modification:**
1. Cascades complete, base win = $2.35, final win = $32.90
2. Formula plaque shows: `$32.90` (final total - wrong!)
3. Shooting stars fire and animate (x6, x5, x3)
4. When stars arrive, formula updates to: `$2.35 x14 = $32.90`

**After Modification:**
1. Cascades complete, base win = $2.35, final win = $32.90
2. Formula plaque shows: `$2.35` (base win only - correct!)
3. Shooting stars fire and animate (x6, x5, x3)
4. When stars arrive, formula updates to: `$2.35 x14 = $32.90`

### Code Changes

**File**: `src/managers/UIManager.js` (Line 1192-1195)

```javascript
// OLD (showed final total):
} else {
    text = `$${amount.toFixed(2)}`;  // amount = $32.90 (final total)
}

// NEW (shows base win):
} else if (hasPendingStars && baseRounded >= 0.01) {
    // MODIFICATION: Show only BASE WIN (not final total) while shooting stars are pending
    // This shows the symbol payout BEFORE multipliers are applied
    text = `$${baseRounded.toFixed(2)}`;  // baseRounded = $2.35 (base win)
} else {
    text = `$${amount.toFixed(2)}`;
}
```

### Logic Explanation

The `updateWinDisplay()` method now handles three cases:

1. **Normal formula** (no pending stars, has multipliers):
   - Shows: `$2.35 x14 = $32.90` (full formula)
   - Condition: `meaningfulFormula === true`

2. **Pending stars** (stars haven't arrived yet):
   - Shows: `$2.35` (base win only) ← **NEW!**
   - Condition: `hasPendingStars && baseRounded >= 0.01`

3. **Fallback** (no multipliers at all):
   - Shows: `$2.35` (just the amount)
   - Condition: All other cases

### User Experience

**Example: Win with x14 multiplier**

**Timeline:**
1. **Symbols land and cascade** → Formula shows: `$2.35`
2. **Thanos appears** → Formula still shows: `$2.35`
3. **First shooting star (x6) fires** → Formula still shows: `$2.35`
4. **First star arrives at plaque** → Formula updates: `$2.35 x6 = $14.10`
5. **Second shooting star (x5) fires** → Formula shows: `$2.35 x6 = $14.10`
6. **Second star arrives** → Formula updates: `$2.35 x11 = $25.85`
7. **Third shooting star (x3) fires** → Formula shows: `$2.35 x11 = $25.85`
8. **Third star arrives** → Formula updates: `$2.35 x14 = $32.90` ✅

**Key Improvement:** 
- Players see the **base win amount first** ($2.35)
- This shows "what the symbols paid" before multipliers
- The final total ($32.90) only appears **AFTER** all shooting stars complete
- Creates better suspense and visual feedback

### Testing Steps

1. ✅ **Refresh browser** (F5)
2. ✅ **Spin until you get a multiplier win** (e.g., x6, x5, x3)
3. ✅ **Watch the formula plaque carefully**:
   - Should show: `$2.35` (base win) initially
   - NOT show: `$32.90` (final total) until stars complete
4. ✅ **As each shooting star arrives**:
   - Formula should progressively update: `$2.35 x6 = ...`, then `$2.35 x11 = ...`, then `$2.35 x14 = $32.90`

### Files Modified

- **`src/managers/UIManager.js`** (Line 1192-1195) - Added condition to show base win when stars are pending

### Result

✅ Formula plaque now shows the **base symbol payout** ($2.35) while shooting stars are animating, instead of prematurely showing the final multiplied total ($32.90).

This creates better visual progression and suspense:
- Base win visible → Shooting stars animate → Progressive multiplier updates → Final total revealed!

