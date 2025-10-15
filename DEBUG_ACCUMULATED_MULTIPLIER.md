# Debug Accumulated Multiplier Issue

## How to Test and Debug

### Step 1: Check Console Logs

When playing during free spins, watch for these console logs:

**Client-side (browser console):**
```
🔍 GameAPI: Sending spin request with accumulated multiplier: {accumulatedMultiplier: 6, freeSpinsActive: true, freeSpinsRemaining: 7}
🔍 NetworkService: Extracting accumulated multiplier: {hasAccumulatedMultiplier: true, accumulatedMultiplierValue: 6, finalValue: 6, ...}
🎰 FREE SPINS ACCUMULATED MULTIPLIER - Preparing progressive update: {currentDisplay: 6, serverTarget: 6, ...}
```

**Server-side (server terminal):**
```
🎰 FREE SPINS: Processing multiplier accumulation: {previousAccumulated: 6, newMultipliersFromThisSpin: 0, ...}
🎰 GAME ENGINE: No new multipliers, maintaining accumulated: {accumulatedMultiplier: 6, ...}
```

### Step 2: Identify Where the Reset Happens

**Scenario A: Client sends wrong value**
If you see:
```
🔍 GameAPI: Sending spin request with accumulated multiplier: {accumulatedMultiplier: 1, ...}
```
But the previous spin had x6, then the problem is in `src/services/GameAPI.js` line 222:
```javascript
const accumulatedMultiplier = freeSpinsData?.multiplierAccumulator || 1;
```
The `freeSpinsData.multiplierAccumulator` is being reset somewhere in the client.

**Scenario B: Server receives correct but doesn't maintain**
If client sends x6 but server logs show:
```
🎰 GAME ENGINE: No new multipliers, maintaining accumulated: {accumulatedMultiplier: 1, ...}
```
Then the server received 1 instead of 6. Check `infinity-storm-server/src/routes/api.js` line 124.

**Scenario C: Server maintains but client doesn't receive**
If server logs show:
```
🎰 GAME ENGINE: No new multipliers, maintaining accumulated: {accumulatedMultiplier: 6, ...}
```
But client receives x1, check the API response in Network tab.

### Step 3: Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "demo-spin" or "spin"
4. Look at the Request Payload and Response

**Expected Request (when accumulated multiplier is x6):**
```json
{
  "betAmount": 1,
  "quickSpinMode": false,
  "freeSpinsActive": true,
  "accumulatedMultiplier": 6
}
```

**Expected Response (when no new multipliers):**
```json
{
  "success": true,
  "data": {
    "accumulatedMultiplier": 6,
    ...
  }
}
```

### Step 4: Verify State Manager

Check the state manager's accumulated multiplier value before each spin:

**Add this to browser console:**
```javascript
// Monitor accumulated multiplier
setInterval(() => {
  const fs = window.gameScene?.stateManager?.freeSpinsData;
  if (fs?.active) {
    console.log('📊 Current accumulated multiplier:', fs.multiplierAccumulator);
  }
}, 1000);
```

### Common Issues and Fixes

#### Issue 1: multiplierAccumulator gets reset after shooting stars
**Symptom:** Accumulator is correct before shooting stars, but resets to 1 after they land

**Check:** `src/scenes/GameScene.js` around line 1309:
```javascript
this.stateManager.freeSpinsData.multiplierAccumulator = newAccum;
```

Make sure this is ADDING to the accumulator, not SETTING it to the new multiplier value.

#### Issue 2: Server doesn't receive accumulated multiplier
**Symptom:** Client sends it but server logs show accumulatedMultiplier: 1

**Check:** `infinity-storm-server/src/routes/api.js` line 124:
```javascript
const { betAmount = 1.0, quickSpinMode = false, freeSpinsActive = false, accumulatedMultiplier = 1, rngSeed } = req.body;
```

The default is 1, so if the request doesn't include it, it defaults to 1.

#### Issue 3: freeSpinsActive is false when it should be true
**Symptom:** Server doesn't set newAccumulatedMultiplier because freeSpinsActive is false

**Check:** Make sure client is sending `freeSpinsActive: true` in the request.

### Debugging Commands

**Get current state:**
```javascript
window.gameScene?.stateManager?.freeSpinsData
```

**Manually set accumulated multiplier:**
```javascript
window.gameScene.stateManager.freeSpinsData.multiplierAccumulator = 10;
window.gameScene.uiManager.updateAccumulatedMultiplierDisplay();
```

**Check last server response:**
```javascript
// In Network tab, select the last demo-spin request
// Click "Response" to see what server returned
```

### Test Procedure

1. Start free spins mode
2. Get a spin with random multiplier (e.g., x5) → Accumulator should be x6 (1 + 5)
3. Get a spin with another multiplier (e.g., x3) → Accumulator should be x9 (6 + 3)
4. Get a spin with NO multipliers → Accumulator should STAY x9 ✅
5. Get another spin with NO multipliers → Accumulator should STILL be x9 ✅

If step 4 or 5 shows x1 instead of x9, that's the bug.

### Expected Behavior

**Spin 1:** Base (no free spins)
- Accumulator: x1

**Spin 2:** Get 4+ scatters, trigger free spins
- Accumulator: x1 (starts at base)

**Spin 3:** First free spin, get x5 multiplier
- Accumulator after: x6 (1 + 5)

**Spin 4:** Free spin, NO multipliers
- Accumulator: x6 (MAINTAINED)

**Spin 5:** Free spin, get x3 multiplier
- Accumulator after: x9 (6 + 3)

**Spin 6:** Free spin, NO multipliers
- Accumulator: x9 (MAINTAINED)

**Spin 7:** Free spin, NO multipliers
- Accumulator: x9 (MAINTAINED)

**Spin 8:** Last free spin, free spins end
- Accumulator resets to x1 for next base game

### Code Locations to Check

1. **Client sends accumulated multiplier:**
   - `src/services/GameAPI.js` line 222-238

2. **Server receives accumulated multiplier:**
   - `infinity-storm-server/src/routes/api.js` line 124-135

3. **Server maintains accumulated multiplier:**
   - `infinity-storm-server/src/game/gameEngine.js` line 604-611

4. **Client receives accumulated multiplier:**
   - `src/services/NetworkService.js` line 1103-1120

5. **Client updates display:**
   - `src/scenes/GameScene.js` line 2777-2811

### If All Else Fails

Enable FULL debug logging:

**In browser console:**
```javascript
localStorage.setItem('DEBUG_ACCUMULATED_MULTIPLIER', 'true');
```

This will add even more verbose logging to help trace the issue.

