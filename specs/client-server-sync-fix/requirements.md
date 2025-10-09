# Server-Client Separation Completion Requirements

## Executive Summary
This document defines the comprehensive requirements for completing the server-client separation of the Infinity Storm casino game, focusing on moving ALL game logic to the server while maintaining identical visual presentation and preventing race conditions between server calculations and client animations.

## Current State Analysis

### What's Already Implemented
1. **Server Infrastructure**: Docker environment, PostgreSQL database, Sequelize models
2. **Authentication System**: Portal-first authentication with JWT session management
3. **Game Engine Components**: Server-side game logic partially implemented
4. **Unified RNG**: SHA256-based deterministic RNG system (UnifiedRNG class)
5. **Grid Renderer**: Client-side GridRenderer for display-only operations
6. **Checksum System**: Canonical JSON checksum verification

### What Needs Completion
1. **Full Server Authority**: Complete migration of ALL game logic to server
2. **Race Condition Prevention**: Synchronization between server calculations and client animations
3. **Cascade Data Structure**: Proper cascade result format for client consumption
4. **State Management**: Server-authoritative game state with client display sync
5. **Error Recovery**: Handling network interruptions and state recovery

## Functional Requirements

### FR-1: Server-Authoritative Game Logic

**FR-1.1: Complete RNG Migration**
- **WHEN** generating any random outcome in the game
- **THEN** the server SHALL use the SHA256-based UnifiedRNG exclusively
- **AND** the server SHALL generate a cryptographic seed for each spin
- **AND** the server SHALL include the seed in the response for validation
- **AND** NO random number generation SHALL occur on the client

**FR-1.2: Grid Generation**
- **WHEN** a spin is initiated
- **THEN** the server SHALL generate the complete initial 6x5 grid
- **AND** the server SHALL use weighted probability tables from GameConfig
- **AND** the server SHALL ensure deterministic results from the same seed
- **AND** the client SHALL only display the server-provided grid

**FR-1.3: Cascade Processing**
- **WHEN** processing cascades after initial grid or previous cascade
- **THEN** the server SHALL calculate all symbol removals
- **AND** the server SHALL simulate gravity-based dropping
- **AND** the server SHALL generate new symbols for empty positions
- **AND** the server SHALL continue until no new wins are found
- **AND** the server SHALL provide complete cascade sequence to client

**FR-1.4: Win Calculations**
- **WHEN** evaluating any grid state for wins
- **THEN** the server SHALL use flood-fill algorithm for cluster detection
- **AND** the server SHALL calculate payouts using exact payout tables
- **AND** the server SHALL apply all multipliers server-side
- **AND** the client SHALL NOT perform any win calculations

### FR-2: Client Display Requirements

**FR-2.1: Animation-Only Client**
- **WHEN** receiving server spin results
- **THEN** the client SHALL animate the exact server-provided sequence
- **AND** the client SHALL maintain 60 FPS smooth animations
- **AND** the client SHALL preserve all existing visual effects
- **AND** the client SHALL NOT modify game outcomes

**FR-2.2: Cascade Animation Sequencing**
- **WHEN** animating cascades from server data
- **THEN** the client SHALL play animations in exact server order
- **AND** the client SHALL maintain timing for:
  - Symbol highlight: 500ms
  - Symbol removal: 300ms
  - Symbol drop: 400ms
  - New symbol appearance: 200ms
- **AND** the client SHALL queue animations to prevent overlap

**FR-2.3: State Display Synchronization**
- **WHEN** displaying game state
- **THEN** the client SHALL show server-provided balance only
- **AND** the client SHALL update UI elements from server data
- **AND** the client SHALL NOT calculate or predict state changes

### FR-3: Race Condition Prevention

**FR-3.1: Cascade Data Structure**
- **FOR** each cascade in the sequence
- **THEN** the server SHALL provide:
  ```typescript
  interface CascadeStep {
    stepIndex: number;
    gridBefore: Symbol[][];
    winningClusters: Cluster[];
    symbolsToRemove: Position[];
    gridAfterRemoval: Symbol[][];
    droppingSymbols: DropAnimation[];
    newSymbols: NewSymbol[];
    gridAfterDrop: Symbol[][];
    winAmount: number;
    multipliers: Multiplier[];
    totalWinSoFar: number;
  }
  ```

**FR-3.2: Animation Synchronization Protocol**
- **WHEN** client receives spin result
- **THEN** the client SHALL:
  1. Lock input (prevent new spins)
  2. Display initial grid instantly
  3. For each cascade step:
     - Highlight winning clusters
     - Remove symbols with effects
     - Animate drops using provided paths
     - Reveal new symbols
     - Validate grid matches server state
  4. Update balance and UI
  5. Unlock input

**FR-3.3: State Validation Checkpoints**
- **AFTER** each cascade animation completes
- **THEN** the client SHALL verify grid state matches server
- **AND** IF mismatch detected
- **THEN** client SHALL snap to server state
- **AND** client SHALL log validation error

### FR-4: Network & Communication

**FR-4.1: Spin Request/Response Contract**
```typescript
interface SpinRequest {
  sessionId: string;
  betAmount: number;
  timestamp: number;
  clientVersion: string;
}

interface SpinResponse {
  spinId: string;
  seed: string;
  initialGrid: Symbol[][];
  cascadeSteps: CascadeStep[];
  totalWin: number;
  finalBalance: number;
  checksum: string;
  serverTimestamp: number;
  rngDrawCount: number;
  processingTimeMs: number;
}
```

**FR-4.2: Network Resilience**
- **IF** network connection lost during spin
- **THEN** server SHALL complete and store result
- **AND** client SHALL show "reconnecting" overlay
- **AND** upon reconnection client SHALL retrieve result
- **AND** client SHALL resume from last animated state

**FR-4.3: Response Time Requirements**
- **FOR** spin request processing
- **THEN** server SHALL respond within:
  - p50: 100ms
  - p95: 500ms
  - p99: 1000ms
- **AND** client SHALL show loading indicator after 200ms

## Non-Functional Requirements

### NFR-1: Performance
- Client animation frame rate: 60 FPS minimum
- Server processing time: <100ms for cascade calculation
- Memory usage: No memory leaks during extended play
- Network payload: <50KB per spin response (compressed)

### NFR-2: Consistency
- 100% match rate between server calculations and client display
- Deterministic results from same seed across environments
- Identical visual experience to current client-only version
- No perceivable delay in animation smoothness

### NFR-3: Security
- All RNG on server with cryptographic security
- No game logic exposed to client
- Checksum validation on every spin
- Audit trail for all game operations

### NFR-4: Compatibility
- Support for all existing game features
- Backward compatibility during migration
- Feature flag for rollback capability
- Support for demo mode without server

### NFR-5: Single-Port Policy (Portal-First)
- All test/play environments MUST serve the client and API from port `3000` (same-origin) to align with portal-first authorization.
- No component may listen on or reference port `3001`.
- WebSocket client script MUST be available via `/socket.io/socket.io.js` when served from the server.

### NFR-6: API Contract Uniformity
- HTTP and WebSocket responses MUST use the same canonical SpinResult schema.
- Field names and cascade step structures MUST be consistent across all server modules and client consumers.

## Technical Constraints

### TC-1: Implementation Constraints
- Use existing UnifiedRNG SHA256 implementation
- Maintain Phaser 3 window global pattern
- Preserve exact animation timings
- No modifications to existing visual assets

### TC-2: Architecture Constraints
- Server must be stateless (except session)
- Client must not have game logic
- All calculations must be deterministic
- Must support 100 concurrent players

### TC-3: Same-Origin Networking
- Client assets SHALL be served by the game server to enforce same-origin for HTTP and WS.
- CORS allowlists SHALL exclude port `3001` and include only portal origins and `http://localhost:3000` for local.

## Migration Strategy Requirements

### MS-1: Phased Rollout
- **Phase 1**: Parallel validation mode (both systems run)
- **Phase 2**: Server-authoritative with client validation
- **Phase 3**: Full server-only mode
- **Rollback**: Feature flag to revert to client-only

### MS-2: Testing Requirements
- 100,000 spin validation test
- Cross-browser compatibility verification
- Load testing with 100 concurrent users
- Animation performance profiling
- Single-port verification: automated check that client loads from `http://localhost:3000` and WS handshake succeeds on the same origin.

### MS-3: Monitoring Requirements
- Real-time mismatch detection
- Performance metrics dashboard
- Error rate tracking
- Automatic alerting on anomalies

## Acceptance Criteria

### AC-1: Functional Acceptance
- [ ] Server generates all random outcomes
- [ ] Client displays exact server results
- [ ] No client-side game calculations
- [ ] Cascades animate in correct sequence
- [ ] Balance updates match server exactly
- [ ] Network interruption recovery works
- [ ] Checksum validation passes 100%

### AC-2: Performance Acceptance
- [ ] 60 FPS maintained during animations
- [ ] Server response <500ms p95
- [ ] No memory leaks after 1000 spins
- [ ] Smooth animation with no stuttering

### AC-3: Quality Acceptance
- [ ] 100% synchronization rate
- [ ] Zero critical bugs in production
- [ ] RTP maintains 96.5% target
- [ ] All existing features working

## Risk Mitigation

### Risk 1: Animation Timing Mismatches
- **Mitigation**: Implement animation queue with precise timing control
- **Validation**: Frame-by-frame animation testing
- **Fallback**: Snap-to-position on timing drift

### Risk 2: Network Latency Impact
- **Mitigation**: Optimistic UI updates with rollback
- **Validation**: Network simulation testing
- **Fallback**: Show loading state for slow responses

### Risk 3: State Synchronization Errors
- **Mitigation**: Checkpoints after each cascade
- **Validation**: Automated state comparison
- **Fallback**: Force refresh on critical mismatch

## Success Metrics

1. **Synchronization Rate**: 100% match between server and client
2. **Performance Impact**: <5% increase in perceived latency
3. **Animation Quality**: Zero dropped frames during normal play
4. **Error Rate**: <0.01% state mismatch rate
5. **Player Experience**: No negative feedback on gameplay feel
