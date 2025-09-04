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
# Opens on http://localhost:3000

# Alternative: Simple static server (client-only, no backend features)  
node start-server.js
# Runs on port 3001

# Full development setup with Docker services
cd infinity-storm-server
npm run dev:full  # Starts database + development server with nodemon
```

### Install Dependencies
```bash
# Client dependencies
npm install

# Server dependencies
cd infinity-storm-server
npm install

# Integration test dependencies
cd tests/integration
npm install
```

### Development Tools
```bash
# Start development server with auto-reload
cd infinity-storm-server
npm run dev  # Uses nodemon for auto-restart

# Client-only development (static server)
npm run dev  # or npm start from root

# Test animations
# Open test-animations.html in browser

# Run math simulator for RTP validation
node src/tools/MathSimulator.js

# Test RNG security
# Open test-rng-security.html in browser

# Mobile development and testing
# Open test-mobile.html in browser for mobile testing
# Use Chrome DevTools device emulation (Ctrl+Shift+M)
# Test orientation changes and touch interactions
```

### Testing
```bash
# Server tests
cd infinity-storm-server
npm test                   # All tests
npm run test:cascade       # Cascade logic tests
npm run test:smoke         # Basic functionality tests
npm run test:watch         # Watch mode for TDD
npm run test:coverage      # Generate coverage report (70% threshold required)

# Integration tests from root
npm run test:integration           # All integration tests
npm run test:integration:client    # Client-specific tests
npm run test:integration:server    # Server-specific tests
npm run test:integration:cascade   # Cascade algorithm tests
npm run test:integration:websocket # WebSocket communication tests
npm run test:integration:performance # Performance stress tests
npm run test:integration:coverage  # Coverage report
npm run test:integration:report    # Open HTML report

# Mobile testing
npm run test:mobile                # Mobile-specific test suite
npm run test:mobile:orientation    # Orientation handling tests
npm run test:mobile:performance    # Mobile performance validation
npm run test:mobile:compatibility  # Cross-browser compatibility tests

# Run a single test file
cd infinity-storm-server
npx jest tests/cascade/CascadeLogic.test.js
npx jest tests/smoke/smoke.test.js --verbose
```

### Database Operations
```bash
# Docker services management
cd infinity-storm-server
docker compose up -d      # Start all services (PostgreSQL, Redis)
docker compose down       # Stop all services
docker compose logs -f    # View service logs

# Supabase local database (preferred for development)
npm run sb:start          # Start local Supabase instance
npm run sb:stop           # Stop Supabase
npm run sb:status         # Check status
npm run sb:status:json    # Check status with JSON output
npm run sb:status:env     # Get environment variables
npm run sb:reset          # Reset database to initial state
npm run sb:verify         # Verify connection and setup
npm run sb:test           # Test Supabase connection

# Database management
npm run migrate           # Run database migrations
npm run seed              # Seed database with test data
npm run db:reset          # Reset database (drop and recreate)
npm run db:tables         # List all tables
npm run db:sql            # Execute SQL queries interactively

# MCP Integration testing
node test-mcp-integration.js       # Test MCP database access
node validate-mcp-capabilities.js  # Validate MCP setup
```

### Linting and Formatting
```bash
cd infinity-storm-server
npm run lint             # Run ESLint checks
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without fixing
```

## High-Level Architecture

### Game Type
Infinity Storm is a Marvel-themed cascade slot game built with Phaser 3. It features Candy Crush-style matching mechanics where symbols drop from above and matching clusters of 8+ symbols create wins.

### Client Architecture
The game uses a **global window object pattern** for Phaser compatibility (NOT ES6 modules):
- **Phaser 3** game engine loaded globally via script tag
- **Scene System**: LoadingScene → MenuScene → GameScene
- **Managers**: GridManager (grid logic), WinCalculator (payout calculations), AnimationManager, UIManager, BurstModeManager, WinPresentationManager, OrientationManager
- **Services**: NetworkService (HTTP/WebSocket), GameAPI, WalletAPI, AuthAPI, CascadeAPI, DeviceDetectionService
- **Controllers**: OverlayController (mobile orientation overlay management)
- **Config**: GameConfig.js contains all game rules, RTP settings, symbol definitions, and payout tables
- **SafeSound**: Custom audio wrapper system that handles missing audio gracefully
- **Mobile Support**: Comprehensive mobile horizontal layout system with orientation management

### Server Architecture (infinity-storm-server/)
Production-ready Express + Socket.io server with casino-grade security:
- **Portal-First Authentication**: Secure web portal handles all authentication before game access
- **Static File Serving**: Serves the complete WebGL game client from parent directory
- **HTTP API**: RESTful endpoints (/api/spin, /api/game-state, /api/wallet) with comprehensive validation
- **WebSocket Support**: Real-time communication via Socket.io for game events and state updates
- **Game Engine**: Complete server-side implementation with GridEngine, WinCalculator, CascadeProcessor
- **Security**: Cryptographic RNG, JWT authentication, anti-cheat detection, audit logging
- **State Management**: Redis-backed session management with recovery and persistence
- **Database**: PostgreSQL with Sequelize ORM, complete model layer with relationships
- **Docker Support**: Full containerization with docker-compose for all services
- **MCP Integration**: Cursor MCP configured for Supabase database access at http://127.0.0.1:54321

### Key Game Mechanics
- **Grid**: 6 columns × 5 rows of symbols
- **Minimum Match**: 8 symbols of the same type (connected via flood-fill algorithm)
- **Cascading**: Matched symbols are removed, new ones drop from above
- **RTP**: 96.5% (configured in GameConfig.js)
- **Volatility**: HIGH
- **Max Win**: 5000x bet
- **Special Features**:
  - Free Spins (triggered by 4+ scatter symbols)
  - Random Multipliers (2x-500x, weighted table in RANDOM_MULTIPLIER.TABLE)
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
- Server-side validation in GridEngine.js

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
- **Server Authority**: All game logic validation happens server-side
- **Session-First**: Game requires valid session from portal before starting

#### Network Architecture
- **HTTP API**: axios-based client with interceptors for auth and error handling
- **WebSocket**: Socket.io for real-time events (spin_request/spin_result, balance_update)
- **Authentication**: JWT token validation via SessionService with automatic refresh
- **Error Handling**: 401 auth error handling, timeout configuration (10s), graceful fallbacks
- **Server Integration**: Complete game state synchronization with audit trail
- **Dual Mode**: Supports both server-connected mode and demo mode fallback

### File Organization
```
src/
├── config/         # GameConfig.js - all game settings
├── core/          # Symbol.js, GameStateManager.js
├── systems/       # GridManager.js, WinCalculator.js
├── managers/      # UI, Animation, BurstMode, FreeSpins, WinPresentation, OrientationManager
├── services/      # NetworkService, GameAPI, WalletAPI, AuthAPI, CascadeAPI, DeviceDetectionService
├── controllers/   # OverlayController for mobile UI management
├── scenes/        # Phaser scenes (Loading, Menu, Game)
├── effects/       # Visual effects (FireEffect, ThanosPowerGrip)
├── shaders/       # WebGL shaders
├── engine/        # Paytable, RNG, SymbolSource
├── models/        # SpinResult model
└── tools/         # MathSimulator for RTP validation

assets/
├── images/        # UI elements, symbols, backgrounds
├── sprites/       # Animated sequences for wins, characters
└── audio/         # Background music and sound effects

infinity-storm-server/
├── server.js         # Main Express + Socket.io server
├── game-logic/       # GridEngine.js - server-side cascade generation
├── src/
│   ├── auth/         # Authentication & JWT management
│   ├── config/       # Application configuration
│   ├── controllers/  # Express route controllers
│   ├── db/           # Database pool, migrations, CLI tools
│   ├── game/         # Game engine, RNG, state management
│   ├── middleware/   # Express middleware (auth, validation, rate limiting)
│   ├── models/       # Sequelize models (Player, Session, SpinResult, etc.)
│   ├── routes/       # Express route definitions
│   ├── services/     # Business logic services
│   ├── utils/        # Utility functions
│   └── websocket/    # WebSocket event handlers
├── tests/            # Jest test suites (cascade, smoke, websocket, integration)
├── docker/           # Docker configurations (Dockerfiles, nginx.conf)
├── supabase/         # Local Supabase configuration
├── scripts/          # Database and deployment scripts
├── docker-compose.yml # Complete service orchestration
└── package.json      # Server dependencies

tests/
├── integration/    # End-to-end integration tests
│   ├── EndToEndIntegration.test.js
│   ├── runIntegrationTests.js
│   ├── jest.config.js
│   └── package.json
└── mobile/        # Mobile-specific testing framework
    └── MobileTestSuite.js

docs/mobile/           # Mobile system documentation
├── MobileDeveloperGuide.md      # Comprehensive developer guide
├── MobileUserGuide.md           # End-user gameplay guide
├── MobileConfiguration.md       # Configuration and customization
├── MobileTroubleshooting.md     # Common issues and solutions
└── MobileDeployment.md          # Production deployment guide

Root files:
├── index.html             # Game entry point
├── start-server.js        # Simple static file server (port 3001)
├── run-game.ps1           # PowerShell launcher script
├── package.json           # Client dependencies (phaser, axios, socket.io-client)
├── test-animations.html   # Animation testing utility
├── test-rng-security.html # RNG security testing
├── test-mobile.html       # Mobile testing utility (orientation, touch)
├── specs/                 # Feature specifications and task tracking
└── .cursor/mcp.json       # MCP configuration for Supabase integration
```

### Testing & Debugging
- **Browser Console**: `window.game` provides access to Phaser game instance
- **Animation Testing**: test-animations.html for sprite debugging
- **RNG Security Testing**: test-rng-security.html for RNG validation
- **Mobile Testing**: test-mobile.html for mobile orientation and touch testing
- **Math Validation**: src/tools/MathSimulator.js for RTP testing
- **Network Testing**: Server provides /api/health endpoint
- **Global Objects**: All game classes attached to window (GridManager, NetworkService, OrientationManager, etc.)
- **Mobile Debug**: DeviceDetectionService.debug(), OrientationManager.getState(), OverlayController.debug()
- **Chrome DevTools**: Mobile emulation with device rotation testing (Ctrl+Shift+M)
- **Symbol Pool**: GridManager includes symbol recycling for performance
- **Development**: No build step required - direct browser loading with script tags
- **Test Suites**: Jest tests for cascade logic, API endpoints, WebSocket events, comprehensive mobile testing
- **Coverage Requirements**: 70% threshold for branches, functions, lines, statements
- **Test Timeout**: 30 seconds for end-to-end and performance tests

### Current Development State
- **Architecture**: Portal-first casino architecture with secure authentication flow
- **Game Logic**: Complete server-side implementation with anti-cheat and audit systems
- **State Management**: Redis-backed session management with disconnection recovery
- **Database**: Full PostgreSQL schema with Sequelize models and relationships
- **Authentication**: Complete JWT session validation and refresh system implemented
- **Testing**: Comprehensive Jest test suites covering all game logic and API integration
- **Docker**: Full containerization with orchestrated services (PostgreSQL, Redis, Nginx)
- **Client Integration**: Dual-mode support (server-connected and demo fallback)
- **Mobile Support**: Complete horizontal layout system with orientation management, device detection, and touch optimization
- **Admin Panel**: Basic admin interface with player management and metrics dashboard at /admin
- **MCP Support**: Cursor MCP integration configured for direct database access

## Code Style and Standards

### Server-Side (infinity-storm-server/)
- **ESLint Configuration**: Uses @eslint/js recommended with custom rules
- **Style**: Single quotes, no trailing commas, 2-space indentation, 100-char line limit
- **Testing**: Jest with 30-second timeout, 70% coverage threshold
- **Format**: Prettier with single quotes, no trailing semicolons
- **Dependencies**: Production-grade packages (express, socket.io, sequelize, redis)
- **Node Version**: Requires Node.js >= 18.0.0

### Client-Side (src/)
- **Pattern**: Global window object pattern for Phaser compatibility (NOT ES6 modules)
- **Naming**: Symbol IDs match asset filenames exactly (use underscores, not camelCase)
- **Audio**: SafeSound wrapper for graceful missing audio handling
- **Config**: All game rules, RTP settings, and payouts defined in GameConfig.js
- **State**: GameStateManager handles all game state transitions and validation

## Development Patterns

### Portal-First Security Model
The game follows casino-grade security with portal-first authentication:
1. Players authenticate on secure web portal (separate from game)
2. Portal generates time-limited session tokens
3. Game client receives pre-validated sessions (no in-game login)
4. All game operations validated server-side with anti-cheat detection

### Server Authority Pattern
- All game logic validation happens server-side
- Client displays results from server (never calculates wins locally)
- Server maintains authoritative game state with audit trail
- Anti-cheat system monitors for suspicious patterns and automation

### Dual-Mode Architecture
- Game supports both server-connected and demo modes
- Automatic fallback to demo mode if server unavailable
- Identical user experience regardless of mode
- `SERVER_MODE` configuration controls integration level

## Key Implementation Notes

### Critical Paths
- Session validation must complete before any game operations
- All financial operations require server validation and audit logging
- RNG operations use crypto.randomBytes for casino-grade security
- Database operations use connection pooling and transactions

### Testing Strategy
- Unit tests for individual game logic components
- Integration tests for complete game workflows  
- Performance tests for concurrent user scenarios
- RTP validation maintains 96.5% target within statistical variance

### Deployment Considerations
- Docker Compose orchestrates all services (game, portal, database, cache)
- Environment-specific configuration via .env files
- Health checks for all services with proper dependency management
- Complete audit logging for regulatory compliance

### Environment Variables
Key configuration in infinity-storm-server/.env:
- **Database**: DATABASE_URL, DB_HOST, DB_PORT, DB_NAME
- **Redis**: REDIS_URL, REDIS_HOST, REDIS_PORT (optional, fallback to memory)
- **Authentication**: JWT_SECRET, SESSION_SECRET
- **Game Settings**: MIN_BET, MAX_BET, DEFAULT_CREDITS
- **Security**: BCRYPT_ROUNDS, RATE_LIMIT_MAX_REQUESTS
- **Supabase**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

### MCP Database Access
When using Cursor with MCP enabled, you can directly query the Supabase database:
- Tables: players, sessions, game_states, spin_results, transactions, jackpots
- Use natural language queries for data analysis
- See infinity-storm-server/MCP_INTEGRATION_GUIDE.md for examples

## Mobile Development

### Mobile Architecture Overview
Infinity Storm features a comprehensive mobile horizontal layout system that ensures optimal gameplay experience on mobile devices by enforcing landscape orientation.

### Key Mobile Components
- **DeviceDetectionService**: Multi-method device and capability detection
- **OrientationManager**: Handles orientation changes with debouncing and game state management
- **OverlayController**: Manages orientation overlay UI with smooth CSS animations
- **MobileTestSuite**: Comprehensive testing framework for mobile functionality

### Mobile Development Commands
```bash
# Mobile testing and development
# Open test-mobile.html in browser for interactive mobile testing
# Use Chrome DevTools device emulation (Ctrl+Shift+M)

# Debug mobile systems in browser console
deviceDetection.debug()                    # Device info and capabilities
orientationManager.getState()              # Current orientation state
overlayController.debug()                  # Overlay state and DOM info

# Mobile test suite (in browser console)
const testSuite = new MobileTestSuite();
testSuite.init();
await testSuite.runAllTests();            # Comprehensive mobile testing

# Specific test categories
await testSuite.runDeviceDetectionTests(); # Device detection accuracy
await testSuite.runOrientationTests();     # Orientation handling
await testSuite.runTouchInputTests();      # Touch interaction validation
await testSuite.runPerformanceTests();     # Mobile performance metrics
```

### Mobile Testing Strategy
1. **Device Detection**: Verify accurate mobile/tablet identification across browsers
2. **Orientation Handling**: Test orientation change detection and overlay management
3. **Touch Input**: Validate touch events and gesture recognition
4. **Performance**: Monitor frame rates, memory usage, and response times
5. **Cross-Browser**: Ensure compatibility across mobile browsers
6. **Edge Cases**: Handle rapid orientation changes, missing DOM, network issues

### Mobile Browser Support
- **Tier 1**: Chrome Mobile 70+, Safari iOS 12+, Firefox Mobile 68+, Samsung Internet 10+
- **Tier 2**: Edge Mobile 79+, Opera Mobile 60+, UC Browser 13+
- **Legacy**: Graceful degradation for older browsers with fallback functionality

### Mobile Configuration
Key mobile settings in GameConfig.js:
- Orientation enforcement (portrait → landscape overlay)
- Touch target size validation (minimum 44px)
- Performance optimization settings
- Device-specific optimizations

### Mobile Documentation
Comprehensive mobile documentation available in docs/mobile/:
- **MobileDeveloperGuide.md**: Complete developer reference
- **MobileUserGuide.md**: End-user gameplay instructions
- **MobileConfiguration.md**: Customization options and settings
- **MobileTroubleshooting.md**: Common issues and debugging
- **MobileDeployment.md**: Production deployment considerations