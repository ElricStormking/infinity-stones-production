# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run the Game
```bash
# Start the full game server (serves both client and backend API)
cd infinity-storm-server
npm start
# Server runs on http://localhost:3000

# Alternative: Run from root with PowerShell script (Windows)
./run-game.ps1

# Alternative: Simple static server (client-only, no backend features)
node start-server.js
# Runs on port 3000 (or 8080 if using run-game.ps1)
```

### Install Dependencies
```bash
# Client dependencies
npm install

# Server dependencies
cd infinity-storm-server
npm install
```

### Development Tools
```bash
# Test animations
# Open test-animations.html in browser

# Run math simulator for RTP validation
node src/tools/MathSimulator.js
```

## High-Level Architecture

### Game Type
Infinity Storm is a Marvel-themed cascade slot game built with Phaser 3. It features Candy Crush-style matching mechanics where symbols drop from above and matching clusters of 8+ symbols create wins.

### Client Architecture
The game uses a **global window object pattern** for Phaser compatibility (NOT ES6 modules):
- **Phaser 3** game engine loaded globally via script tag
- **Scene System**: LoadingScene → MenuScene → GameScene
- **Managers**: GridManager (grid logic), WinCalculator (payout calculations), AnimationManager, UIManager, BurstModeManager, WinPresentationManager
- **Services**: NetworkService (HTTP/WebSocket), GameAPI, WalletAPI, AuthAPI
- **Config**: GameConfig.js contains all game rules, RTP settings, symbol definitions, and payout tables
- **SafeSound**: Custom audio wrapper system that handles missing audio gracefully

### Server Architecture (infinity-storm-server/)
Express + Socket.io server running on port 3000:
- Serves the complete WebGL game client as static files
- Provides HTTP endpoints for game actions (/api/spin, /api/health)
- Handles WebSocket connections for real-time game events
- Currently implements simplified spin logic (random grid generation)
- CORS configured for localhost:3000 and 127.0.0.1:3000

### Key Game Mechanics
- **Grid**: 6 columns × 5 rows of symbols
- **Minimum Match**: 8 symbols of the same type (connected)
- **Cascading**: Matched symbols are removed, new ones drop from above
- **RTP**: 96.5% (configured in GameConfig.js)
- **Volatility**: HIGH
- **Max Win**: 5000x bet
- **Special Features**:
  - Free Spins (triggered by 4+ scatter symbols)
  - Random Multipliers (2x-500x)
  - Burst Mode animations
  - Progressive accumulated multipliers during free spins

### Symbol System
Symbols are defined in GameConfig.js with tiered payouts based on cluster size:
- **Low-paying**: 6 Infinity Gems (Time, Space, Mind, Power, Reality, Soul)
- **High-paying**: Thanos Weapon, Scarlet Witch, Thanos
- **Scatter**: Infinity Glove (triggers free spins)
- **Payout Tiers**: 8-9 symbols, 10-11 symbols, 12+ symbols

### Important Implementation Details

#### Global Window Pattern
All game classes MUST be attached to the window object for Phaser compatibility:
```javascript
window.MyClass = class MyClass { ... }
// NOT: export class MyClass { ... }
```

#### Symbol IDs
Must match exactly between GameConfig.js and asset filenames:
- Symbol ID: 'time_gem' → Asset: assets/images/time_gem.png
- Use underscores, not camelCase

#### Grid System
- 6 columns × 5 rows, zero-indexed
- Symbols drop from top (negative Y position initially)
- Grid positions stored as [col][row] in GridManager

#### Win Calculation
- Uses flood-fill algorithm to find connected clusters
- Minimum 8 symbols required for a win
- Payouts based on symbol type and cluster size tier

#### Audio System
- SafeSound wrapper handles missing audio gracefully
- BGM management with automatic switching
- Audio context initialization after user interaction

#### Network Architecture
- HTTP for game actions (spin, balance)
- WebSocket for real-time events (future implementation)
- Currently simplified for demo (random grid generation)

### File Organization
```
src/
├── config/         # GameConfig.js - all game settings
├── core/          # Symbol.js, GameStateManager.js
├── systems/       # GridManager.js, WinCalculator.js
├── managers/      # UI, Animation, BurstMode, FreeSpins, WinPresentation
├── services/      # NetworkService, GameAPI, WalletAPI, AuthAPI
├── scenes/        # Phaser scenes (Loading, Menu, Game)
├── effects/       # Visual effects (FireEffect, ThanosPowerGrip)
├── shaders/       # WebGL shaders
└── tools/         # MathSimulator for RTP validation

assets/
├── images/        # UI elements, symbols, backgrounds
├── sprites/       # Animated sequences for wins, characters
└── audio/         # Background music and sound effects
```

### Testing & Debugging
- **Browser Console**: `window.game` provides access to Phaser game instance
- **Animation Testing**: test-animations.html for sprite debugging
- **Math Validation**: src/tools/MathSimulator.js for RTP testing
- **Network Testing**: Server provides /api/health endpoint

### Current Development State
- Single server deployment model (client and backend on same port)
- Simplified server spin logic (random generation)
- WebSocket handlers ready but not fully integrated
- Free spins and multiplier mechanics implemented client-side
- Authentication system planned but not implemented

### Planned Architecture (InfinityStormServer-ClientArch.txt)
Future implementation includes:
- Database models (Player, Wallet, Session, Transaction, SpinResult)
- Service layer (game engine, RNG, wallet, anti-cheat)
- JWT authentication with rate limiting
- Server-side RNG with cryptographic security
- Complete WebSocket integration for real-time events