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

## Implementation Plan

### Phase 1: Server API Design
Create REST/WebSocket endpoints that return complete game state:

```javascript
// Spin Request
POST /api/game/spin
{
  "sessionId": "xxx",
  "betAmount": 1.00
}

// Spin Response
{
  "success": true,
  "spinId": "spin_123",
  "initialGrid": [
    ["time_gem", "space_gem", "mind_gem", "power_gem", "reality_gem"],
    ["soul_gem", "time_gem", "thanos", "scarlet_witch", "thanos_weapon"],
    // ... 6 columns × 5 rows
  ],
  "cascades": [
    {
      "cascadeNumber": 1,
      "matches": [
        {
          "symbol": "time_gem",
          "positions": [[0,0], [0,1], [1,0], [1,1], [1,2], [2,0], [2,1], [2,2]],
          "payout": 2.50,
          "multiplier": 1
        }
      ],
      "removedPositions": [[0,0], [0,1], [1,0], [1,1], [1,2], [2,0], [2,1], [2,2]],
      "newSymbols": [
        {"position": [0,0], "symbol": "space_gem"},
        {"position": [0,1], "symbol": "mind_gem"},
        // ... new symbols that drop in
      ],
      "gridAfterCascade": [/* complete grid state */]
    }
    // ... more cascades
  ],
  "totalWin": 125.50,
  "balance": 874.50,
  "freeSpinsTriggered": false,
  "freeSpinsRemaining": 0,
  "randomMultipliers": [
    {"position": [2,3], "value": 5},
    {"position": [4,1], "value": 10}
  ]
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
  
  // Process each cascade sequentially
  for (const cascade of serverData.cascades) {
    await this.displayMatches(cascade.matches);
    await this.animateRemovals(cascade.removedPositions);
    await this.animateCascade(cascade.newSymbols);
    await this.displayWins(cascade.matches);
  }
  
  // Update final state
  this.updateBalance(serverData.balance);
  this.updateTotalWin(serverData.totalWin);
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
2. **Complete cascade simulation**
3. **Accurate payout calculations**
4. **Transaction-safe balance updates**
5. **Complete game state tracking**
6. **Audit logging for all spins**

### Phase 7: Testing Strategy

1. **Unit Tests**
   - Server RNG distribution
   - Payout calculation accuracy
   - Cascade logic correctness

2. **Integration Tests**
   - Client-server communication
   - Animation synchronization
   - Error recovery

3. **Security Tests**
   - Attempt client-side manipulation
   - Network tampering detection
   - Session hijacking prevention

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