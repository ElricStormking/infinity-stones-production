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
# Start development server with auto-reload (client-only)
npm run dev
# or
npm start

# Test animations
# Open test-animations.html in browser

# Run math simulator for RTP validation
node src/tools/MathSimulator.js
```

### Server Development
```bash
# Install server dependencies
cd infinity-storm-server
npm install

# Start full-stack development
cd infinity-storm-server
npm start
# Server runs on http://localhost:3000 with client served as static files

# Development mode with nodemon (auto-restart on changes)
cd infinity-storm-server
npx nodemon server.js
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
- **Static File Serving**: Serves the complete WebGL game client from parent directory
- **HTTP API**: RESTful endpoints (/api/spin, /api/health) with JSON responses
- **WebSocket Support**: Real-time communication via Socket.io for game events
- **Security**: Crypto.randomBytes for server-side RNG, CORS protection
- **Development Features**: Cache-Control disabled, nodemon support for hot-reload
- **Dependencies**: express, socket.io, cors, dotenv, bcrypt, jsonwebtoken, pg (PostgreSQL ready)

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

#### Development Patterns
- **No Build System**: Direct script tag loading for rapid development
- **Global Namespace**: All classes use `window.ClassName = class` pattern
- **Symbol Recycling**: GridManager maintains object pools for performance
- **Config-Driven**: GameConfig.js contains all gameplay parameters and tuning
- **Phaser Lifecycle**: Follows create() → update() → destroy() scene patterns
- **Async Pattern**: NetworkService uses axios with Promise-based API calls

#### Network Architecture
- **HTTP API**: axios-based client with interceptors for auth and error handling
- **WebSocket**: Socket.io for real-time events (spin_request/spin_result, test messages)
- **Authentication**: JWT token support with localStorage persistence
- **Error Handling**: 401 auth error handling, timeout configuration (10s)
- **Development**: Simplified server spin logic using crypto.randomBytes

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

infinity-storm-server/
├── server.js      # Main Express + Socket.io server
├── package.json   # Server dependencies (express, socket.io, cors, etc.)
└── node_modules/  # Server-side dependencies

Root files:
├── index.html     # Game entry point
├── start-server.js # Simple static file server (client-only)
├── run-game.ps1   # PowerShell launcher script
├── package.json   # Client dependencies (phaser, http-server)
└── test-animations.html # Animation testing utility
```

### Testing & Debugging
- **Browser Console**: `window.game` provides access to Phaser game instance
- **Animation Testing**: test-animations.html for sprite debugging
- **Math Validation**: src/tools/MathSimulator.js for RTP testing
- **Network Testing**: Server provides /api/health endpoint
- **Global Objects**: All game classes attached to window (GridManager, NetworkService, etc.)
- **Symbol Pool**: GridManager includes symbol recycling for performance
- **Development**: No build step required - direct browser loading with script tags

### Current Development State
- **Deployment**: Single server model (client and backend on same port 3000)
- **Game Logic**: Simplified server spin logic using crypto.randomBytes
- **Communication**: HTTP API endpoints functional, WebSocket handlers implemented
- **Features**: Free spins and multiplier mechanics implemented client-side
- **Authentication**: JWT infrastructure in place but not fully activated
- **Database**: PostgreSQL dependencies ready but models not implemented
- **Development Mode**: Both client-only (npm run dev) and full-stack (server start) workflows

### Planned Architecture (InfinityStormServer-ClientArch.txt)
Future implementation includes:
- Database models (Player, Wallet, Session, Transaction, SpinResult)
- Service layer (game engine, RNG, wallet, anti-cheat)
- JWT authentication with rate limiting
- Server-side RNG with cryptographic security
- Complete WebSocket integration for real-time events