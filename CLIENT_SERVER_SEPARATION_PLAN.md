# Client-Server Separation Plan for Infinity Storm

## Overview
This document outlines the plan to transform Infinity Storm from a client-side game to a true client-server architecture where the server handles all game logic, RNG, and win calculations while the client focuses purely on presentation.

## Current Architecture Issues
- **Client-side RNG**: Symbol generation happens in browser (security risk)
- **Client-side win calculation**: Payouts calculated locally (can be manipulated)
- **Client-side game state**: Balance and game progress stored locally
- **No server validation**: All game decisions made client-side

## Target Architecture

### Server Responsibilities
1. **Random Number Generation**
   - Generate initial grid symbols
   - Generate cascade replacement symbols
   - Determine random multiplier positions and values
   - Free spins trigger determination

2. **Game Logic**
   - Win detection and cluster matching
   - Cascade physics simulation
   - Payout calculations
   - Balance management
   - Free spins logic
   - Burst mode triggers

3. **State Management**
   - Player session state
   - Current grid state
   - Balance tracking
   - Free spins remaining
   - Accumulated multipliers

### Client Responsibilities
1. **Presentation Only**
   - Display grid symbols from server
   - Animate cascades based on server instructions
   - Show win animations
   - Update UI elements (balance, bet, wins)
   - Handle user input (spin button, bet adjustment)
   - Play sounds and music

2. **No Game Logic**
   - No symbol generation
   - No win calculation
   - No balance modification
   - Only visual state management

## Critical Animation Timings to Preserve

The following client timings MUST be preserved server-side to maintain visual fidelity:

### Core Animation Timings (from GameConfig.js)
```javascript
CASCADE_SPEED: 300,              // Base cascade drop speed (ms)
SYMBOL_DROP_TIME: 200,           // Individual symbol drop animation (ms)
SYMBOL_DESTROY_TIME: 300,        // Symbol removal animation (ms)
WIN_CELEBRATION_TIME: 2000,      // Win celebration display (ms)
MULTIPLIER_APPEAR_TIME: 500,     // Multiplier appearance animation (ms)
RANDOM_MULTIPLIER_ANIMATION: 2000, // Thanos power grip animation (ms)
```

### Dynamic Timing Calculations
```javascript
// Drop timing with gravity effect (GridManager.js)
dropDuration: CASCADE_SPEED + (emptyRowsAbove * 100)  // Adds 100ms per empty row

// Quick spin mode adjustments (GameScene.js)
quickSpinDuration: Math.max(150, CASCADE_SPEED * 0.6)  // 60% speed, minimum 150ms

// Win presentation timings (WinPresentationManager.js)
winScaleIn: 500,                // Win text scale in (ms)
winPulse: 500,                   // Win text pulse effect (ms)
winScaleOut: 500,                // Win text scale out (ms)
smallWinDisplay: 2500,           // Small/Medium/Big win display (ms)
legendaryWinDisplay: 4500,       // Legendary win display (ms)
freeSpinsComplete: 14000,        // Free spins complete screen (ms)
moneyParticleInterval: 120,      // Money particle spawn interval (ms)
```

### Additional UI Timings
```javascript
spinButtonCooldown: 500,         // Spin button cooldown (ms)
stateCheckInterval: 500,         // Free spins state check (ms)
winPresentationDelay: 300,       // Delay before win presentation (ms)
autoSkipDelay: 7000,            // Time before skip button appears (ms)
```

## Implementation Plan

### Phase 1: Server API Design
Create REST/WebSocket endpoints that return complete game state WITH TIMING DATA:

```javascript
// Spin Request
POST /api/game/spin
{
  "sessionId": "xxx",
  "betAmount": 1.00
}

// Spin Response (WITH TIMING DATA)
{
  "success": true,
  "spinId": "spin_123",
  "quickSpinMode": false,  // Affects animation speeds
  "initialGrid": [
    ["time_gem", "space_gem", "mind_gem", "power_gem", "reality_gem"],
    ["soul_gem", "time_gem", "thanos", "scarlet_witch", "thanos_weapon"],
    // ... 6 columns × 5 rows
  ],
  "cascades": [
    {
      "cascadeNumber": 1,
      "timing": {
        "startDelay": 0,                    // When to start this cascade (ms)
        "destroyDuration": 300,              // Symbol destruction animation (ms)
        "dropDuration": 300,                 // Base drop duration (ms)
        "dropDelayPerRow": 100,              // Additional drop time per empty row (ms)
        "winPresentationDelay": 300,         // Delay before showing wins (ms)
        "totalDuration": 900                 // Total cascade duration (ms)
      },
      "matches": [
        {
          "symbol": "time_gem",
          "positions": [[0,0], [0,1], [1,0], [1,1], [1,2], [2,0], [2,1], [2,2]],
          "payout": 2.50,
          "multiplier": 1,
          "animationKey": "gem_explode",    // Animation to play
          "effectTiming": 300                // Effect duration (ms)
        }
      ],
      "removedPositions": [[0,0], [0,1], [1,0], [1,1], [1,2], [2,0], [2,1], [2,2]],
      "newSymbols": [
        {
          "position": [0,0], 
          "symbol": "space_gem",
          "dropFromRow": -3,                 // Start position (negative = above grid)
          "emptyRowsBelow": 3,               // For gravity calculation
          "dropTiming": 600                  // Calculated: 300 + (3 * 100)
        },
        {"position": [0,1], "symbol": "mind_gem", "dropFromRow": -2, "emptyRowsBelow": 2, "dropTiming": 500},
        // ... new symbols with individual drop timings
      ],
      "gridAfterCascade": [/* complete grid state */]
    }
    // ... more cascades with timing
  ],
  "winPresentation": {
    "category": "BIG",                      // SMALL, MEDIUM, BIG, MEGA, EPIC, LEGENDARY
    "animationKey": "win_02",               // Which win animation to play
    "displayDuration": 2500,                // How long to show (ms)
    "scaleInDuration": 500,                 // Scale in animation (ms)
    "pulseEffect": true,                    // Whether to pulse
    "moneyParticles": false                 // Only for LEGENDARY wins
  },
  "totalWin": 125.50,
  "balance": 874.50,
  "freeSpinsTriggered": false,
  "freeSpinsRemaining": 0,
  "randomMultipliers": [
    {
      "position": [2,3], 
      "value": 5,
      "appearTiming": 500,                  // When to show multiplier (ms)
      "animationDuration": 2000             // Thanos grip animation (ms)
    },
    {"position": [4,1], "value": 10, "appearTiming": 500, "animationDuration": 2000}
  ],
  "totalSpinDuration": 4500                 // Total expected spin duration (ms)
}
```

### Phase 2: Client Modifications

#### 2.1 GridManager Changes
- Remove `createRandomSymbol()` method
- Remove `generateInitialGrid()` logic
- Add `loadGridFromServer(gridData)` method
- Add `applyCascadeFromServer(cascadeData)` method

#### 2.2 WinCalculator Changes
- Remove all calculation methods
- Replace with `displayWinFromServer(winData)` method
- Keep only win presentation/animation logic

#### 2.3 GameScene Changes
```javascript
// OLD: Client-side spin
async handleSpin() {
  this.gridManager.generateInitialGrid();
  const matches = this.findMatches();
  const win = this.winCalculator.calculate(matches);
  this.balance -= this.betAmount;
  this.balance += win;
}

// NEW: Server-side spin
async handleSpin() {
  const response = await this.gameAPI.spin(this.betAmount);
  await this.displaySpinResult(response);
}

async displaySpinResult(serverData) {
  // Display initial grid
  await this.gridManager.loadGridFromServer(serverData.initialGrid);
  
  // Set animation speed mode
  if (serverData.quickSpinMode) {
    this.enableQuickSpin();
  }
  
  // Process each cascade sequentially WITH SERVER TIMING
  for (const cascade of serverData.cascades) {
    const timing = cascade.timing;
    
    // Wait for cascade start delay if specified
    if (timing.startDelay > 0) {
      await this.delay(timing.startDelay);
    }
    
    // Display matches with server-specified effect timing
    await this.displayMatches(cascade.matches, timing.destroyDuration);
    
    // Animate removals using server timing
    await this.animateRemovals(cascade.removedPositions, timing.destroyDuration);
    
    // Animate cascade with individual symbol drop timings
    await this.animateCascadeWithTiming(cascade.newSymbols);
    
    // Wait before showing wins (server-controlled delay)
    if (timing.winPresentationDelay > 0) {
      await this.delay(timing.winPresentationDelay);
    }
    
    // Display wins with proper timing
    await this.displayWins(cascade.matches);
  }
  
  // Show win presentation if needed (using server timing)
  if (serverData.winPresentation) {
    await this.showWinPresentation(serverData.winPresentation);
  }
  
  // Handle random multipliers with server timing
  if (serverData.randomMultipliers?.length > 0) {
    await this.showRandomMultipliers(serverData.randomMultipliers);
  }
  
  // Update final state
  this.updateBalance(serverData.balance);
  this.updateTotalWin(serverData.totalWin);
}

// New method to handle symbols with individual drop timings
async animateCascadeWithTiming(newSymbols) {
  const dropPromises = newSymbols.map(symbolData => {
    return this.dropSymbol(
      symbolData.position,
      symbolData.symbol,
      symbolData.dropFromRow,
      symbolData.dropTiming  // Use server-calculated timing
    );
  });
  
  // Wait for all symbols to finish dropping
  await Promise.all(dropPromises);
}
```

#### 2.4 NetworkService Changes
- Enhance error handling for network failures
- Add retry logic for failed requests
- Implement request queuing
- Add connection state management

### Phase 3: Data Flow

```
User clicks SPIN
    ↓
Client validates bet amount
    ↓
Client sends spin request to server
    ↓
Server generates random grid
    ↓
Server calculates all cascades
    ↓
Server calculates total win
    ↓
Server updates balance
    ↓
Server returns complete spin result
    ↓
Client plays animations in sequence
    ↓
Client updates UI with final values
```

### Phase 4: Security Considerations

1. **Server-side validation**
   - Validate session tokens
   - Verify bet amounts
   - Check balance sufficiency
   - Rate limiting per player

2. **Encrypted communication**
   - Use HTTPS for all API calls
   - Implement request signing
   - Add replay attack prevention

3. **State verification**
   - Server maintains authoritative state
   - Client state is display-only
   - Regular state synchronization

### Phase 5: Files to Modify

#### High Priority (Core Logic)
- `src/systems/GridManager.js` - Remove generation, add server data loading
- `src/systems/WinCalculator.js` - Remove calculations, keep only display
- `src/scenes/GameScene.js` - Replace game logic with API calls
- `src/managers/BurstModeManager.js` - Trigger from server data only
- `src/managers/FreeSpinsManager.js` - Display server-determined free spins

#### Medium Priority (Support Systems)
- `src/services/GameAPI.js` - Enhance with new endpoints
- `src/services/NetworkService.js` - Add robust error handling
- `src/core/GameStateManager.js` - Sync with server state
- `src/managers/AnimationManager.js` - Ensure animations match server timing

#### Low Priority (Display Only)
- `src/managers/UIManager.js` - Already display-only
- `src/managers/WinPresentationManager.js` - Already display-only
- `src/effects/*` - Visual effects remain client-side

### Phase 6: Server Implementation Requirements

The server must implement:
1. **Cryptographically secure RNG**
2. **Complete cascade simulation WITH TIMING**
   - Calculate drop timing based on empty rows (CASCADE_SPEED + emptyRows * 100)
   - Track symbol destruction timing (SYMBOL_DESTROY_TIME)
   - Calculate total cascade duration for each phase
3. **Accurate payout calculations**
4. **Transaction-safe balance updates**
5. **Complete game state tracking**
6. **Audit logging for all spins INCLUDING TIMING DATA**
7. **Timing Configuration Management**
   ```javascript
   // Server-side timing configuration (must match client)
   const TIMING_CONFIG = {
     CASCADE_SPEED: 300,
     SYMBOL_DROP_TIME: 200,
     SYMBOL_DESTROY_TIME: 300,
     WIN_CELEBRATION_TIME: 2000,
     MULTIPLIER_APPEAR_TIME: 500,
     DROP_DELAY_PER_ROW: 100,
     QUICK_SPIN_FACTOR: 0.6,
     MIN_QUICK_SPIN_DURATION: 150
   };
   ```

### Phase 7: Testing Strategy

1. **Unit Tests**
   - Server RNG distribution
   - Payout calculation accuracy
   - Cascade logic correctness
   - Timing calculation accuracy

2. **Integration Tests**
   - Client-server communication
   - Animation synchronization
   - Error recovery
   - **Timing Verification Tests**
     ```javascript
     // Test that server timing matches client expectations
     test('cascade timing matches client config', async () => {
       const serverResponse = await api.spin(1.00);
       const cascade = serverResponse.cascades[0];
       
       // Verify base timing
       expect(cascade.timing.dropDuration).toBe(300); // CASCADE_SPEED
       expect(cascade.timing.destroyDuration).toBe(300); // SYMBOL_DESTROY_TIME
       
       // Verify gravity calculation
       const symbolWithGravity = cascade.newSymbols[0];
       const expectedTiming = 300 + (symbolWithGravity.emptyRowsBelow * 100);
       expect(symbolWithGravity.dropTiming).toBe(expectedTiming);
     });
     ```

3. **Security Tests**
   - Attempt client-side manipulation
   - Network tampering detection
   - Session hijacking prevention

4. **Visual Fidelity Tests**
   - Record client animations with current timing
   - Compare with server-driven animations
   - Ensure no visual differences or missing effects
   - Validate all FX trigger at correct times

### Phase 8: Rollback Plan

Maintain the current client-side logic behind feature flags during transition:
```javascript
if (FEATURE_FLAGS.useServerLogic) {
  return await this.gameAPI.spin(betAmount);
} else {
  return this.clientSideSpinLogic(betAmount);
}
```

## Timeline Estimate

- **Phase 1-2**: 2-3 days (API design and client prep)
- **Phase 3-4**: 3-4 days (implementation and security)
- **Phase 5-6**: 4-5 days (server logic implementation)
- **Phase 7**: 2-3 days (testing)
- **Total**: ~2-3 weeks for complete migration

## Success Criteria

1. All game logic executes on server
2. Client cannot manipulate game outcomes
3. Animations remain smooth and synchronized
4. No degradation in user experience
5. Complete audit trail of all game actions
6. RTP remains at configured 96.5%

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Network latency affects gameplay | Pre-fetch next spin while animating current |
| Server load during cascades | Pre-calculate all cascades in single operation |
| Animation desync | Include timing data in server response |
| Connection drops mid-spin | Store spin result, resume on reconnect |
| Client-side tampering | Server validates all requests, ignores client state |