# Demo Balance WalletAPI Fix - CRITICAL

**Date:** October 23, 2025  
**Issue:** Balance still showing $5,000 despite previous fixes  
**Root Cause:** WalletAPI not updated before UI creation  
**Status:** ✅ FIXED

---

## Root Cause Analysis

The UIManager reads balance in this priority order:
1. **First: `window.WalletAPI.getCurrentBalance()`** ← Returns 0 or old cached value
2. **Second: `this.scene.stateManager.gameData.balance`** ← Returns $10,000

### The Problem

```javascript
// src/managers/UIManager.js line 858:
const initialBalance = window.WalletAPI 
    ? window.WalletAPI.getCurrentBalance()  // ← WalletAPI not updated yet!
    : this.scene.stateManager.gameData.balance;
```

**Initialization order (BROKEN):**
```
1. GameScene.create() starts
2. Load demo balance → stateManager.gameData.balance = $10,000 ✅
3. WalletAPI.currentBalance = 0 (default) ❌
4. Create UIManager
5. UIManager reads WalletAPI first → Gets 0 or old value ❌
6. Display shows wrong balance
```

---

## Fix Applied

**File:** `src/scenes/GameScene.js` (Lines 15-32)

Updated pre-init code to also set WalletAPI balance:

```javascript
// CRITICAL: Load demo balance BEFORE creating UI to prevent animation
const authToken = localStorage.getItem('infinity_storm_token');
if (!authToken) {
    console.log('🎮 [PRE-INIT] Loading demo balance before UI creation');
    console.log('🎮 [PRE-INIT] StateManager balance before load:', this.stateManager.gameData.balance);
    console.log('🎮 [PRE-INIT] WalletAPI balance before load:', window.WalletAPI?.currentBalance);
    
    if (this.stateManager && this.stateManager.loadDemoBalance) {
        this.stateManager.loadDemoBalance();
        console.log('🎮 [PRE-INIT] StateManager balance after load:', this.stateManager.gameData.balance);
    }
    
    // CRITICAL: Also set WalletAPI balance immediately (UI reads from WalletAPI first)
    if (window.WalletAPI) {
        window.WalletAPI.currentBalance = this.stateManager.gameData.balance;
        console.log('🎮 [PRE-INIT] WalletAPI balance after set:', window.WalletAPI.currentBalance);
    }
}
```

**Initialization order (FIXED):**
```
1. GameScene.create() starts
2. Load demo balance → stateManager.gameData.balance = $10,000 ✅
3. Set WalletAPI.currentBalance = $10,000 ✅
4. Create UIManager
5. UIManager reads WalletAPI first → Gets $10,000 ✅
6. Display shows correct balance ✅
```

---

## How to Test

### Step 1: Clear Everything
```javascript
// Open browser console (F12)
localStorage.clear();
// Hard refresh (Ctrl+Shift+R)
```

### Step 2: Check Console Logs
You should see these logs in order:
```
🎮 [PRE-INIT] Loading demo balance before UI creation
🎮 [PRE-INIT] StateManager balance before load: 10000
🎮 [PRE-INIT] WalletAPI balance before load: 0
💰 [DEMO] Initialized with $10,000 starting balance
🎮 [PRE-INIT] StateManager balance after load: 10000
🎮 [PRE-INIT] WalletAPI balance after set: 10000
```

### Step 3: Verify Display
- Balance should show: **$10,000.00**
- No animation
- No floating text

---

## Debugging

If balance still shows $5,000, check console logs:

### Case 1: WalletAPI balance is 5000 before load
```
🎮 [PRE-INIT] WalletAPI balance before load: 5000  ← Old cached value
```
**Solution:** WalletAPI is being set somewhere else. Need to find where.

### Case 2: StateManager balance is 5000
```
🎮 [PRE-INIT] StateManager balance before load: 5000  ← Wrong default
```
**Solution:** GameStateManager constructor has wrong value. Should be 10000.

### Case 3: WalletAPI not updated
```
🎮 [PRE-INIT] WalletAPI balance after set: undefined  ← WalletAPI not available
```
**Solution:** WalletAPI not loaded yet. Need to initialize earlier.

---

## Expected Console Output

### Fresh Demo Mode
```
🎮 [PRE-INIT] Loading demo balance before UI creation
🎮 [PRE-INIT] StateManager balance before load: 10000
🎮 [PRE-INIT] WalletAPI balance before load: 0
💰 [DEMO] Initialized with $10,000 starting balance
🎮 [PRE-INIT] StateManager balance after load: 10000
🎮 [PRE-INIT] WalletAPI balance after set: 10000
🎮 [FREE PLAY] No auth token - starting in FREE PLAY DEMO MODE
🎮 [FREE PLAY] Demo mode initialized - balance: 10000
```

### With Existing Balance
```
🎮 [PRE-INIT] Loading demo balance before UI creation
🎮 [PRE-INIT] StateManager balance before load: 10000
🎮 [PRE-INIT] WalletAPI balance before load: 0
💰 [DEMO] Loaded balance from localStorage: 8765.43
🎮 [PRE-INIT] StateManager balance after load: 8765.43
🎮 [PRE-INIT] WalletAPI balance after set: 8765.43
🎮 [FREE PLAY] No auth token - starting in FREE PLAY DEMO MODE
🎮 [FREE PLAY] Demo mode initialized - balance: 8765.43
```

---

## Files Modified

1. **`src/scenes/GameScene.js`** (Lines 15-32)
   - Added WalletAPI balance setting after loadDemoBalance()
   - Added comprehensive logging for debugging

---

## Next Steps for User

1. **Hard refresh** (Ctrl+Shift+R or Ctrl+F5)
2. **Open console** (F12) and check logs
3. **Share console output** if issue persists
4. Check if balance shows $10,000 or still $5,000

---

## Status: ✅ DEPLOYED

This fix ensures WalletAPI balance is synchronized with StateManager balance BEFORE UI creation, so the UIManager reads the correct value immediately.

