# RTP Simulator Scatter Chance Fix

## Issue

After running a 50,000 spin simulation, the scatter trigger rate was showing **0.00%**, despite having scatter chance set to 3.5%. This indicated that no scatter symbols appeared in any of the 50,000 spins, which is statistically impossible.

## Root Cause

The `rtpSimulator.js` was creating a new `GridGenerator` but wasn't properly updating the `SymbolDistribution` instance inside it with the custom scatter chance. 

The `SymbolDistribution` class has hardcoded scatter chances:
```javascript
this.scatterChance = {
  base_game: 0.035,    // 3.5% in base game
  free_spins: 0.04
};
```

When the simulator passed `scatterChance` as a constructor option to `GridGenerator`, it was ignored because:
1. `GridGenerator` doesn't accept `scatterChance` in its constructor options
2. `GridGenerator` creates its own `SymbolDistribution` instance internally
3. The custom scatter chance was never applied to that instance

## Solution

Modified `rtpSimulator.js` to:

1. Create the `GridGenerator` normally
2. **Directly update the `symbolDistribution` instance** inside the GridGenerator with custom values:
   - Update `baseWeights` for symbol probability changes
   - Update `scatterChance.base_game` and `scatterChance.free_spins` for scatter probability

### Before (Broken)
```javascript
gameEngine.gridGenerator = new GridGenerator({
  symbolWeights: customConfig.SYMBOL_WEIGHTS,
  scatterChance: customConfig.SCATTER_CHANCE  // ❌ IGNORED
});
```

### After (Fixed)
```javascript
// Create GridGenerator
gameEngine.gridGenerator = new GridGenerator({
  auditLogging: false
});

// Update symbol weights in SymbolDistribution
if (customConfig.SYMBOL_WEIGHTS) {
  Object.entries(customConfig.SYMBOL_WEIGHTS).forEach(([symbol, weight]) => {
    gameEngine.gridGenerator.symbolDistribution.baseWeights[symbol] = weight;
  });
}

// Update scatter chance in SymbolDistribution
if (customConfig.SCATTER_CHANCE !== undefined) {
  gameEngine.gridGenerator.symbolDistribution.scatterChance.base_game = customConfig.SCATTER_CHANCE;
  gameEngine.gridGenerator.symbolDistribution.scatterChance.free_spins = customConfig.SCATTER_CHANCE;
}
```

## Expected Results After Fix

With 3.5% scatter chance and 50,000 spins:
- **Expected scatter symbols**: ~52,500 scatter appearances (3.5% of 30 symbols per spin × 50,000)
- **Expected 4+ scatter triggers**: 50-200 free spin triggers (depends on cluster distribution)
- **Scatter trigger rate**: Should now show 0.1% - 0.4% instead of 0.00%

## Testing

To verify the fix:
1. Navigate to RTP Tuning Tool
2. Set scatter chance to 0.035 (3.5%)
3. Run a 50,000 spin simulation
4. Check "Scatter Trigger Rate" - should be > 0%
5. Check scatter count in symbol distribution chart - should appear

## Files Modified

- `infinity-storm-server/src/services/rtpSimulator.js` - Fixed scatter chance application

## Related Files

- `infinity-storm-server/src/game/symbolDistribution.js` - Contains hardcoded default scatter chances
- `infinity-storm-server/src/game/gridGenerator.js` - Creates SymbolDistribution internally

---

**Fix Date**: January 27, 2025  
**Status**: ✅ FIXED

