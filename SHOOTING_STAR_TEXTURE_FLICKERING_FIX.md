# Shooting Star Texture Flickering Fix

## Issue
User reported: "Some shooting stars visuals were quickly switched during Shoot Star visual's flight."

Multiple shooting stars fired in quick succession were alternating between different gem textures (`mind_gem` and `reality_gem`), causing visual flickering/switching as they flew across the screen.

## Root Cause
The `playRandomMultiplierShootingStar()` function was randomly selecting between available gem textures for each individual star:

```javascript
// OLD (BROKEN): Each star picks a different texture
if (this.textures.exists('mind_gem')) {
    star = this.add.image(startX, startY, 'mind_gem'); // Star 1: mind_gem
} else if (this.textures.exists('reality_gem')) {
    star = this.add.image(startX, startY, 'reality_gem'); // Star 2: reality_gem (flicker!)
}
```

When 3+ multipliers triggered, stars would alternate textures:
- Star 1: mind_gem (yellow)
- Star 2: mind_gem (yellow) 
- Star 3: reality_gem (red) ← Sudden visual change!

## Solution

### 1. Store Consistent Texture Choice
**File**: `src/scenes/GameScene.js` (lines 1086-1096)

Pick ONE texture at the start and reuse it for ALL stars in the same spin:

```javascript
// Pick a consistent texture for all stars in this spin to avoid flickering
// Store the choice on first star, reuse for subsequent stars
if (!this.currentShootingStarTexture) {
    if (this.textures.exists('mind_gem')) {
        this.currentShootingStarTexture = { key: 'mind_gem', scaleX: 0.34, scaleY: 0.58 };
    } else if (this.textures.exists('reality_gem')) {
        this.currentShootingStarTexture = { key: 'reality_gem', scaleX: 0.32, scaleY: 0.52 };
    } else {
        this.currentShootingStarTexture = { key: 'fallback', scaleX: 1, scaleY: 1 };
    }
}
```

### 2. Use Stored Texture for All Stars
**File**: `src/scenes/GameScene.js` (lines 1098-1109)

```javascript
const fireOneStarTo = (target) => {
    let star;
    if (this.currentShootingStarTexture.key === 'fallback') {
        const g = this.add.graphics({ x: startX, y: startY });
        g.fillStyle(0xFFD700, 1);
        g.fillCircle(0, 0, 8);
        star = g;
    } else {
        // Use the stored texture choice - same for all stars this spin!
        star = this.add.image(startX, startY, this.currentShootingStarTexture.key);
        star.setScale(this.currentShootingStarTexture.scaleX, this.currentShootingStarTexture.scaleY);
    }
    // ...
};
```

### 3. Reset Texture Choice Each Spin
**File**: `src/managers/BonusManager.js` (line 473)

```javascript
// Reset star counter and texture choice for this spin
if (this.scene) {
    this.scene.starIdCounter = 0;
    this.scene.currentShootingStarTexture = null; // Reset for new spin
}
```

This ensures each spin can pick a new texture (randomly), but ALL stars within that spin use the SAME texture.

## Result
✅ **Smooth, Consistent Visuals**:

**Before (Broken)**:
- Spin 1: Star ⭐ (yellow) → Star ⭐ (red) → Star ⭐ (yellow) ← Flickering!
- User sees jarring visual switches mid-flight

**After (Fixed)**:
- Spin 1: Star ⭐ (yellow) → Star ⭐ (yellow) → Star ⭐ (yellow) ← Smooth!
- Spin 2: Star ⭐ (red) → Star ⭐ (red) → Star ⭐ (red) ← Also smooth!
- Each spin is consistent, variety between spins

## Files Changed
1. `src/scenes/GameScene.js` - Store and reuse texture choice for all stars in one spin
2. `src/managers/BonusManager.js` - Reset texture choice at start of each new spin

## Testing
Refresh browser and trigger multiple random multipliers (3+ in one spin):
- All shooting stars should use the SAME texture within one spin
- No mid-flight texture switching/flickering
- Variety still exists between different spins

