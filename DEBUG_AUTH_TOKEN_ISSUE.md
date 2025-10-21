# Authentication Token Not Loading - Debug Steps

**Problem:** Server logs show requests going to `/api/demo-spin` instead of `/api/spin`, meaning the game doesn't have the auth token.

## Immediate Fix - Please Follow These Steps:

### Step 1: Clear Everything
```javascript
// Open browser console (F12) and run:
localStorage.clear();
sessionStorage.clear();
```

### Step 2: Re-login
1. Go to: `http://localhost:3000/test-player-login.html`
2. Login as `qa_manual_01` with password `PortalTest!234`
3. Confirm you see "✅ Login Successful!"
4. **DO NOT click "Open Game" yet**

### Step 3: Verify Token is Saved
```javascript
// In browser console, check:
localStorage.getItem('infinity_storm_token')
// Should return a long JWT string starting with "eyJ..."
```

### Step 4: Open Game in SAME Tab
1. In the SAME browser tab where you logged in
2. Navigate to: `http://localhost:3000/` 
3. **DO NOT open in new tab** - use the same tab

### Step 5: Check Token is Loaded in Game
```javascript
// Open console (F12) in the game and run:
window.NetworkService.authToken
// Should return the JWT token (not null)

window.NetworkService.isDemoMode()
// Should return: false

// Check localStorage again:
localStorage.getItem('infinity_storm_token')
// Should still have the token
```

### Step 6: Make a Test Spin
1. Spin once
2. Check console for network request
3. Should see POST to `/api/spin` (NOT `/api/demo-spin`)

### Step 7: Verify in Supabase
Check spin_results table - latest spin should have player_id: `5fb15696-5f9f-4d2d-a5aa-bb8a03e9ebb3`

---

## If Token Still Not Loading:

There might be a **timing issue** where NetworkService initializes before the token is saved. Let me add a manual token setter:

### Manual Fix:
After logging in and BEFORE opening the game, run in console:
```javascript
// Save token manually
const token = "PASTE_YOUR_TOKEN_HERE";
localStorage.setItem('infinity_storm_token', token);
```

Then open the game.

---

## What's Happening:

1. **Login saves token** → `localStorage['infinity_storm_token'] = "eyJ..."`
2. **Game loads** → `NetworkService` constructor runs → calls `initializeAuth()`
3. **initializeAuth()** → reads `localStorage['infinity_storm_token']` → sets `this.authToken`
4. **If token exists** → calls `/api/spin` (authenticated)
5. **If token is null** → calls `/api/demo-spin` (demo mode)

Currently, step 3-4 is failing, meaning the token isn't being loaded when the game initializes.

---

## Alternative: Force Token Reload

Add this to browser console AFTER game loads:
```javascript
const token = localStorage.getItem('infinity_storm_token');
if (token) {
    window.NetworkService.setAuthToken(token);
    console.log('✅ Token manually loaded');
} else {
    console.error('❌ No token in localStorage!');
}
```

Then try spinning again.

