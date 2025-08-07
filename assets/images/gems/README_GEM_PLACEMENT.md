# New Gem Graphics Placement Guide

Place the new 150x150 pixel gem graphics in this directory with the following names:

## Required Files (all 150x150 pixels):

1. **time_gem.png** - Orange/Yellow gem (Image #1)
2. **mind_gem.png** - Purple gem (Image #2) 
3. **reality_gem.png** - Pink/Red gem (Image #3)
4. **power_gem.png** - Orange gem (Image #4)
5. **space_gem.png** - Blue gem (Image #5)
6. **soul_gem.png** - Green gem (Image #6)

## Changes Made:

- Updated `GameConfig.js`: 
  - `SYMBOL_SIZE` changed from 130 to 150 pixels
  - `GRID_SPACING` changed from 19 to 15 pixels

- Updated `LoadingScene.js`:
  - Updated gem asset paths to load from `assets/images/gems/`
  - Updated fallback colors to match new gem colors

- Updated `GameScene.js`:
  - Adjusted grid offsets from 4,4 to 2,2 for better alignment

## Grid Layout Impact:

With the new settings:
- Grid width: 6 × (150 + 15) - 15 = 975 pixels
- Grid height: 5 × (150 + 15) - 15 = 810 pixels

The grid will be slightly larger but should still fit within the ui_box with the adjusted offsets.

## Testing:

After placing the gem files, run the game to verify:
1. Gems load correctly without fallback colors
2. Grid alignment looks good within the ui_box
3. Symbol spacing and positioning is visually appealing
4. All game mechanics work correctly with the new sizes