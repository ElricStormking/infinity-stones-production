# Multiplier Calculation Bug Fix

## Issue
The formula plaque was showing **x12** when the server calculated **x7**.

## Root Cause
In `src/scenes/GameScene.js` line 2498, the fallback calculation for `totalAppliedMultiplier` was **multiplying** multipliers together instead of **adding** them:

```javascript
// WRONG (before):
totalAppliedMultiplier: normalized.multiplierEvents.reduce((acc, evt) => acc * (evt.totalMultiplier || 1), 1)
// This would calculate: 1 * 4 * 3 = 12 ❌

// CORRECT (after):
totalAppliedMultiplier: normalized.multiplierEvents.reduce((sum, evt) => sum + (evt.totalMultiplier || 0), 0)
// This calculates: 0 + 4 + 3 = 7 ✅
```

## Understanding the Multiplier System

### Server Calculation (Correct)
The server in `infinity-storm-server/src/game/gameEngine.js` (lines 458-460) correctly calculates:
```javascript
const totalAppliedMultiplier = baseWinBeforeMultipliers > 0
  ? finalWinAfterMultipliers / baseWinBeforeMultipliers  // Ratio method (preferred)
  : multiplierEvents.reduce((sum, evt) => sum + (evt.totalMultiplier || 0), 0);  // Addition fallback
```

### How Multipliers Work
1. **Individual multipliers are summed**: x4 + x3 = x7 total multiplier
2. **The total is then applied to the base win**: $0.85 × 7 = $5.95
3. **NOT**: $0.85 × 4 × 3 = $10.20 ❌

### Example
- Base win: $0.85
- Cascade multiplier event: x4 (sum of 2+2 individual multipliers)
- Random multiplier event: x3
- **Total multiplier**: x4 + x3 = **x7** ✅
- **Final win**: $0.85 × 7 = **$5.95**

## Files Modified
1. **src/scenes/GameScene.js** (line 2498-2500)
   - Fixed fallback calculation to use addition instead of multiplication
   - Added logging to show which calculation path is used (SERVER vs FALLBACK)

2. **src/managers/BonusManager.js**
   - Added detailed logging for multiplier normalization (line 591)
   - Added logging for cascade multiplier event processing (lines 515-518)

## Testing
1. Reload the browser
2. Click "Replay Last Spin"
3. Check console for: `🎯 Using SERVER/FALLBACK multiplier summary`
4. Verify formula plaque shows x7 (not x12)
5. Verify final win matches server calculation

## Server Response Structure
The server sends `multiplierAwarded` at the top level:
```json
{
  "multiplierAwarded": {
    "events": [...],
    "originalWin": 0.85,
    "finalWin": 5.95,
    "totalAppliedMultiplier": 7
  }
}
```

The client should always prefer `normalized.multiplierAwarded.totalAppliedMultiplier` over fallback calculation.

