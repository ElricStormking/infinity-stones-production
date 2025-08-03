# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run the Game
```bash
# Start the full game server (serves both WebGL client and backend API)
cd infinity-storm-server
npm start
# Game accessible at http://localhost:3000

# Alternative: Run from root directory with PowerShell script (Windows)
./run-game.ps1

# Alternative: Simple static server (client-only, no backend features)
node start-server.js
# Game accessible at http://localhost:8080
```

### Install Dependencies
```bash
# Client dependencies
npm install

# Server dependencies
cd infinity-storm-server
npm install
```

### Development
```bash
# Start client-only dev server on port 8080
npm start
# or
npm run dev

# No linting, testing, or build scripts currently configured
# Add these scripts to package.json as needed for production deployment
```

## High-Level Architecture

### Game Overview
Infinity Storm is a Marvel-themed cascade slot game built with Phaser 3. It features:
- Candy Crush-style matching mechanics (8+ symbol clusters)
- 6×5 grid with cascading symbols
- Marvel theme featuring Infinity Gems, Thanos, and Scarlet Witch
- Free Spins bonus mode with special effects and music

### Client Architecture
The game uses a modular architecture with global window objects for Phaser compatibility:

**Core Systems:**
- **Phaser 3**: Game engine loaded globally via script tag
- **Scene Flow**: LoadingScene → MenuScene → GameScene
- **Managers**: 
  - GridManager: Core grid logic and symbol management
  - WinCalculator: Payout calculations and win detection
  - AnimationManager: Visual effects and animations
  - UIManager: User interface elements
  - BurstModeManager: Special burst animations
  - FreeSpinsManager: Free spins mode logic
- **Services**: 
  - NetworkService: HTTP/WebSocket communication
  - GameAPI, WalletAPI, AuthAPI: Backend API interfaces
- **Config**: GameConfig.js - Game rules, RTP (96.5%), payouts, symbols

**Global Window Pattern**: All classes are attached to window object (e.g., `window.GridManager`) for Phaser scene access

### Server Architecture (infinity-storm-server/)
Express + Socket.io server on port 3000:
- Serves complete WebGL game as static files
- HTTP endpoints: `/api/spin`, `/api/health`
- WebSocket events: `spin_request`, `spin_result`
- Simplified demo implementation (random grid generation)
- CORS configured for localhost:3000 and localhost:8080

### Game Mechanics
- **Grid**: 6 columns × 5 rows (zero-indexed)
- **Matching**: Minimum 8 connected symbols
- **Payouts**: Tiered by cluster size (8-9, 10-11, 12+)
- **Symbols**:
  - Low: 6 Infinity Gems (Time, Space, Mind, Power, Reality, Soul)
  - High: Thanos Weapon, Scarlet Witch, Thanos
  - Scatter: Infinity Glove (4+ triggers Free Spins)
- **Features**: 
  - Cascading wins
  - Free Spins with multipliers
  - Burst Mode animations
  - Dynamic BGM switching

### Audio System
- **SafeSound**: Centralized audio with error handling
- **BGM**: Automatic switching between main/free spins themes
- **Effects**: Lightning strikes, symbol shattering
- **Files**:
  - `BGM_infinity_storm.mp3` - Main theme
  - `BGM_free_spins.mp3` - Bonus mode
  - `lightning_struck.mp3` - Scarlet Witch effect
  - `symbol_shattering.mp3` - Win sound

### Critical Implementation Notes
- **Symbol IDs**: Must match exactly between GameConfig.js and asset files
- **Network Service**: Multiple versions exist (-simple, -global) - use primary NetworkService.js
- **Audio Init**: Requires user interaction (browser policy)
- **Grid Coordinates**: Symbols drop from top, removed symbols cascade down
- **Asset Loading**: All assets in assets/ directory, loaded in LoadingScene

### Future Development (see InfinityStormServer-ClientArch.txt)
- Database integration (PostgreSQL)
- JWT authentication
- Server-side RNG
- Anti-cheat measures
- Wallet system
- Full game state validation