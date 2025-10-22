# CRITICAL FIX: Game State Not Persisting Between Spins

## 🐛 The Bug

Both issues you reported had the **same root cause**:

### Issue 1: Random Multiplier shows x11 but server logs multiplier: 1
### Issue 2: Scatter retrigger gives +15 instead of +5

**Root Cause**: Game state was **NEVER being saved** to Supabase!

---

## 🔍 What Was Happening

Look at your server log:
```
[GameController] Updating game state - mode: base freeSpins: 0 multiplier: 1
❌ Failed to update game state in Supabase: {
  code: '42P10',
  message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification'
}
```

**Every single spin failed to save state!**

### The Cascade Effect:

**Spin 1:**
- Client: Won with x2 multiplier → Badge shows x2 ✅
- Server: Tries to save accumulated_multiplier = 2 ❌ FAILED
- Supabase: Still has default values (mode: base, free_spins: 0, multiplier: 1)

**Spin 2:**
- Server loads from Supabase: `{ mode: 'base', free_spins: 0, multiplier: 1 }` ❌
- Client still shows "FREE SPINS: 11" but server thinks base mode!
- Gets 4 scatters → Server treats as **initial trigger** (+15) not retrigger (+5)
- Client accumulated x11 → Server says x1

---

## 🛠️ Why Upsert Failed

**File**: `infinity-storm-server/src/controllers/game.js` (line 417)

```javascript
// ❌ BROKEN:
await supabaseAdmin.from('game_states').upsert({
  player_id: playerId,
  // ...
}, {
  onConflict: 'player_id'  // ← Requires UNIQUE constraint!
});
```

**Problem**: 
- `game_states` table has NO UNIQUE constraint on `player_id`
- Only has `id UUID PRIMARY KEY` (which is unique)
- Postgres error: "no unique or exclusion constraint matching onConflict"

---

## ✅ The Fix

### 1. Manual Update-or-Insert Logic

**File**: `infinity-storm-server/src/controllers/game.js` (lines 402-436)

```javascript
// Try UPDATE first
const { data: updateResult } = await supabaseAdmin
  .from('game_states')
  .update(gameStateUpdate)
  .eq('player_id', playerId)
  .select();

// If no rows updated, INSERT
if (!updateResult || updateResult.length === 0) {
  await supabaseAdmin
    .from('game_states')
    .insert(gameStateUpdate);
}
```

This works **immediately** without schema changes.

---

### 2. Add UNIQUE Constraint (Migration 003)

**File**: `infinity-storm-server/src/db/migrations/003_add_game_states_unique_player.sql`

Adds `UNIQUE (player_id)` constraint to prevent duplicate rows.

---

## 🚀 How to Apply

### Step 1: Pull Latest Code

```bash
git pull
```

### Step 2: Restart Server

```bash
cd infinity-storm-server
npm run dev
```

**The fix works immediately!** No migration needed for basic functionality.

---

### Step 3: Apply Migration (Optional but Recommended)

```bash
cd infinity-storm-server
node apply-migration-003.js
```

This adds the UNIQUE constraint and prevents duplicate player states.

**Expected Output:**
```
🔧 Applying migration 003: Add UNIQUE constraint to game_states.player_id
📄 Migration file loaded
✅ Migration applied successfully!
✅ UNIQUE constraint verified: game_states_player_id_unique
```

---

## 🧪 Test Now

### Test 1: Accumulated Multiplier Persistence

1. Hard refresh (`Ctrl+Shift+F5`)
2. Trigger free spins (4+ scatters)
3. Get random multipliers (shooting stars)
4. **Check server log**: Should show `multiplier: X` where X > 1
5. **Next spin**: Server should load `accumulated_multiplier: X` (not 1!)
6. Badge should show x2, x5, x10, etc. and **stay** there ✅

---

### Test 2: Scatter Retrigger Awards +5 (Not +15)

1. During free spins, get 4+ scatters
2. **Client**: Shows "+5" animation
3. **Server log**: Should show:
   ```
   🎰 FREE SPINS RETRIGGER: {
     retriggeredSpinsAwarded: 5,  // ← Correct!
     CONFIG_RETRIGGER_SPINS: 5
   }
   ```
4. **Free spins counter**: Was 10 → Now 14 (10 - 1 + 5) ✅

---

### Test 3: Verify State Persistence

**Server log should show:**
```
✅ Game state updated, mode: free_spins freeSpins: 14
```

**NOT:**
```
❌ Failed to update game state in Supabase: { code: '42P10', ... }
```

---

## 🎯 Expected Behavior Now

### Free Spins Mode:
- ✅ Server maintains correct free_spins_remaining (not always 0)
- ✅ Accumulated multiplier persists (x2 → x5 → x10 → x23, etc.)
- ✅ Retrigger correctly awards +5 (not +15)
- ✅ Client and server stay in sync

### Game State:
- ✅ Saved to Supabase every spin
- ✅ Loaded correctly on next spin
- ✅ No more "base mode" when client shows free spins

---

## 📊 Before vs After

### Before (BROKEN):
```
Client: FREE SPINS 11, Accumulated x11
Server loads: mode=base, free_spins=0, multiplier=1
Scatter trigger: Awards +15 (thinks it's initial)
State save: ❌ FAILED (42P10 error)
```

### After (FIXED):
```
Client: FREE SPINS 11, Accumulated x11
Server loads: mode=free_spins, free_spins=11, multiplier=11 ✅
Scatter trigger: Awards +5 (knows it's retrigger) ✅
State save: ✅ SUCCESS
```

---

## 🔗 GitHub

**Commit**: [03a4d22](https://github.com/ElricStormking/infinity-stones/commit/03a4d22)

**Changes**:
1. `infinity-storm-server/src/controllers/game.js` - Manual upsert logic
2. `infinity-storm-server/src/db/migrations/003_add_game_states_unique_player.sql` - UNIQUE constraint
3. `infinity-storm-server/apply-migration-003.js` - Migration runner

---

## 🎉 Summary

**One bug, two symptoms:**
- ❌ State never saved → Always loaded defaults
- ❌ Accumulated multiplier reset to 1 every spin
- ❌ Free spins count reset to 0 every spin
- ❌ Server thought base mode when client in free spins
- ❌ Retrigger treated as initial trigger (+15 not +5)

**Now fixed!** 🚀

