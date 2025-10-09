# Debug Overlay Enhancement - Random Multipliers Display

## Summary
Enhanced the ServerDebugWindow debug overlay to display detailed random multiplier information for each cascade step, helping verify server RNG behavior.

## Implementation Date
2025-10-08

## Changes Made

### 1. Enhanced Multiplier Display (src/debug/ServerDebugWindow.js)

#### Visual Improvements
- **Prominent Section Header**: Added "🎯 Random Multipliers" section for each cascade with orange highlighting
- **Structured Layout**: Multiplier events displayed in bordered boxes with clear hierarchy
- **Color Coding**:
  - Event headers: Gold (#ffd700)
  - Multiplier details: Yellow (#ffeb3b)
  - Section labels: Orange (#ffa500)
  - RNG metadata: Dimmed for readability

#### Data Displayed Per Multiplier Event

**Event Level:**
- Event type (cascade_random_multiplier, random_multiplier, etc.)
- Total multiplier value (e.g., "Total: x3")
- Win transformation (e.g., "Win: 5.00 → 15.00")
- RNG metadata:
  - Trigger roll (random number generated)
  - Trigger chance (probability threshold)
  - Table index (which multiplier from table)

**Individual Multiplier Level:**
- Multiplier value (x2, x3, x5, etc.)
- Grid position (column, row)
- Character assignment:
  - 👊 Thanos
  - 🔴 Scarlet Witch
  - ⭐ Generic
- Additional RNG metadata:
  - Sequence index
  - Animation duration
  - Character selection roll

#### Example Output

```
🎯 Random Multipliers
  Event #1: cascade_random_multiplier | Total: x3 | Win: 10.00 → 30.00
    RNG: roll=0.234567, chance=0.25, table[2]
    
    Multiplier 1: x3 | pos(col=3, row=2) | 👊 Thanos
      RNG: roll=0.456789, chance=0.35, table[2], duration=1500ms

  No multipliers triggered (shown when no multipliers in cascade)
```

### 2. Enhanced Data Collection

#### Multiple Data Sources
The overlay now checks for multipliers in multiple locations to ensure complete coverage:

1. **Primary Source**: `root.multiplierEvents[]` (from gameEngine)
2. **Bonus Features**: `root.bonusFeatures.randomMultipliers[]`
3. **Legacy Fields**: `root.randomMultipliers[]`, `root.multipliers[]`
4. **Cascade Steps**: Per-step multiplier arrays in cascadeSteps
5. **Step Events**: `step.multiplierEvents[]` within each cascade

#### Normalization Logic
- Handles both event objects and single multiplier objects
- Wraps single multipliers into consistent array format
- Maps multipliers to correct cascade steps using:
  - Explicit cascade number in metadata
  - Step index from cascade array
  - Forced cascade assignment for step-specific events

### 3. Field Mapping

The overlay intelligently maps various field names:

**Multiplier Value:**
- `multiplier`, `value`, `totalMultiplier`

**Metadata:**
- `meta`, `metadata`

**Position:**
- `position.col`, `position.row`

**Character:**
- `character` (string: "Thanos", "Scarlet Witch", etc.)

## Testing

### How to Use
1. Start game with `?debug=1` or `?debugbtn=1` query parameter
2. Open browser console to see debug overlay (top-right)
3. Play spins and observe multiplier information per cascade
4. Each cascade step shows whether multipliers were triggered and their details

### What to Verify
- ✅ Multiplier events appear in correct cascade steps
- ✅ Character assignment (Thanos/Scarlet Witch) displays correctly
- ✅ Grid positions match where visual effects appear
- ✅ RNG metadata shows trigger probability working correctly
- ✅ Win amounts properly calculated (original × multiplier = final)

## Server-Side Integration

### Required Server Response Structure
The overlay expects this structure from `/api/spin` or `/api/demo-spin`:

```json
{
  "success": true,
  "data": {
    "spinId": "...",
    "cascadeSteps": [
      {
        "stepNumber": 1,
        "win": 10.00,
        // ... other cascade data
      }
    ],
    "multiplierEvents": [
      {
        "type": "cascade_random_multiplier",
        "totalMultiplier": 3,
        "originalWin": 10.00,
        "finalWin": 30.00,
        "multipliers": [
          {
            "multiplier": 3,
            "position": { "col": 2, "row": 1 },
            "character": "Thanos",
            "metadata": {
              "triggerRoll": 0.234567,
              "triggerChance": 0.25,
              "tableIndex": 2,
              "animationDuration": 1500
            }
          }
        ],
        "metadata": {
          "cascade": 1
        }
      }
    ],
    "bonusFeatures": {
      "randomMultipliers": [...]
    }
  }
}
```

## Benefits

1. **RNG Verification**: Developers can verify server RNG is working correctly
2. **Visual Debugging**: Helps diagnose mismatches between server data and client rendering
3. **Testing Aid**: Makes it easy to spot when multipliers should appear but don't
4. **Documentation**: RNG metadata serves as audit trail for each multiplier trigger

## Related Files

- `src/debug/ServerDebugWindow.js` - Debug overlay implementation
- `infinity-storm-server/src/game/gameEngine.js` - Generates multiplierEvents
- `infinity-storm-server/src/game/multiplierEngine.js` - Multiplier RNG logic
- `src/services/NetworkService.js` - Response normalization
- `specs/client-server-sync-fix/tasks.md` - Task tracking

## Next Steps

1. Test actual gameplay to verify multiplier visuals render correctly
2. Verify character animations (Thanos/Scarlet Witch) match server assignments
3. Test free spins multiplier accumulation displays correctly
4. Verify cascade multipliers work during free spins mode

