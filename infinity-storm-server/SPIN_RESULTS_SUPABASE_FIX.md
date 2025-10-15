# Spin Results Supabase Fix

## Problem
Spin results were not being saved to the Supabase database `spin_results` table. The game controller was only saving to the local PostgreSQL database using Sequelize's `SpinResult.create()` method. Additionally, demo spins were completely excluded from Supabase storage.

## Root Causes
1. **Missing Supabase Integration**: The `infinity-storm-server/src/controllers/game.js` was missing a call to the `saveSpinResult()` function from `supabaseClient.js` that specifically handles saving to Supabase.
2. **Demo Player UUID Mismatch**: Demo spins used string ID `'demo-player'` instead of the actual UUID from the Supabase database, causing silent insertion failures.
3. **Demo Spin Endpoint Missing Save**: The `/api/demo-spin` endpoint was not saving results to Supabase at all.

## Solution

### Files Modified

#### 1. `infinity-storm-server/src/controllers/game.js`
- **Added import**: `const { saveSpinResult } = require('../db/supabaseClient');`
- **Added Supabase save call** after the transaction commit (lines 233-249):
  ```javascript
  // Save spin result to Supabase (async, non-blocking)
  saveSpinResult(playerId, {
    sessionId: sessionId,
    bet: normalizedBetAmount,
    initialGrid: spinResult.initialGrid,
    cascades: spinResult.cascades,
    totalWin: spinResult.totalWin,
    multipliers: spinResult.multipliers,
    rngSeed: spinResult.rngSeed,
    freeSpinsActive: serverFreeSpinsActive
  }).catch(err => {
    logger.error('Failed to save spin result to Supabase', {
      player_id: playerId,
      spin_id: spinId,
      error: err.message
    });
  });
  ```

#### 2. `infinity-storm-server/src/db/supabaseClient.js`
- **Updated `saveSpinResult()` function** to handle demo players and sessions:
  - Detects `'demo-player'` or `'demo_player'` string IDs
  - Fetches actual UUID from Supabase using `getDemoPlayer()`
  - Converts `'demo-session'` to `null` (since demo sessions don't have UUIDs)
  - Added comprehensive error logging
  - Added success logging with player ID and win amount

#### 3. `infinity-storm-server/src/routes/api.js`
- **Added import**: `const { saveSpinResult } = require('../db/supabaseClient');`
- **Added Supabase save call** in `/api/demo-spin` endpoint:
  ```javascript
  // Save demo spin result to Supabase (async, non-blocking)
  saveSpinResult('demo-player', {
    sessionId: 'demo-session',
    bet: parseFloat(betAmount),
    initialGrid: spin.initialGrid,
    cascades: spin.cascadeSteps,
    totalWin: spin.totalWin,
    multipliers: spin.multipliers,
    rngSeed: spin.rngSeed,
    freeSpinsActive: Boolean(freeSpinsActive)
  }).catch(err => {
    console.error('Failed to save demo spin result to Supabase:', err.message);
  });
  ```

## Testing

### Prerequisites
1. Ensure Supabase local is running:
   ```bash
   cd infinity-storm-server
   supabase start
   ```

2. Verify database is initialized:
   ```bash
   supabase db reset
   ```

### Test Steps
1. Start the game server:
   ```bash
   cd infinity-storm-server
   npm start
   ```

2. **Watch the server logs** - you should see these messages after each spin:
   ```
   Converted demo player ID from 'demo-player' to UUID: <uuid>
   ✅ Spin result saved to Supabase: <spin_id> | Player: <uuid> | Win: <amount>
   ```

3. Play a few spins in the game (both demo and authenticated)

4. Check Supabase Studio at http://127.0.0.1:54323
   - Navigate to Table Editor
   - Open the `spin_results` table
   - Sort by `created_at` DESC to see newest spins first
   - Verify that new rows are being created with each spin

5. Verify the data includes:
   - `player_id` (UUID) - should be demo player's UUID for demo spins
   - `session_id` (UUID or NULL for demo sessions)
   - `bet_amount` (decimal)
   - `initial_grid` (JSONB array)
   - `cascades` (JSONB array)
   - `total_win` (decimal)
   - `multipliers_applied` (JSONB array)
   - `rng_seed` (string)
   - `game_mode` ('base' or 'free_spins')
   - `created_at` (timestamp) - should match current date/time

### Alternative Test - Direct Database Query
You can also test using the Supabase SQL Editor:

```sql
-- Check recent spin results
SELECT 
  id,
  player_id,
  session_id,
  bet_amount,
  total_win,
  game_mode,
  created_at
FROM spin_results
ORDER BY created_at DESC
LIMIT 10;

-- Check demo player's spins specifically
SELECT 
  sr.id,
  p.username,
  sr.bet_amount,
  sr.total_win,
  sr.game_mode,
  sr.created_at
FROM spin_results sr
JOIN players p ON sr.player_id = p.id
WHERE p.username = 'demo_player'
ORDER BY sr.created_at DESC
LIMIT 10;

-- Check spin count
SELECT COUNT(*) as total_spins FROM spin_results;

-- Check spin count by player type
SELECT 
  p.username,
  p.is_demo,
  COUNT(*) as spin_count,
  SUM(sr.bet_amount) as total_bet,
  SUM(sr.total_win) as total_win
FROM spin_results sr
JOIN players p ON sr.player_id = p.id
GROUP BY p.username, p.is_demo
ORDER BY spin_count DESC;
```

## Technical Details

### Non-Blocking Save
The Supabase save is intentionally non-blocking (using `.catch()`) to ensure that:
1. The main transaction completes quickly
2. Database write failures don't block the game response
3. Errors are logged for monitoring without affecting gameplay

### Dual Database Strategy
The system currently saves to both:
1. **Local PostgreSQL** (via Sequelize) - For local development and testing
2. **Supabase** - For production-grade features and cloud storage

This provides redundancy and allows for gradual migration to Supabase-only storage.

## Future Improvements
- Consider migrating fully to Supabase and removing Sequelize dependency
- Add retry logic for failed Supabase saves
- Implement background job queue for database writes
- Add metrics tracking for Supabase save success/failure rates

