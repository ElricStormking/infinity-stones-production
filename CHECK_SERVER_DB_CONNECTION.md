# Check Server Database Connection

## Current Status

The server has been restarted with new database configuration:
- DB_HOST=127.0.0.1
- DB_PORT=54322  
- DB_NAME=postgres
- DB_PASSWORD=postgres

## Problem

Login works, but session validation fails with 401.

## Diagnosis

Testing shows:
- Supabase (54322): 1 session (old session, not updated after recent login)
- Other DB (5439): 0 sessions

This suggests the login might be creating sessions in a different database OR the server didn't fully reload the .env.

## Next Steps to Test

### 1. Login via Browser
1. Go to: http://localhost:3000/test-player-login.html
2. Clear localStorage first:
   ```javascript
   localStorage.clear();
   ```
3. Click "Login as Test Player"
4. Check which database gets a new session

### 2. Manual Database Check

After login, run in terminal:
```powershell
cd d:\infinity-gauntlet\infinity-storm-server
node test-db-connections.js
```

Look for which database has **2 sessions** (the old one + new one).

### 3. If Sessions Are Still in Wrong DB

The server might have cached the old DB connection. Try:
1. Kill all node processes: `taskkill /F /IM node.exe`
2. Wait 5 seconds
3. Restart server: `cd d:\infinity-gauntlet\infinity-storm-server && npm run dev`
4. Wait 5 seconds
5. Try login again

### 4. Check Server Logs

Look for database connection messages in server console.
Should show: "Connected to postgres at 127.0.0.1:54322"

## Quick Test

**Just do this**:
1. Clear localStorage
2. Login at http://localhost:3000/test-player-login.html
3. **Check the console** for any 401 errors
4. If no errors → ✅ FIXED!
5. If still 401 → run `node test-db-connections.js` to see where sessions are

## Expected Result After Fix

```
Login Success! ✅
Open Game → No 401 errors ✅
Balance updates correctly ✅
```

