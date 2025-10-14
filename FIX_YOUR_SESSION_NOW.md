# Fix Your Session - Quick Guide

## 🔴 Your Current Problem

Looking at your console, you have **401 Authentication errors**:
- "Authentication error, clearing session..."
- "Connection lost - switching to demo mode"

Your session expired, so the game switched to demo mode, where the balance wasn't updating.

## ✅ Two Fixes Applied

### Fix 1: Authentication (Previous)
- All token hashing uses SHA256 ✅

### Fix 2: Demo Mode Balance (Just Now)
- Balance now updates in demo mode ✅

## 🎯 What You Need to Do

### Option A: Login Again (Recommended)
Get back to **real** server mode with persistent balance:

1. **Go to login page**: http://localhost:3000/test-player-login.html
2. **Click**: "Login as Test Player"  
3. **Open game**: http://localhost:3000?debug=true
4. **Play**: Balance will update correctly in server mode ✅

### Option B: Test Demo Mode (Just to verify fix)
Stay in demo mode to verify the balance fix works:

1. **Hard refresh**: Ctrl + Shift + R
2. **Play spins**: Balance should update now ✅

## 🧪 Quick Test

After refresh, check console for:

**Server Mode** (after login):
```
💵 Setting balance from server: [amount]
💰 [WalletAPI] Balance set: $X → $Y
```

**Demo Mode** (no login):
```
💰 Placed bet locally: { before: 10000, bet: 1, after: 9999 }
💰 [WalletAPI] Balance set: $10,000.00 → $9,999.00
💰 Client mode: Added win to balance: { ... }
```

## ⚡ Fastest Fix

**Just do this**:
```
1. Ctrl + Shift + R (hard refresh)
2. Play a spin
3. Balance should update now!
```

If you want persistent balance tracking:
```
4. Go to: http://localhost:3000/test-player-login.html
5. Click: "Login as Test Player"
6. Play game with real balance tracking
```

## 🎉 Expected Result

**Before** (Broken):
- Win $8.10
- Balance: $5000.00 (unchanged) ❌

**After** (Fixed):
- Win $8.10  
- Balance: $5008.10 (updated!) ✅

Both server mode AND demo mode work now!

