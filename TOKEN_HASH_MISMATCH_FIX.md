# Token Hash Mismatch Fix - Authentication Bug

## Critical Bug Found! 🐛

### Issue
Test player login was successful, token was saved, but every API request returned **401 Unauthorized**. The game immediately switched to demo mode.

### Root Cause
**Token hashing mismatch between login and validation!**

#### Login Method (auth.js)
```javascript
// Line 679 - OLD (WRONG)
await bcrypt.hash(token, 5)  // Stored token with BCRYPT hash
```

#### Validation Method (Session.js)
```javascript
// Line 297 - What SessionManager expects
crypto.createHash('sha256').update(token).digest('hex')  // Looks for SHA256 hash
```

### The Problem
1. **Login** stores token hash using **bcrypt**
2. **Validation** looks up token hash using **SHA256**
3. Hashes don't match → Session not found → 401 Unauthorized!

### Example
```javascript
// Login stores:
token: "eyJhbGciOiJIUz..."
token_hash: "$2b$05$..." // bcrypt hash

// Validation searches for:
token: "eyJhbGciOiJIUz..."
token_hash: "a3f2b8c..." // SHA256 hash

// NO MATCH! → 401 Unauthorized
```

## The Fix

### Changed Files
**File:** `infinity-storm-server/src/controllers/auth.js`

### Changes Made

#### 1. Added crypto import (Line 15)
```javascript
const crypto = require('crypto');
```

#### 2. Fixed register() method (Line 557)
```javascript
// OLD - WRONG
await bcrypt.hash(token, 5)

// NEW - CORRECT
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

#### 3. Fixed login() method (Line 682)
```javascript
// OLD - WRONG
await bcrypt.hash(token, 5)

// NEW - CORRECT
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

### Why This Works

Now both methods use the same hashing algorithm (SHA256):

**Login:**
```javascript
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
// Store: token_hash = "a3f2b8c9..."
```

**Validation (Session.findByToken):**
```javascript
const token_hash = Session.generateTokenHash(token);
// Look for: token_hash = "a3f2b8c9..."
// ✅ MATCH!
```

## Testing Steps

### 1. CRITICAL: Clear Old Sessions
The old sessions in the database have **bcrypt** hashes and won't work. You must:

```sql
-- Clear all sessions (run on server if needed)
DELETE FROM sessions;
```

OR use the reset script:
```bash
cd infinity-storm-server
node reset-test-player.js
```

### 2. Restart Server (REQUIRED!)
```powershell
cd infinity-storm-server
# Stop server (Ctrl+C)
npm run dev
```

### 3. Clear Browser Storage
```javascript
// Browser console (F12)
localStorage.clear();
```

### 4. Fresh Login
1. Go to: `http://localhost:3000/test-player-login.html`
2. Click "Login as Test Player"
3. **Verify:** "Login Successful!" with token saved

### 5. Test Game
1. Open: `http://localhost:3000/`
2. **Watch console - should see:**
   ```
   🔐 Loading auth token from localStorage
   🚩 Server mode enabled: true
   🔍 Fetching initial server state...
   ✅ Balance display updated from server: $10000.00
   ```
3. **Should NOT see:**
   ```
   ❌ 401 (Unauthorized)
   ❌ Authentication error
   ❌ Connection lost - switching to demo mode
   ```

## Expected Behavior

### Before Fix (BROKEN):
```
1. Login → Token saved (bcrypt hash)
2. Game loads → Sends token
3. Server validates → Uses SHA256 hash lookup
4. Hash mismatch → 401 Unauthorized
5. Game switches to demo mode ❌
```

### After Fix (WORKING):
```
1. Login → Token saved (SHA256 hash) ✅
2. Game loads → Sends token ✅
3. Server validates → Uses SHA256 hash lookup ✅
4. Hash matches → Session found ✅
5. Request authorized → Balance updates from server ✅
```

## Verification Checklist

✅ **Server-side:**
- [ ] Crypto imported at top of auth.js
- [ ] Register uses SHA256 hash
- [ ] Login uses SHA256 hash
- [ ] Server restarted with new code

✅ **Client-side:**
- [ ] localStorage cleared
- [ ] Fresh login completed
- [ ] Token saved successfully
- [ ] No 401 errors in console
- [ ] Balance loads from server
- [ ] Game stays in server mode

✅ **Gameplay:**
- [ ] Can place bets
- [ ] Balance updates correctly
- [ ] Wins are credited
- [ ] No demo mode switch

## Impact

### Before
- ❌ Authentication always failed
- ❌ Game always in demo mode
- ❌ Balance never updated from server
- ❌ Real player testing impossible

### After
- ✅ Authentication works
- ✅ Server mode functions
- ✅ Balance syncs from server
- ✅ Real player testing possible

## Technical Details

### SHA256 vs Bcrypt

**Why SHA256 for token hashing?**
- Fast lookup (session validation happens on every request)
- Deterministic (same token → same hash)
- Not for password security (tokens are already JWTs)

**Why Bcrypt for passwords?**
- Slow computation (prevents brute force)
- Random salts (same password → different hashes)
- For password security only

**The bug:** Used bcrypt for token hashing (wrong tool for the job!)

### Session Model Design
```javascript
// Session.js - The authoritative method
static generateTokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Used by:
- Session.createSession()
- Session.findByToken()
- Session.refresh()
- SessionManager.validateSession()
```

### Auth Controller (Fixed)
```javascript
// Now matches Session model
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

## Related Files

### Modified:
- `infinity-storm-server/src/controllers/auth.js`
  - Added crypto import
  - Fixed register() token hash
  - Fixed login() token hash

### Reference:
- `infinity-storm-server/src/models/Session.js`
  - Line 296-298: `generateTokenHash()` method
  - Line 399-418: `findByToken()` method
  - Line 376-391: `createSession()` method

- `infinity-storm-server/src/auth/sessionManager.js`
  - Line 130-200: `validateSession()` method
  - Uses Session.findByToken() internally

## Common Issues

### Issue: Still getting 401 after fix
**Cause:** Old sessions in database with bcrypt hashes  
**Fix:** Clear sessions table or reset test player

### Issue: Token not found in database
**Cause:** Session wasn't created during login  
**Fix:** Check server logs for login errors

### Issue: Multiple 401 errors
**Cause:** Multiple requests using old token  
**Fix:** Clear localStorage and fresh login

## Prevention

### Code Review Checklist:
- [ ] All token storage uses `Session.generateTokenHash()`
- [ ] No bcrypt for non-password hashing
- [ ] Session model is source of truth for token hashing
- [ ] Integration tests for auth flow

### Best Practice:
```javascript
// GOOD ✅
const Session = require('../models/Session');
const tokenHash = Session.generateTokenHash(token);

// BAD ❌
const tokenHash = await bcrypt.hash(token, 5);
const tokenHash = someCustomHash(token);
```

## Success Criteria

✅ Login creates session with SHA256 hash  
✅ Token validation finds session using SHA256 hash  
✅ API requests return 200 (not 401)  
✅ Game stays in server mode  
✅ Balance updates from server  
✅ Real player testing works  

---

**Status:** ✅ **FIXED**  
**Date:** October 14, 2025  
**Severity:** Critical (P0)  
**Impact:** Blocks all authenticated gameplay  

**Action Required:**
1. Restart server
2. Clear browser localStorage
3. Fresh login
4. Test gameplay

**Expected Result:** Authentication works, balance updates correctly! 🎉

