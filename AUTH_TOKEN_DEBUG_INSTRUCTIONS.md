# Auth Token Debug Instructions

## I've added debug logging to help identify the issue.

### Step 1: Hard Refresh Browser
Press `Ctrl + Shift + R` to clear cached JavaScript files

### Step 2: Clear LocalStorage
Open browser console (F12) and run:
```javascript
localStorage.clear();
sessionStorage.clear();
```

### Step 3: Re-login
1. Go to: http://localhost:3000/test-player-login.html
2. Login as `qa_manual_01` / `PortalTest!234`
3. **Stay on this page** - don't navigate yet

### Step 4: Verify Token Saved
In console:
```javascript
localStorage.getItem('infinity_storm_token')
// Should return a long JWT string
```

### Step 5: Open Game and Watch Console
Navigate to http://localhost:3000/ and watch the console output. You should see:

```
🔐 NetworkService.initializeAuth: Checking localStorage['infinity_storm_token']
✅ Auth token loaded from localStorage: eyJhbGci...
```

If you see:
```
❌ No auth token found in localStorage - will use demo mode
```

Then the token isn't in localStorage when the game loads!

### Step 6: Test a Spin
Make a spin and check console for:
```
🔐 NetworkService.processSpin: authToken=EXISTS, isDemoSession=false, endpoint=/api/spin
```

If it says `authToken=NULL, isDemoSession=true, endpoint=/api/demo-spin`, the token is still not loaded!

### Step 7: Manual Fix (if needed)
If the token still isn't loading, manually set it after the game loads:

```javascript
// Get the token first
const token = localStorage.getItem('infinity_storm_token');
console.log('Token in storage:', token ? 'YES' : 'NO');

// Manually set it
if (token) {
    window.NetworkService.setAuthToken(token);
    console.log('Token manually set!');
} else {
    console.error('No token in localStorage to set!');
}
```

Then try spinning again.

### Expected Result:
- Console shows: `authToken=EXISTS`
- Endpoint used: `/api/spin` (NOT `/api/demo-spin`)
- Supabase spin_results shows YOUR player_id: `5fb15696-5f9f-4d2d-a5aa-bb8a03e9ebb3`

---

## Please share the console output so I can see what's happening!

