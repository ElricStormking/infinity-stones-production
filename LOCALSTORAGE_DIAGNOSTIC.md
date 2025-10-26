# LocalStorage Diagnostic Plan

## Problem
Token is saved on login page but NOT found when game loads, even though they're on the same domain.

## Diagnostic Steps

### Step 1: Verify Token Saves on Login Page
1. Open browser console (F12)
2. Go to `http://localhost:3000/test-player-login.html`
3. **Before logging in**, run in console:
   ```javascript
   localStorage.clear();
   console.log('LocalStorage cleared');
   ```
4. Login as `qa_manual_01`
5. Check console for verification message
6. **Stay on login page**, run in console:
   ```javascript
   console.log('Token in storage:', localStorage.getItem('infinity_storm_token'));
   console.log('All keys:', Object.keys(localStorage));
   ```
   **Expected**: Should show the token!

### Step 2: Check Token Persistence After Navigation
7. **Do NOT close/refresh the tab**
8. In the **same tab**, manually navigate to: `http://localhost:3000/`
9. As soon as page loads, check console for my debug message
10. **Immediately** run in console:
   ```javascript
   console.log('Token after navigation:', localStorage.getItem('infinity_storm_token'));
   console.log('All keys after navigation:', Object.keys(localStorage));
   ```

### Step 3: Check Browser Settings
If token disappears:
- Check if you're in **Incognito/Private** browsing mode
- Check browser extensions (ad blockers, privacy tools) that might clear localStorage
- Check browser settings: Settings → Privacy → Cookies and site data
- Try a different browser (Edge, Firefox, etc.)

### Step 4: Manual Token Injection (Workaround)
If localStorage isn't working:
1. Login at `/test-player-login.html`
2. Copy the token from the success message
3. Navigate to game page
4. Open console immediately and run:
   ```javascript
   localStorage.setItem('infinity_storm_token', 'PASTE_TOKEN_HERE');
   location.reload();
   ```

### Step 5: Alternative - Use URL Parameter
If localStorage is completely broken, you can temporarily pass token via URL:
```
http://localhost:3000/?token=YOUR_TOKEN_HERE
```

## Please run Steps 1-3 and tell me what you see!

If the token EXISTS in Step 1 but DISAPPEARS in Step 2, it's a browser/security issue.
If the token persists in Step 2, then there's a bug in my code reading it.

