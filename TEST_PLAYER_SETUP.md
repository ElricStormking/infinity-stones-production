# Test Player Setup Guide

## Purpose
Test client-server balance synchronization with a **real player account** (not demo mode).

## Problem
- Demo mode players receive `balance: null` from server
- This prevents testing server-authoritative balance updates
- We need a real player account where `is_demo: false`

## Solution: Use the Test Player Login Page

### Step 1: Start the Server
```powershell
cd infinity-storm-server
npm run dev
```

### Step 2: Open Test Player Login Page
**IMPORTANT:** Do NOT open the file directly! Use the server URL to avoid CORS errors.

1. Open in browser: **http://localhost:3000/test-player-login.html**
2. Click **"Register & Login (First Time)"** button
3. This will:
   - Create account: username=`testplayer`, password=`test123`
   - Login and save token to localStorage
   - Display player info

> ⚠️ **DO NOT** open `file://` directly - it will cause CORS errors!  
> ✅ **DO** use `http://localhost:3000/test-player-login.html`

### Step 3: Open the Game
1. After successful login, click the **"→ Open Game"** link
2. Or manually open: `http://localhost:3000?debug=true`
3. The game will automatically use the test player account

## Test Credentials
- **Username:** `testplayer`
- **Password:** `test123`
- **Email:** `test@player.com`
- **Starting Credits:** $1000.00 (set by server)
- **Is Demo:** `false` (real player)

## How It Works

### Real Player (is_demo: false)
```javascript
// Server sends actual balance
{
  balance: 4998.70,  // Real balance value
  totalWin: 1.30,
  // ...
}

// Client receives and sets balance
this.stateManager.setBalanceFromServer(4998.70);
this.lastServerBalanceUpdate = 4998.70; // NOT null

// In endSpin(), client sees server sent balance, skips local addition
if (serverSentBalance) {
  // ✅ Server already updated balance
  this.updateBalanceDisplay();
}
```

### Demo Player (is_demo: true)
```javascript
// Server sends null balance
{
  balance: null,  // Demo mode
  totalWin: 1.30,
  // ...
}

// Client receives null
this.lastServerBalanceUpdate = null;

// In endSpin(), client handles balance locally
if (!serverSentBalance) {
  // ✅ Client adds win locally
  this.stateManager.addWin(this.totalWin);
}
```

## Verification

### Check in Browser Console
```javascript
// After login
console.log(localStorage.getItem('authToken')); // Should show token

// During gameplay
// Look for console logs:
// "💵 Setting balance from server: 4998.70"  ← Server sent real balance
// "💰 Server mode: Balance already updated by server..."  ← Correct flow
```

### Check in Debug Panel
The server debug panel (right side) should show:
- **Server response** with real balance value (not null)
- **Balance updates** after each spin

## Troubleshooting

### If registration fails (500 error)
The database might not be set up. Options:
1. **Use Supabase (if Docker is running):**
   ```powershell
   cd infinity-storm-server
   supabase start
   npm run dev
   ```

2. **Use in-memory mode:**
   Check if server has in-memory player storage enabled

### If balance still doesn't update
1. Check browser console for errors
2. Verify `is_demo: false` in login response
3. Check server logs for balance calculation
4. Ensure `lastServerBalanceUpdate` is being set (not null)

## Quick Test

1. Open `test-player-login.html`
2. Click "Register & Login"
3. Open game
4. Place a bet and win
5. Check balance updates in UI
6. **Expected:** Balance = (previous balance - bet + win)

## Files
- `test-player-login.html` - Login page with test account
- `test-server-connection.js` - Script to test server and create account
- `TEST_PLAYER_SETUP.md` - This guide

