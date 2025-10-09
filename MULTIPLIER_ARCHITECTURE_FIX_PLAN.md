# Multiplier Architecture Fix Plan

## Issues Identified

### Issue 1: Multipliers Generated After All Cascades Complete
**Current Behavior** (Lines 405-422 in `gameEngine.js`):
- Server processes ALL cascades first
- THEN generates cascading multipliers based on final cascade count
- Multipliers applied to total win at END of spin
- Client displays multipliers but formula shows wrong total

**Problem**:
- Race condition: Client tries to display multipliers during cascades
- Multipliers should be deterministic PER CASCADE, not after all cascades
- Formula plaque shows wrong total because multipliers applied at wrong time

**Required Fix**:
Move multiplier generation INSIDE the cascade loop so each cascade can have its own multiplier

### Issue 2: Free Spins Not Triggering
**Current Behavior** (Lines 356-376):
- Server counts scatters on `initialGridSnapshot`
- Checks if `scatterCount >= 4`
- Sets `freeSpinsTriggered` and `freeSpinsAwarded`

**Possible Problems**:
1. Scatters might be removed before counting (if they're in matches)
2. Client not properly handling `freeSpinsTriggered` response
3. Response fields not matching what client expects

## Fix Strategy

### Fix 1: Per-Cascade Multiplier Generation

**Current Flow**:
```
1. Generate initial grid
2. Loop: Find matches → Remove → Drop → Fill
3. AFTER loop ends: Generate multipliers for ALL cascades
4. Apply multipliers to total win
```

**New Flow**:
```
1. Generate initial grid
2. Loop: 
   a. Find matches → Remove → Drop → Fill
   b. IF this cascade has win > threshold:
      - Check if multiplier triggers (RNG)
      - Generate multiplier(s) for THIS cascade
      - Store in cascadeStep.multipliers[]
   c. Continue to next cascade
3. AFTER loop: Calculate total multiplier from all cascade steps
```

### Fix 2: Free Spins Trigger Verification

**Steps**:
1. Add logging to verify scatter count
2. Check if scatters are being removed before counting
3. Verify client processes `freeSpinsTriggered` correctly
4. Ensure response format matches client expectations

## Implementation Plan

### Phase 1: Add Logging (Immediate)
Add detailed logging to understand current behavior:
- Log scatter count on initial grid
- Log when multipliers are generated
- Log what client receives

### Phase 2: Fix Multiplier Architecture (Major Change)
Move multiplier generation inside cascade loop:
1. Check multiplier trigger per cascade (not after all cascades)
2. Store multipliers in `cascadeStep.multipliers[]`
3. Client displays multipliers as they arrive with cascade data
4. Formula updates correctly because multipliers tied to cascades

### Phase 3: Fix Free Spins (Debug Then Fix)
1. Verify scatter counting logic
2. Add logging for free spins trigger
3. Check client-side free spins handling
4. Fix any mismatches in response format

## Risk Assessment

### High Risk: Multiplier Architecture Change
- Requires changing core game loop
- Must maintain RTP balance
- Need extensive testing
- Could break existing gameplay

### Medium Risk: Free Spins Fix
- Likely configuration or response format issue
- Lower impact if logging reveals simple fix
- May just need client-side adjustment

## Recommended Approach

**Short Term (Today)**:
1. Add comprehensive logging to both issues
2. Test and observe actual behavior
3. Identify exact root causes

**Medium Term (Next Session)**:
1. Implement per-cascade multiplier architecture
2. Update client to consume per-cascade multipliers
3. Fix free spins trigger based on logging insights

**Long Term**:
1. Full regression testing
2. RTP validation
3. Performance testing with new architecture

## Files Requiring Changes

### Server-Side:
- `infinity-storm-server/src/game/gameEngine.js` - Main cascade loop
- `infinity-storm-server/src/game/multiplierEngine.js` - Change to per-cascade logic
- `infinity-storm-server/src/game/freeSpinsEngine.js` - Verify trigger logic

### Client-Side:
- `src/managers/BonusManager.js` - Handle per-cascade multipliers
- `src/managers/FreeSpinsManager.js` - Verify trigger processing
- `src/scenes/GameScene.js` - Process free spins from server

## Testing Requirements

1. **Multiplier Testing**:
   - Verify multipliers display correctly per cascade
   - Formula plaque shows correct total
   - RTP maintained at 96.5%
   
2. **Free Spins Testing**:
   - 4+ scatters trigger free spins
   - Correct number of spins awarded
   - Client enters free spins mode
   - Re-triggers work correctly

## Next Steps

**Immediate Actions** (Choose based on priority):

**Option A: Fix Free Spins First** (Lower risk, immediate user impact)
- Add logging to understand why 4+ scatters don't trigger
- Quick fix once root cause identified
- User can play free spins feature

**Option B: Fix Multiplier Architecture** (Higher risk, more complex)
- Requires architectural refactoring
- Takes longer but solves race conditions
- Better long-term solution

**Recommended**: Start with Option A (Free Spins) while planning Option B (Multiplier Architecture) for next session.

