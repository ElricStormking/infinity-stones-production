# Test Authentication Fix - Quick Guide

## ✅ Server Restarted

The server is now running with the fixed authentication code!

## Next Steps:

### Step 1: Clear Browser Data ⚠️ IMPORTANT!
Open your browser console (F12) and run:
```javascript
localStorage.clear();
location.reload();
```

### Step 2: Fresh Login
1. Navigate to: **http://localhost:3000/test-player-login.html**
2. Click **"Login as Test Player"**
3. Verify you see:
   - ✅ Login Successful!
   - Player ID: 2666b007-...
   - Is Demo: **false**
   - Token saved to localStorage

### Step 3: Test Game
1. Click the **"→ Open Game"** link
2. Or manually open: **http://localhost:3000?debug=true**

### Step 4: Check Console Logs
You should see:
```
✅ 🔐 Loading auth token from localStorage
✅ 🚩 Server mode enabled: true
✅ 🔍 Fetching initial server state...
✅ Balance display updated from server: $10000.00
✅ Wallet UI initialized with server balance
```

You should NOT see:
```
❌ 401 (Unauthorized)
❌ Authentication error
❌ Connection lost - switching to demo mode
```

### Step 5: Play a Spin
1. Click the spin button
2. Watch the console for:
   ```
   💵 Setting balance from server: [updated amount]
   💰 Server mode: Balance already updated by server
   ```
3. **Verify:** Balance updates correctly after winning

## What Was Fixed

### The Bug:
- Login stored tokens with **bcrypt** hash: `$2b$05$...`
- Validation searched for **SHA256** hash: `a3f2b8c...`
- Hashes never matched → 401 error

### The Fix:
- Both login and registration now use **SHA256** hash
- Matches the Session model's `generateTokenHash()` method
- Token validation works correctly

## Troubleshooting

### If you still see 401 errors:
1. Make sure localStorage was cleared
2. Do a fresh login (don't use old token)
3. Check server logs for "Player login successful"
4. Verify session is created in database

### If balance doesn't update:
1. Check console for "Balance display updated from server"
2. Verify "Server mode enabled: true"
3. Look for "💰 Server mode: Balance already updated by server"

### If game switches to demo mode:
1. Server might not be running
2. Token might be invalid/expired
3. Clear localStorage and login again

## Quick Verification Commands

### Check if authenticated:
```javascript
// In browser console after login:
console.log('Token:', localStorage.getItem('authToken') ? 'Present' : 'Missing');
console.log('Player ID:', localStorage.getItem('playerId'));

// After game loads:
const scene = window.game?.scene?.scenes[0];
console.log('Server Mode:', scene?.serverMode);
console.log('Demo Mode:', scene?.demoMode);
console.log('Balance:', scene?.stateManager?.gameData?.balance);
```

### Expected output:
```
Token: Present
Player ID: 2666b007-37a6-41b3-b5af-e7ed4563dc72
Server Mode: true
Demo Mode: false
Balance: 10000
```

## Success Criteria

✅ Login without 401 errors  
✅ Token saved and recognized  
✅ Game stays in server mode  
✅ Balance loads from server  
✅ Balance updates after spins  
✅ No demo mode fallback  

## Ready to Test!

1. Clear localStorage (important!)
2. Login at: http://localhost:3000/test-player-login.html
3. Play game at: http://localhost:3000?debug=true
4. Report results!

**Expected Result:** Everything should work perfectly now! 🎉

