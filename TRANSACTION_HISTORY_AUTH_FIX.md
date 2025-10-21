# Transaction History Authentication Fix

## Problem

The Transaction History UI was showing **demo player's spins for all logged-in users** instead of showing each player's own spin history.

### Symptoms:
- ✅ Player ID displayed in UI
- ❌ **Wrong player ID** - showed demo-player UUID for all users
- ❌ All authenticated players saw the same transaction history
- ❌ Supabase `spin_results` table had correct player_id, but UI showed wrong data

### Root Cause:
The `/api/history/spins` endpoint was manually trying to decode JWT tokens, failing, and falling back to demo player:

```javascript
// OLD CODE - Manual JWT parsing (unreliable)
try {
  const decoded = jwt.verify(token, jwtSecret);
  playerId = decoded.player_id;
} catch (e) {
  // Falls back to demo player on ANY error
  playerId = demoPlayer.id;
}
```

**Issues:**
1. Manual JWT verification prone to errors
2. Wrong JWT secret or token format causes silent fallback
3. No proper auth middleware validation
4. Always returned demo player data on auth failure

---

## Solution

### 1. **Implemented Authenticated Endpoint** (`/api/spin-history`)

**File**: `infinity-storm-server/src/routes/api.js`

```javascript
router.get('/spin-history',
  demoAuthBypass,        // Allow demo mode for testing
  authenticate,          // Validate JWT and populate req.user
  requireActivePlayer,   // Ensure active player status
  async (req, res) => {
    // Get authenticated player ID from middleware
    const playerId = req.user.id;  // ✅ Guaranteed to be correct player
    
    // Fetch ONLY this player's history
    const result = await getSpinHistory(playerId, limit, offset, order);
    
    res.json({ success: true, data: rows });
  }
);
```

**Benefits:**
- ✅ Uses battle-tested auth middleware
- ✅ `req.user.id` is populated by JWT validation
- ✅ Automatic token verification with correct secret
- ✅ Each player sees only their own spins

---

### 2. **Updated Client to Use Authenticated Endpoint**

**File**: `src/services/NetworkService.js`

```javascript
async getSpinHistory(page = 1, limit = 200, order = 'desc') {
    const cappedLimit = Math.min(Math.max(1, limit || 200), 200);
    const offset = (Math.max(1, page || 1) - 1) * cappedLimit;
    const p = new URLSearchParams();
    p.append('limit', String(cappedLimit));
    p.append('offset', String(offset));
    return this.get(`/api/spin-history?${p.toString()}`);  // ✅ New authenticated endpoint
}
```

**Changes:**
- ✅ Changed from `/api/history/spins` → `/api/spin-history`
- ✅ Convert page-based to offset-based pagination
- ✅ Automatically includes `Authorization: Bearer <token>` header via axios interceptor

---

### 3. **Deprecated Legacy Endpoint**

**File**: `infinity-storm-server/server.js`

```javascript
// DEPRECATED: Returns 410 Gone
app.get('/api/history/spins', async (req, res) => {
  res.status(410).json({ 
    success: false, 
    error: 'ENDPOINT_DEPRECATED', 
    message: 'This endpoint is deprecated. Please use /api/spin-history with authentication.'
  });
});
```

---

## Testing

### Before Fix:
```
Player: qaplayer12 (logged in)
Transaction History UI shows:
- Player ID: f9b42f9d-4...d59a8c2441 (demo-player)  ❌ Wrong!
- All spins from demo player
```

### After Fix:
```
Player: qaplayer12 (logged in)
Transaction History UI shows:
- Player ID: f9b42f9d-423a-4d39-9a4a-00d5...  ✅ Correct!
- Only qaplayer12's spins

Player: testplayer (logged in)
Transaction History UI shows:
- Player ID: 4ecbebca-e6fd-4303-b744-3440...  ✅ Correct!
- Only testplayer's spins
```

---

## How to Test

1. **Restart server** (to load new endpoint)
   ```bash
   cd infinity-storm-server
   node server.js
   ```

2. **Log in as Player 1** (`qaplayer12`)
   - Open: http://localhost:3000/test-player-login.html
   - Login with credentials
   - Open game → Options → Transaction History
   - Verify: Player ID matches your logged-in account
   - Verify: Only sees their own spins

3. **Log in as Player 2** (different account)
   - Repeat above steps
   - Verify: Different Player ID
   - Verify: Sees different transaction history

4. **Check Supabase**
   - Open `spin_results` table
   - Verify: `player_id` in table matches Player ID in UI

---

## Technical Details

### Auth Flow:

```
Client Request
    ↓
NetworkService.get('/api/spin-history')
    ↓ (adds Authorization header via axios interceptor)
POST /api/spin-history
    ↓
authenticate middleware (src/middleware/auth.js)
    ↓ (validates JWT, populates req.user)
req.user.id = '4ecbebca-e6fd-4303-b744-3440...'
    ↓
getSpinHistory(req.user.id, limit, offset)
    ↓
Supabase: SELECT * FROM spin_results WHERE player_id = req.user.id
    ↓
Response: { data: [ /* only this player's spins */ ] }
```

### Pagination:

**Old (page-based):**
```
page=1, limit=200 → fetches rows 0-199
page=2, limit=200 → fetches rows 200-399
```

**New (offset-based):**
```
offset=0, limit=200 → fetches rows 0-199
offset=200, limit=200 → fetches rows 200-399
```

Client converts: `offset = (page - 1) * limit`

---

## Files Modified

1. ✅ `infinity-storm-server/src/routes/api.js` - Implement `/api/spin-history`
2. ✅ `src/services/NetworkService.js` - Update client to use new endpoint
3. ✅ `infinity-storm-server/server.js` - Deprecate legacy endpoint

---

## Commit

**Commit**: `18cd172`  
**GitHub**: https://github.com/ElricStormking/infinity-stones

**Message**:
> fix: transaction history now shows logged-in player's spins instead of demo player
> - Implement /api/spin-history with proper auth middleware (uses req.user.id from JWT)
> - Update client to use /api/spin-history instead of /api/history/spins
> - Deprecate legacy /api/history/spins endpoint (410 Gone)
> - Convert page-based pagination to offset-based for authenticated endpoint
> - Each player now sees only their own spin history with correct player_id

---

## Summary

✅ **Fixed**: Each authenticated player now sees only their own transaction history  
✅ **Fixed**: Player ID in UI matches the logged-in player's ID  
✅ **Fixed**: Data consistency between UI and Supabase database  
✅ **Improved**: Using battle-tested auth middleware instead of manual JWT parsing  
✅ **Improved**: Proper separation of concerns (auth handled by middleware layer)

