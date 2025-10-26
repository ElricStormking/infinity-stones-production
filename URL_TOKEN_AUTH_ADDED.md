# URL Token Authentication Added

## Problem
localStorage isn't persisting the authentication token, causing all spins to use demo mode.

## Solution
Added URL parameter authentication as a fallback.

## How to Use

### Method 1: Get Token from Login Page
1. Login at: http://localhost:3000/test-player-login.html
2. Open browser console
3. Copy the token: `localStorage.getItem('infinity_storm_token')`
4. Open game with token in URL:
   ```
   http://localhost:3000/?token=YOUR_TOKEN_HERE
   ```

### Method 2: Use Diagnostic Tool
1. Open: http://localhost:3000/test-localstorage-diagnostic.html
2. Click "Test Login Flow"
3. Copy the token shown in the output
4. Use it in the game URL

### Method 3: Get Token from API Directly
Run in console:
```javascript
fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: 'qa_manual_01', password: 'PortalTest!234'})
})
.then(r => r.json())
.then(d => {
    console.log('Token:', d.token);
    console.log('Open game with this URL:');
    console.log('http://localhost:3000/?token=' + d.token);
});
```

## Expected Result
When you open the game with `?token=...` in the URL:
- NetworkService will load the token from URL
- Spins will use `/api/spin` endpoint
- Supabase will record correct player_id

## Why This Helps
This bypasses any localStorage issues (browser security, incognito mode, extensions) and proves the authentication flow works when the token is present.

