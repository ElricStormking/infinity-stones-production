# Quick Test Guide: Scatter Celebration Animation

## 🚀 Quick Start

1. **Start the Server** (if testing in server mode):
   ```powershell
   cd infinity-storm-server
   npm run dev
   ```

2. **Start the Game**:
   ```powershell
   npm start
   ```
   Or open `http://localhost:3000` in browser

## 🎯 What to Look For

### When Free Spins Trigger (4+ Scatters)
You should see:

1. **Scatter Celebration Animation** plays at each scatter symbol position:
   - ✨ Large animated scatter sprite (1.5x size)
   - 💫 Pulse effect (grows to 1.8x and back)
   - ⚡ Blinking effect (alpha fades in/out)
   - 🎬 24-frame animation at 18fps (~1.3 seconds)
   - ⏱️ Staggered start (50ms delay between each)

2. **After animation completes**:
   - Thanos snap animation plays
   - Free Spins dialog appears
   - Fire effect triggers
   - Free spins mode begins

### During Free Spins (Retrigger)
If you get 4+ scatters during free spins:

1. Same scatter celebration plays
2. Thanos snap sound + animation
3. "+5 Free Spins!" message
4. Free spins counter updates
5. Auto-play continues

## 🎮 Testing Steps

### Test 1: Initial Free Spins Trigger
1. Start game in demo mode
2. Spin multiple times until 4+ scatter symbols appear
3. **Expected**: Scatter celebration plays at all scatter positions
4. **Expected**: Free spins dialog appears after celebration
5. **Verify**: All visual effects (scale, pulse, blink) are visible

### Test 2: Free Spins Retrigger
1. Be in free spins mode (from Test 1)
2. Get 4+ scatters during a free spin
3. **Expected**: Scatter celebration plays again
4. **Expected**: Extra spins added (+5)
5. **Verify**: Auto-play continues after celebration

### Test 3: Server Mode
1. Login as test player (if available)
2. Repeat Test 1 with server spins
3. **Expected**: Same celebration behavior
4. **Verify**: Server balance updates correctly

## 🐛 Debugging

### Check Browser Console
Look for these log messages:

```
✅ Big scatter celebration animation registered
✨ Playing scatter celebration at X positions
🎰✨ Triggering free spins with scatter celebration (X scatters...)
✅ Scatter celebration complete - proceeding with free spins trigger
```

### Common Issues

**Animation doesn't show:**
- Check: `ui_gem_scatter_big.png` loaded successfully
- Check: Animation created in LoadingScene
- Check: No console errors about missing texture

**Wrong positions:**
- Check: Scatter symbols visible on grid
- Check: `getScatterPositions()` returns correct count
- Check: World position calculation matches grid

**No retrigger celebration:**
- Check: Currently in free spins mode
- Check: 4+ scatters present on grid
- Check: `scatterCelebration` initialized

## 📊 Console Commands (for testing)

Open browser console and try:

```javascript
// Check if effect manager is initialized
window.gameScene.scatterCelebration

// Manually trigger test (during gameplay)
const testPositions = [
    {col: 0, row: 0},
    {col: 1, row: 1},
    {col: 2, row: 2},
    {col: 3, row: 3}
];
window.gameScene.scatterCelebration.playAtPositions(testPositions);

// Check scatter positions on current grid
window.gameScene.gridManager.getScatterPositions()
```

## ✅ Success Criteria

- [x] Scatter animation loads without errors
- [x] Animation plays at correct grid positions
- [x] Visual effects (pulse, blink, scale) visible
- [x] Animations stagger (not all at once)
- [x] Free spins trigger after celebration
- [x] Retrigger celebration works
- [x] Server mode works correctly
- [x] No console errors
- [x] Sprites cleanup after animation

## 🎬 Expected Visual Flow

```
Normal Spin → 4+ Scatters Land
    ↓
✨ SCATTER CELEBRATION PLAYS ✨
    • Big scatter sprites appear at each position
    • Scale 1.5x → pulse to 1.8x → back to 1.5x
    • Alpha 1.0 → blink to 0.3 → back to 1.0
    • Each staggered by 50ms
    • Duration: ~1.3 seconds
    ↓
Thanos Snap Animation
    ↓
"FREE SPINS AWARDED!" Dialog
    ↓
Fire Effect
    ↓
Free Spins Begin
```

## 📝 Notes

- The scatter symbol is `infinity_glove` in the code
- Minimum 4 scatters required to trigger
- Celebration plays BEFORE Thanos snap (not after)
- During retrigger, adds +5 extra spins
- Animation depth is FX level (above all other elements)

