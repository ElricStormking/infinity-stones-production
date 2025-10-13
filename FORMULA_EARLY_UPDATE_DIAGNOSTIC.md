# Formula Early Update - Diagnostic Logging Added

## Issue
The formula plaque shows `$1.35 x2 = $2.70` **while** the x2 shooting star is still mid-flight, meaning the multiplier total is updating **before** the star arrives at the plaque.

## Added Diagnostic Logging

### File: `src/managers/UIManager.js` (Line 1250-1253)

```javascript
setWinFormula(baseAmount, accumulatedMultiplier, finalAmount) {
    if (!this.winTopText) return;
    // DIAGNOSTIC: Log who's calling setWinFormula and whether stars are pending
    const pending = (this.scene.normalModePendingStars || 0);
    const trace = new Error().stack.split('\n').slice(1, 4).join(' → ');
    console.log(`🔧 setWinFormula called: x${accumulatedMultiplier} (${pending} stars pending) via ${trace}`);
    // ... rest of function
}
```

## What This Will Show

When you refresh and trigger another multiplier spin, the browser console will show **every** call to `setWinFormula` with:
- The multiplier value being set
- How many stars are still pending
- The function call stack (who called it)

## Expected Output (Correct Behavior)

```
📊 Server multiplier: x2 (from 1 events with 1 total multipliers, ...)
⭐ Firing shooting star for single multiplier: x2 from (3,2) [ID: star_3_2_2_0]
🔧 setWinFormula called: x2 (0 stars pending) via playRandomMultiplierShootingStar → GameScene.js:1195
```

## What We're Looking For (Bug)

If you see something like:
```
📊 Server multiplier: x2 (from 1 events with 1 total multipliers, ...)
🔧 setWinFormula called: x2 (1 stars pending) via ??? → showRandomMultiplierResult
⭐ Firing shooting star for single multiplier: x2 from (3,2) [ID: star_3_2_2_0]
```

This would show that `setWinFormula` is being called **synchronously during event processing** while stars are still pending (= 1), before any stars have fired.

## Next Steps

1. **Refresh the page** (F5)
2. **Spin until you get a multiplier**
3. **Watch the browser console** for the `🔧 setWinFormula called` messages
4. **Share the console output** showing:
   - The "📊 Server multiplier" line
   - All "🔧 setWinFormula called" lines
   - Any "⭐ Firing shooting star" lines

This will pinpoint exactly who's calling `setWinFormula` too early and with what pending star count.

## Suspected Culprits

1. **updateWinDisplay()** in GameScene.js line 2623 (should be gated by `hasPendingStars` check)
2. **showRandomMultiplierResult()** in BonusManager.js (might be calling something synchronously)
3. **Some other code path** we haven't identified yet

The stack trace will tell us!

