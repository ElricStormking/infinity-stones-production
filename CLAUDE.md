# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run the Game
```bash
# Start the game server (serves both game client and backend)
cd infinity-storm-server
npm start

# Alternative: Run from root directory with PowerShell script (Windows)
./run-game.ps1

# Alternative: Simple static server (client-only, no backend features)
node start-server.js
```

### Install Dependencies
```bash
# For client
npm install

# For server
cd infinity-storm-server
npm install
```

### Build with Webpack (optional)
```bash
# If using webpack build process
npm run build
```

## High-Level Architecture

### Game Type
Infinity Storm is a Marvel-themed cascade slot game built with Phaser 3. It features Candy Crush-style matching mechanics where symbols drop from above and matching clusters of 8+ symbols create wins.

### Client Architecture
The game uses a modular architecture with global window objects for compatibility:
- **Phaser 3** game engine loaded globally via script tag
- **Scene System**: LoadingScene → MenuScene → GameScene
- **Managers**: GridManager (grid logic), WinCalculator (payout calculations), AnimationManager, UIManager, BurstModeManager
- **Services**: NetworkService (HTTP/WebSocket), GameAPI, WalletAPI, AuthAPI
- **Config**: GameConfig.js contains all game rules, RTP settings, symbol definitions, and payout tables

### Server Architecture (infinity-storm-server/)
Single Express + Socket.io server running on port 3000 that:
- Serves the complete WebGL game client as static files
- Provides HTTP endpoints for game actions (/api/spin)
- Handles WebSocket connections for real-time game events
- Players access the game directly at http://localhost:3000
- Currently implements simplified spin logic (random grid generation)

### Key Game Mechanics
- **Grid**: 6 columns × 5 rows
- **Minimum Match**: 8 symbols of the same type
- **Cascading**: Matched symbols are removed, new ones drop from above
- **RTP**: 96.5% (configured in GameConfig.js)
- **Special Features**:
  - Free Spins (triggered by 4+ scatter symbols)
  - Random Multipliers (2x-500x)
  - Burst Mode animations
  - Progressive accumulated multipliers

### Symbol System
- **Low-paying**: 6 Infinity Gems (Time, Space, Mind, Power, Reality, Soul)
- **High-paying**: Thanos Weapon, Scarlet Witch, Thanos
- **Scatter**: Infinity Glove (triggers free spins)
- Payouts vary by cluster size: 8-9, 10-11, or 12+ symbols

### Asset Structure
- **Images**: UI elements, symbols, backgrounds in assets/images/
- **Sprites**: Animated sequences for wins, gems, characters in assets/images/sprites/
- **Audio**: Background music and effects in assets/audio/
- **Scene Files**: Phaser scene configurations (.scene files)

### Development Notes
- Single server deployment: Players download and play the WebGL game directly from port 3000
- All JavaScript classes are globally available via window object
- SafeSound system handles missing audio gracefully
- Responsive design scales from 960×540 to 1920×1080
- WebSocket integration ready but simplified for demo
- The start-server.js file is a simple static server alternative for client-only testing

### Important Implementation Details
- **Global Window Pattern**: All game classes (Scene, Manager, Service) are attached to window object for Phaser compatibility
- **Symbol IDs**: Must match exactly between GameConfig.js and asset filenames (e.g., 'time_gem' → time_gem.png)
- **Grid Coordinates**: 6 columns × 5 rows, zero-indexed, symbols drop from top
- **Win Calculation**: Matches require minimum 8 connected symbols, payouts based on cluster size tiers
- **Server Port**: Single server runs on port 3000, serving both the WebGL game client and backend API

### File Organization
- **Game Logic**: src/core/ (Symbol.js, GameStateManager.js)
- **Game Mechanics**: src/systems/ (GridManager.js, WinCalculator.js)
- **UI Components**: src/ui/ and src/managers/UIManager.js
- **Network Layer**: src/services/ (NetworkService.js handles both HTTP and WebSocket)
- **Scene Flow**: LoadingScene → MenuScene → GameScene (defined in src/scenes/)

### Planned Server Architecture
The InfinityStormServer-ClientArch.txt file contains the complete planned server architecture including:
- Database models for Player, Wallet, Session, Transaction, SpinResult
- Service layer for game engine, RNG, wallet, anti-cheat
- WebSocket handlers for real-time game events
- Security measures including JWT auth, rate limiting, server-side RNG