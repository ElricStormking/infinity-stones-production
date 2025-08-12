## Client → Server Refactor Prep Plan (Infinity Storm)

This document captures the concrete plan to separate game math/RNG from client visuals/timing, and to prepare for a later server implementation. No server code is added yet; the client continues to function exactly as before.

### Objectives
- Keep all client visuals/timing/SFX identical.
- Move all randomness and math into pure, deterministic modules (no Phaser, no DOM).
- Produce a deterministic "spin plan" (data) that the client consumes to animate.
- Make it trivial later to swap local engine with a server endpoint returning the same plan.

### What is already in the client (done)
- Added pure engine primitives:
  - `src/engine/RNG.js` — deterministic RNG facade (seedable via `?seed=...`).
  - `src/engine/Paytable.js` — read-only accessors over `window.GameConfig`.
  - `src/engine/SymbolSource.js` — centralized symbol generation using RNG + paytable.
- `index.html` now loads the engine primitives and bootstraps `window.__symbolSource`.
- `src/systems/GridManager.js` prefers the injected `symbolProvider` for all new symbol rolls, preserving all the tween timing/visuals.

### Next client steps (no server yet)
- New pure logic modules (no Phaser):
  - `src/engine/contracts.js`
    - SpinInput: `{ bet:number, state:{balance:number, freeSpins:{active:boolean,count:number,acc:number}}, config:GameConfigLike, seed?:string }`
    - SpinPlan: `{ phases:[{grid:string[][], matches:Array<Array<{col,row}>>, win:number, rm?:{applied:number}, fs?:{triggered:boolean,retrigger:boolean,newCount?:number}}], totalWin:number }`
  - `src/engine/SpinEngine.js`
    - Implements deterministic spin: build grid → detect matches (>= MIN_MATCH_COUNT) → remove/cascade/refill → repeat → apply RM/CRM and FS triggers using config + RNG.
  - `src/engine/serialize.js` (optional)
    - Hash config, snapshot/rehydrate SpinInput/SpinPlan for QA.
- Thin client adapter:
  - `src/engine/ClientOrchestrator.js`
    - Input: `SpinPlan`.
    - For each phase, set a scripted grid into `GridManager` and then call the existing animation flow (`clearGridWithAnimation`, `fillGridWithCascade`, etc.).
    - Calls visual-only hooks on Bonus/FS managers (no RNG there).
- Minimal edits to current files (keep timings intact):
  - `src/systems/GridManager.js`
    - Already supports `symbolProvider`. Add `setScriptedGrid(matrix)` later so fills use the scripted outcome per phase.
  - `src/scenes/GameScene.js`
    - Build `SpinInput` from state + `GameConfig`, call `SpinEngine.generateSpinPlan(...)` (local), then `ClientOrchestrator.play(plan)` to animate.
  - `src/systems/WinCalculator.js`
    - Either folded into the engine or used by it. Client should not compute wins on its own paths after the change.
  - `src/managers/BonusManager.js`, `src/managers/FreeSpinsManager.js`
    - Move math decisions into the engine; keep visuals (overlays, counters, sounds).
  - `src/tools/MathSimulator.js`
    - Swap to use `SpinEngine` for 1:1 parity with play.

### Flags & determinism
- `?seed=demo` — seed RNG for reproducible sessions.
- `?engine=1` — (optional) feature flag if we need a guarded rollout before removing the legacy RNG path.

### Server files (future placement; do not implement yet)
```
infinity-storm-server/
  src/
    engine/                 # Node exports of the same pure engine
      RNG.js
      Paytable.js
      SpinEngine.js
      contracts.js
      serialize.js
    config/
      gameConfig.server.json   # canonical server-side config
      version.json             # ruleset/build and hash
    routes/
      game.routes.js           # REST endpoints
      auth.routes.js
      wallet.routes.js
    controllers/
      game.controller.js       # validates input, calls SpinEngine, returns SpinPlan
      auth.controller.js
      wallet.controller.js
    sockets/
      game.socket.js           # spin_request → spin_result via SpinEngine
    services/
      session.service.js
      wallet.service.js
      user.service.js
      analytics.service.js
    mw/
      auth.js
      rateLimit.js
      validator.js
      error.js
    db/
      pool.js                  # pg pool
    index.js                   # or server.js (port 3000)
```

### Database schema (server; future)
- `users` — core identity.
- `wallets` — current balance snapshot per user.
- `ledger_entries` — append-only monetary log (authoritative), refs `spin_id`.
- `game_sessions` — session state: bet, free spins, accumulator, seeds, config hash.
- `spins` — one row per spin: bet, base and total wins, cascades, scatters, RM/CRM applied, FS trig/retrig, accumulator after, minimal `plan_summary` JSONB.
- `spin_grids` — optional heavy payload (initial/final grid, phases) for QA.
- `rtp_daily` — rollups (materialized from `spins`).
- `audit_logs` — operational/audit meta.
- `game_configs` — versioned configs by hash (referenced by sessions/spins).

### Server-side spin flow (later)
1. Validate session and bet (server-owned).
2. Run `SpinEngine.generateSpinPlan(input)` with server RNG and canonical config.
3. Atomic debit/credit in ledger; update wallet and session.
4. Persist `spins` (+ optional `spin_grids` when debug), return `SpinPlan` to client.

### Testing
- Golden seeds for engine parity tests across client/server.
- RTP smoke via `MathSimulator` (now backed by `SpinEngine`).
- E2E: create session → spin → assert wallet deltas and plan structure.

### Rollout plan
1. Land pure engine + orchestrator on client; legacy RNG fully removed from animation path.
2. Add server engine (same code) and spin endpoints (no UI changes).
3. Feature flag client to call server and fall back to local engine if offline.
4. Remove fallback once stable.

### Notes
- All visual timings are preserved because the engine only supplies data; the scene continues to orchestrate tweens and SFX exactly as before.
- Determinism is mandatory: same input + seed + config hash ⇒ identical `SpinPlan` on both client and server.


