# Balance Update Debug Guide

## Issue
Test player login fails (401 Unauthorized), game switches to demo mode, but balance doesn't update after wins.

## Root Causes

### 1. Authentication Token Expiring
**Symptom:** 401 errors, "Authentication error - user session expired"  
**Cause:** Token saved in localStorage is invalid or expired  
**Solution:** Clear and re-login

### 2. Demo Mode Balance Not Updating
**Symptom:** Win $1.65 but balance stays at $5000.00  
**Cause:** `lastServerBalanceUpdate` tracking issue  
**Solution:** Enhanced logging and fixes applied

## Fixes Applied

### Fix 1: Better Auth Error Handling
**File:** `src/scenes/GameScene.js` (Line 512-523)

```javascript
if (error.response && error.response.status === 401) {
    console.warn('🔐 Authentication failed - clearing token and using demo mode');
    localStorage.removeItem('authToken');
    localStorage.removeItem('playerId');
    if (window.NetworkService) {
        window.NetworkService.setAuthToken(null);
    }
    // Switch to demo mode
    this.serverMode = false;
    this.demoMode = true;
    this.ensureDemoBalance();
}
```

**Effect:** When auth fails, properly clear token and switch to demo mode

### Fix 2: Enhanced Balance Update Logging
**File:** `src/scenes/GameScene.js` (Line 2046-2065)

```javascript
console.log('💰 [endSpin] Balance update check:', {
    totalWin: this.totalWin,
    lastServerBalanceUpdate: this.lastServerBalanceUpdate,
    serverSentBalance: serverSentBalance,
    demoMode: this.demoMode,
    serverMode: this.serverMode,
    currentBalance: this.stateManager.gameData.balance
});
```

**Effect:** Clear visibility into balance update logic

## Testing Steps

### Step 1: Clear Everything
```javascript
// Open browser console (F12) and run:
localStorage.clear();
```

### Step 2: Restart Server
```powershell
# Stop server (Ctrl+C), then restart:
cd infinity-storm-server
npm run dev
```

### Step 3: Fresh Login
1. Go to: `http://localhost:3000/test-player-login.html`
2. Click "Login as Test Player"
3. **Verify:** "Is Demo: false" and "Login Successful!"

### Step 4: Test Game
1. Open: `http://localhost:3000/`
2. **Check console for:**
   ```
   🔐 Loading auth token from localStorage
   🚩 Server mode enabled: true
   ```

### Step 5: Play and Monitor
1. Place a bet
2. If you see "Connection lost - switching to demo mode":
   - **Check console for balance update logs**
   - Should see: `💰 [endSpin] Balance update check`
   - Should see: `💰 Client mode: Added win to balance`

## Expected Console Logs

### Successful Auth Mode:
```
🔐 Loading auth token from localStorage
🚩 Server mode enabled: true
🔍 Fetching initial server state...
💵 Setting balance from server: 10000
[After spin]
💵 [processServerSpin] Setting balance from server: 10001.65
💰 [endSpin] Balance update check: {
    lastServerBalanceUpdate: 10001.65,
    serverSentBalance: true,
    demoMode: false
}
💰 Server mode: Balance already updated by server
```

### Demo Mode (Auth Failed):
```
🔐 Authentication failed - clearing token and using demo mode
Connection lost - switching to demo mode
[After spin]
💵 Server returned null balance - demo mode
💰 [endSpin] Balance update check: {
    lastServerBalanceUpdate: null,
    serverSentBalance: false,
    demoMode: true
}
💰 Client mode: Added win to balance: {
    win: 1.65,
    before: 5000,
    after: 5001.65
}
```

## Debug Checklist

### If Auth Fails (401):
- [ ] Clear localStorage
- [ ] Restart server
- [ ] Re-login via test-player-login.html
- [ ] Verify token is saved
- [ ] Check server logs for login success

### If Balance Doesn't Update:
- [ ] Check console for `💰 [endSpin] Balance update check`
- [ ] Verify `lastServerBalanceUpdate` value
- [ ] Check `serverSentBalance` boolean
- [ ] Confirm `demoMode` state
- [ ] Look for "Added win to balance" or "Balance already updated by server"

### If Still Not Working:
1. **Check `lastServerBalanceUpdate`:**
   ```javascript
   // In console after spin:
   window.game.scene.scenes[0].lastServerBalanceUpdate
   ```
   - Should be `null` in demo mode
   - Should be a number in auth mode

2. **Check demo mode flag:**
   ```javascript
   window.game.scene.scenes[0].demoMode
   ```
   - Should be `true` if auth failed

3. **Check balance before/after:**
   ```javascript
   // Before endSpin
   window.game.scene.scenes[0].stateManager.gameData.balance
   ```

## Common Issues

### Issue: "Is Demo: undefined" in login page
**Cause:** Server not restarted after code changes  
**Fix:** Restart server

### Issue: Token not loading
**Cause:** localStorage was cleared after login  
**Fix:** Re-login

### Issue: Always switches to demo mode
**Cause:** Token invalid or server not accepting it  
**Fix:** 
1. Check server logs
2. Verify token format
3. Re-create test player

### Issue: Balance updates in auth mode but not demo
**Cause:** `lastServerBalanceUpdate` logic issue  
**Fix:** Check console logs for balance update flow

### Issue: Multiple authentication errors
**Cause:** Expired token making multiple API calls  
**Fix:** Clear localStorage, restart server, fresh login

## Manual Balance Test

If automatic updates fail, test manually:

```javascript
// Get game scene
const scene = window.game.scene.scenes[0];

// Check current state
console.log('Current balance:', scene.stateManager.gameData.balance);
console.log('Demo mode:', scene.demoMode);
console.log('Last server balance:', scene.lastServerBalanceUpdate);

// Manually add win (for testing)
scene.stateManager.addWin(10);
scene.updateBalanceDisplay();

// Check new balance
console.log('New balance:', scene.stateManager.gameData.balance);
```

## Server-Side Checks

### Check if player is demo:
```sql
SELECT username, is_demo, credits 
FROM players 
WHERE username = 'testplayer';
```

**Expected:** `is_demo: false`, `credits: 10000`

### Check if token is valid:
Look in server logs after login:
```
Player login successful
  player_id: 2666b007-...
  username: testplayer
  is_demo: false
```

## Quick Fix Commands

### Complete Reset:
```javascript
// Browser console:
localStorage.clear();
window.location.reload();
```

Then restart server and re-login.

### Force Demo Mode (for testing):
```javascript
const scene = window.game.scene.scenes[0];
scene.serverMode = false;
scene.demoMode = true;
scene.lastServerBalanceUpdate = null;
scene.ensureDemoBalance();
```

### Test Balance Addition:
```javascript
const scene = window.game.scene.scenes[0];
scene.totalWin = 1.65;
scene.lastServerBalanceUpdate = null; // Simulate demo mode
// Then trigger endSpin logic manually
```

## Success Criteria

✅ **Auth Mode Success:**
- Login shows "Is Demo: false"
- Console shows "Server mode enabled: true"
- Balance updates from server
- Console shows "Balance already updated by server"

✅ **Demo Mode Success:**
- Console shows "Authentication failed - clearing token"
- Game switches to demo mode
- Balance updates client-side
- Console shows "Added win to balance"
- Balance increases correctly

## Next Steps

1. **Clear localStorage** - Remove any stale tokens
2. **Restart server** - Ensure latest code is running
3. **Fresh login** - Get a new valid token
4. **Play game** - Monitor console logs
5. **Report findings** - Share console logs if issues persist

## Support Information

If balance still doesn't update after following this guide:

1. **Capture console logs** - Full console output during spin
2. **Capture network logs** - Check Network tab for API responses
3. **Share state** - Run debug commands above and share output
4. **Check server logs** - Look for errors on server side

---

**Last Updated:** After implementing enhanced logging and auth error handling  
**Status:** Monitoring for test results

