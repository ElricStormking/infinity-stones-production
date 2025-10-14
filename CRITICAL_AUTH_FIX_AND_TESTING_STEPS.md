# Critical Authentication Fix & Testing Steps

## 🔧 What Was Fixed

### The Bug
The authentication system had a **critical token hashing mismatch**:

1. **During Login/Registration** (`auth.js` lines 557, 682):
   - Was using: `bcrypt.hash(token, 5)` → `$2b$05$...` (60+ chars)
   - Should use: `crypto.createHash('sha256').update(token).digest('hex')` → `a3f2b8c...` (64 chars)

2. **During Token Validation** (`Session.js` line 296, `jwt.js` line 102):
   - Always used: `SHA256` hash

3. **Result**: 
   - Login created session with bcrypt hash
   - Validation looked for SHA256 hash
   - Hash never matched → **401 Unauthorized on every request**

### The Fix ✅
Modified `infinity-storm-server/src/controllers/auth.js`:

```javascript
// Added at top:
const crypto = require('crypto');

// In register() method (line ~557):
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const sessionResult = await client.query(sessionQuery, [
  player.id,
  tokenHash, // ✅ Now uses SHA256 to match Session.generateTokenHash()
  req.ip || req.connection.remoteAddress,
  req.headers['user-agent'],
  true
]);

// In login() method (line ~682):
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const sessionResult = await client.query(sessionQuery, [
  player.id,
  tokenHash, // ✅ Now uses SHA256 to match Session.generateTokenHash()
  req.ip || req.connection.remoteAddress,
  req.headers['user-agent'],
  true
]);
```

## 🧪 How to Test

### Step 1: Server Status ✅
Server has been restarted with the fixed code (all old node processes killed).

### Step 2: Clear Old Data ⚠️ IMPORTANT!
Old sessions with bcrypt hashes are still in the database and may cause issues.

**Option A: Clear Browser localStorage (Required)**
```javascript
// In browser console (F12):
localStorage.clear();
location.reload();
```

**Option B: Clear Database Sessions (Recommended)**
```sql
-- Connect to your database and run:
DELETE FROM sessions;
```

Or use the Supabase dashboard to delete all rows from the `sessions` table.

### Step 3: Fresh Login
1. Navigate to: http://localhost:3000/test-player-login.html
2. Click **"Login as Test Player"**
3. Expected response:
   ```
   ✅ Login Success!
   Player:
   - ID: 2666b007-...
   - Username: testplayer
   - Email: test@example.com
   - Credits: $10000.00
   - Is Demo: false
   
   Token saved to localStorage.
   ```

### Step 4: Test Game
1. Click the **"→ Open Game"** link
2. Or navigate to: http://localhost:3000?debug=true
3. Open browser console (F12)

#### Expected Console Logs (Success):
```
✅ 🔐 Loading auth token from localStorage
✅ 🚩 Server mode enabled: true
✅ 🔍 Fetching initial server state...
✅ 💵 Balance display updated from server: $10000.00
✅ 🎮 Game initialized successfully
```

#### BAD Console Logs (Fix didn't work):
```
❌ 401 (Unauthorized)
❌ Authentication failed
❌ Connection lost - switching to demo mode
```

### Step 5: Play a Spin
1. Click the spin button
2. Watch console for balance updates
3. **Expected**:
   ```
   💵 Setting balance from server: [updated amount]
   💰 Server mode: Balance already updated by server
   ```
4. **Verify**: Balance in top-right updates correctly after winning

## 🐛 Troubleshooting

### Still getting 401 errors?

**Cause 1: Old session in database**
- Solution: Delete all sessions from database, then login again

**Cause 2: Browser cached old token**
- Solution: Clear localStorage (see Step 2)

**Cause 3: Server not restarted**
- Solution: Kill all node processes, restart server
  ```powershell
  taskkill /F /IM node.exe
  cd infinity-storm-server
  npm run dev
  ```

**Cause 4: Wrong database connection**
- Check `.env` file has correct database settings
- Server should connect to the same database as your Supabase local instance

### Balance not updating?

**Check console for**:
- "Server mode enabled: true" → ✅ Good
- "Server mode enabled: false" → ❌ Bad, check authToken

**Verify server response**:
- Should see "💵 Setting balance from server: [amount]"
- If you see "Using client-side balance calculation for demo mode" → Server didn't send balance

### Game switches to demo mode?

**Possible causes**:
1. Server not running
2. authToken missing/invalid
3. 401 error during game-state fetch

**Solution**:
1. Check server is running: http://localhost:3000/health
2. Clear localStorage and login again
3. Check browser console for errors

## ✅ Success Criteria

After following all steps, you should have:

- [x] Server running with fixed code
- [ ] Old sessions cleared from database
- [ ] Browser localStorage cleared
- [ ] Fresh login successful (no 401)
- [ ] Game loads in server mode (not demo)
- [ ] Balance loads from server
- [ ] Balance updates after spins
- [ ] No 401 errors in console

## 📊 Verification Commands

### Check localStorage (Browser Console):
```javascript
console.log('Token:', localStorage.getItem('authToken') ? 'Present ✅' : 'Missing ❌');
console.log('Player ID:', localStorage.getItem('playerId'));
```

### Check Game State (After Game Loads):
```javascript
const scene = window.game?.scene?.scenes[0];
console.log('Server Mode:', scene?.serverMode ? '✅' : '❌');
console.log('Demo Mode:', scene?.demoMode ? '⚠️' : '✅');
console.log('Balance:', scene?.stateManager?.gameData?.balance);
```

### Expected Output:
```
Token: Present ✅
Player ID: 2666b007-37a6-41b3-b5af-e7ed4563dc72
Server Mode: ✅
Demo Mode: ✅
Balance: 10000
```

## 🔄 If All Else Fails

1. **Nuclear option - Start completely fresh**:
   ```powershell
   # Kill server
   taskkill /F /IM node.exe
   
   # Clear browser
   # Open dev console (F12):
   # localStorage.clear(); location.reload();
   ```

2. **Delete and recreate test player**:
   ```powershell
   cd infinity-storm-server
   node reset-test-player.js
   ```

3. **Clear all sessions from database**:
   - Use Supabase dashboard
   - Or SQL: `DELETE FROM sessions;`

4. **Restart server**:
   ```powershell
   cd infinity-storm-server
   npm run dev
   ```

5. **Try login again**: http://localhost:3000/test-player-login.html

## 📝 Files Modified

1. **`infinity-storm-server/src/controllers/auth.js`**
   - Added `crypto` import
   - Changed token hashing from `bcrypt` to `SHA256` in `register()` and `login()`
   - Added `is_demo` field to API responses

2. **`src/scenes/GameScene.js`**
   - Fixed balance update logic for server vs demo mode
   - Added `lastServerBalanceUpdate` tracking
   - Fixed double-balance-addition bug

3. **`src/renderer/GridRenderer.js`**
   - Fixed field name aliases for `initialGrid` and `finalGrid`

4. **`test-player-login.html`**
   - Added CORS error prevention
   - Added auto-redirect for `file://` protocol

## 🎯 Next Steps After Fix Confirmed

Once you confirm the fix is working:

1. Test multiple spins to ensure consistent behavior
2. Test free spins mode
3. Test logout/login cycle
4. Consider adding automated tests for token hashing
5. Update documentation

## 🚨 Important Notes

- **DO NOT** commit `.env` file with credentials
- **DO** update `.env.example` if you change database settings
- The fix is **backward incompatible** - all old sessions are invalid
- Users will need to login again after deploying this fix

---

## Ready to Test! 🎮

Follow the steps above in order. Report results:
- ✅ If everything works
- ❌ If you see 401 errors (include console logs)
- ⚠️ If balance doesn't update (include console logs)

Good luck! 🍀

