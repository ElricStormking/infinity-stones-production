/**
 * Complete Server-Side Game Engine
 *
 * Task 4.2: Port game logic to server (XL)
 *
 * This is the main orchestrator that coordinates all game systems:
 * - Win calculation and payout logic
 * - Cascade processing and symbol management
 * - Multiplier engine for all multiplier types
 * - Free spins mode management
 * - Bonus feature implementations
 *
 * CRITICAL: This must generate identical results to client-only version
 * for seamless gameplay transition while maintaining 96.5% RTP.
 */

const crypto = require('crypto');
const WinCalculator = require('./winCalculator');
const CascadeProcessor = require('./cascadeProcessor');
const MultiplierEngine = require('./multiplierEngine');
const FreeSpinsEngine = require('./freeSpinsEngine');
const BonusFeatures = require('./bonusFeatures');
const { getRNG } = require('./rng');
const GridGenerator = require('./gridGenerator');

// Game configuration constants
const GAME_CONFIG = {
  GRID_COLS: 6,
  GRID_ROWS: 5,
  MIN_MATCH_COUNT: 8,
  CASCADE_SPEED: 300,
  RTP: 0.965,
  MAX_WIN_MULTIPLIER: 5000,

  // Symbol payout tables (identical to client GameConfig.js)
  SYMBOLS: {
    time_gem: { payouts: { 8: 8, 10: 15, 12: 40 }, type: 'low' },
    space_gem: { payouts: { 8: 9, 10: 18, 12: 80 }, type: 'low' },
    mind_gem: { payouts: { 8: 10, 10: 20, 12: 100 }, type: 'low' },
    power_gem: { payouts: { 8: 16, 10: 24, 12: 160 }, type: 'low' },
    reality_gem: { payouts: { 8: 20, 10: 30, 12: 200 }, type: 'low' },
    soul_gem: { payouts: { 8: 30, 10: 40, 12: 240 }, type: 'low' },
    thanos_weapon: { payouts: { 8: 40, 10: 100, 12: 300 }, type: 'high' },
    scarlet_witch: { payouts: { 8: 50, 10: 200, 12: 500 }, type: 'high' },
    thanos: { payouts: { 8: 200, 10: 500, 12: 1000 }, type: 'high' },
    infinity_glove: { payouts: { 4: 60, 5: 100, 6: 2000 }, type: 'scatter' }
  },

  // Symbol weights for 96.5% RTP
  SYMBOL_WEIGHTS: {
    time_gem: 26,
    space_gem: 26,
    mind_gem: 22,
    power_gem: 20,
    reality_gem: 20,
    soul_gem: 19,
    thanos_weapon: 17,
    scarlet_witch: 12,
    thanos: 11
  },

  // Official scatter symbol chance (base game)
  SCATTER_CHANCE: 0.035,

  // Free spins configuration
  FREE_SPINS: {
    SCATTER_4_PLUS: 15,
    RETRIGGER_SPINS: 5,
    BUY_FEATURE_COST: 100,
    BUY_FEATURE_SPINS: 15,
    BASE_MULTIPLIER: 1,
    ACCUM_TRIGGER_CHANCE_PER_CASCADE: 0.35
  },

  // Random multiplier configuration
  RANDOM_MULTIPLIER: {
    TRIGGER_CHANCE: 0.4,
    MIN_WIN_REQUIRED: 0.01,
    ANIMATION_DURATION: 2000,
    TABLE: [].concat(
      Array(487).fill(2),
      Array(200).fill(3),
      Array(90).fill(4),
      Array(70).fill(5),
      Array(70).fill(6),
      Array(40).fill(8),
      Array(20).fill(10),
      Array(10).fill(20),
      Array(10).fill(100),
      Array(3).fill(500)
    )
  },

  // Cascading random multiplier configuration
  CASCADE_RANDOM_MULTIPLIER: {
    TRIGGER_CHANCE: 0.20,
    MIN_MULTIPLIERS: 1,
    MAX_MULTIPLIERS: 3,
    MIN_WIN_REQUIRED: 0.01
  }
};

class GameEngine {
  constructor(options = {}) {
    // Initialize crypto RNG system
    this.rng = getRNG({ auditLogging: true });
    // Production: disable any forced cluster injection; audit logging stays on
    this.gridGenerator = new GridGenerator({ auditLogging: true, clusterInjection: false, minClustersPerGrid: 0 });

    // Initialize all game systems
    this.winCalculator = new WinCalculator(GAME_CONFIG);
    this.cascadeProcessor = new CascadeProcessor(GAME_CONFIG, this.rng);
    this.multiplierEngine = new MultiplierEngine(GAME_CONFIG, this.rng);
    this.freeSpinsEngine = new FreeSpinsEngine(GAME_CONFIG, this.rng);
    this.bonusFeatures = new BonusFeatures(GAME_CONFIG, this.rng);

    // Game state tracking
    this.sessionStats = {
      totalSpins: 0,
      totalWins: 0,
      totalWon: 0,
      totalBet: 0,
      biggestWin: 0,
      currentSession: Date.now()
    };

    this.logAuditEvent('GAME_ENGINE_INITIALIZED', {
      systems_loaded: ['winCalculator', 'cascadeProcessor', 'multiplierEngine', 'freeSpinsEngine', 'bonusFeatures'],
      rtp_target: GAME_CONFIG.RTP,
      max_win_multiplier: GAME_CONFIG.MAX_WIN_MULTIPLIER
    });
  }

  /**
     * Process a complete spin with all cascades and features
     * This is the main entry point that coordinates all game logic
     * @param {Object} spinRequest - Complete spin request
     * @returns {Object} Complete spin result with all game data
     */
  async processCompleteSpin(spinRequest) {
    const {
      betAmount,
      playerId,
      sessionId,
      freeSpinsActive = false,
      freeSpinsRemaining = 0,
      accumulatedMultiplier = 1,
      quickSpinMode = false,
      spinId = this.generateSpinId(),
      rngSeed: providedSeed
    } = spinRequest;

    try {
      this.logAuditEvent('SPIN_PROCESSING_STARTED', {
        spin_id: spinId,
        player_id: playerId,
        session_id: sessionId,
        bet_amount: betAmount,
        free_spins_active: freeSpinsActive,
        accumulated_multiplier: accumulatedMultiplier
      });

      // Generate initial grid state (allow deterministic override for testing/replay)
      const rngSeed = (providedSeed && typeof providedSeed === 'string' && providedSeed.length > 0)
        ? providedSeed
        : this.rng.generateSeed();
      const initialGridResult = this.gridGenerator.generateGrid({
        seed: rngSeed,
        freeSpinsMode: freeSpinsActive,
        accumulatedMultiplier: accumulatedMultiplier
      });

      const initialGridSnapshot = this.cloneGrid(initialGridResult.grid);

      let currentGrid = this.cloneGrid(initialGridResult.grid);
      let totalWin = 0;
      const cascadeSteps = [];
      let cascadeCount = 0;

      // Initialize spin result structure
      const spinResult = {
        spinId,
        playerId,
        sessionId,
        betAmount,
        freeSpinsActive,
        freeSpinsRemaining,
        accumulatedMultiplier,
        initialGrid: this.cloneGrid(currentGrid),
        rngSeed,
        cascadeSteps: [],
        totalWin: 0,
        baseWin: 0,
        finalGrid: null,
        bonusFeatures: {
          freeSpinsTriggered: false,
          freeSpinsAwarded: 0,
          randomMultipliers: [],
          specialFeatures: []
        },
        features: {},
        timing: {
          spinStartTime: Date.now(),
          cascadeDuration: 0,
          totalDuration: 0
        },
        metadata: {
          quickSpinMode,
          rngAuditId: rngSeed
        }
      };

      // Process all cascading cycles
      let matches = this.winCalculator.findConnectedMatches(currentGrid);
      let pendingFreeSpinsCount = null;
      let freeSpinsTriggerDetails = null;

      while (matches.length > 0) {
        cascadeCount++;

        // Calculate wins for current cascade
        const cascadeWins = this.winCalculator.calculateCascadeWins(matches, betAmount);
        let cascadeWinTotal = cascadeWins.reduce((sum, win) => sum + win.payout, 0);

        // Apply free spins accumulated multiplier
        if (freeSpinsActive && accumulatedMultiplier > 1) {
          const originalCascadeWin = cascadeWinTotal;
          cascadeWinTotal *= accumulatedMultiplier;
          console.log(`🎰 FREE SPINS: Applying accumulated multiplier x${accumulatedMultiplier} to cascade ${cascadeCount} win: $${originalCascadeWin.toFixed(2)} → $${cascadeWinTotal.toFixed(2)}`);
        } else if (freeSpinsActive) {
          console.log(`🎰 FREE SPINS: Cascade ${cascadeCount} win $${cascadeWinTotal.toFixed(2)} (no multiplier yet, accumulated = x${accumulatedMultiplier})`);
        }

        totalWin += cascadeWinTotal;

        // Process symbol removal and dropping
        // Derive deterministic hex seed per cascade from spin rngSeed and step number
        const cascadeSeed = `${rngSeed}${String(cascadeCount).padStart(2, '0')}`;

        const gridStateBefore = this.cloneGrid(currentGrid);

        const cascadeResult = await this.cascadeProcessor.processCascade(
          currentGrid,
          matches,
          cascadeCount,
          quickSpinMode,
          cascadeSeed
        );

        if (!cascadeResult || (Array.isArray(cascadeResult.removedPositions) && cascadeResult.removedPositions.length === 0)) {
          this.logAuditEvent('CASCADE_NO_REMOVALS_DETECTED', {
            spin_id: spinId,
            cascade_number: cascadeCount,
            matches_found: matches.length
          });
        }

        // Store cascade step data
        const gridAfterRemoval = this.cloneGrid(cascadeResult.gridAfterRemoval || currentGrid);
        const gridStateAfter = this.cloneGrid(cascadeResult.newGrid);
        const matchedClusters = matches.map(match => ({
          symbolType: match.symbolType,
          positions: match.positions,
          clusterSize: match.positions.length,
          payout: cascadeWins.find(w => w.symbolType === match.symbolType)?.payout || 0
        }));
        const removalCount = Array.isArray(cascadeResult.removedPositions) ? cascadeResult.removedPositions.length : 0;
        const newSymbolCount = Array.isArray(cascadeResult.newSymbols) ? cascadeResult.newSymbols.length : 0;

        // Pre-expand dropPatterns into a flat droppingSymbols list for client animation
        // Keep dropPatterns for backward compatibility
        const droppingSymbols = Array.isArray(cascadeResult.dropPatterns)
          ? cascadeResult.dropPatterns.reduce((acc, pattern) => {
              const column = pattern.column;
              const drops = Array.isArray(pattern.drops) ? pattern.drops : [];
              drops.forEach((drop) => {
                const fromRow = (typeof drop.from === 'number')
                  ? drop.from
                  : ((drop.from && typeof drop.from.row === 'number') ? drop.from.row : drop.fromRow);
                const toRow = (typeof drop.to === 'number')
                  ? drop.to
                  : ((drop.to && typeof drop.to.row === 'number') ? drop.to.row : drop.toRow);
                acc.push({
                  from: drop.from || { col: column, row: fromRow },
                  to: drop.to || { col: column, row: toRow },
                  symbolType: drop.symbolType || drop.type || drop.symbol || null,
                  dropDistance: drop.dropDistance,
                  dropTime: drop.dropTime
                });
              });
              return acc;
            }, [])
          : [];

        const cascadeStep = {
          stepNumber: cascadeCount,
          stepIndex: cascadeCount - 1,
          rngSeed: cascadeSeed,
          rngStepSeed: cascadeSeed,
          gridStateBefore,
          gridStateBeforeHash: this.hashGridState(gridStateBefore),
          gridAfterRemoval,
          gridAfterRemovalHash: this.hashGridState(gridAfterRemoval),
          gridStateAfter,
          gridStateAfterHash: this.hashGridState(gridStateAfter),
          winningClusters: matchedClusters,
          matchedClusters,
          symbolsToRemove: matchedClusters,
          removedPositions: (cascadeResult.removedPositions || []).map(pos => ({
            col: pos.col,
            row: pos.row,
            symbolType: pos.symbolType || (Array.isArray(gridStateBefore) && Array.isArray(gridStateBefore[pos.col]) ? gridStateBefore[pos.col][pos.row] : null)
          })),
          cascadeWin: cascadeWinTotal,
          winAmount: cascadeWinTotal,
          totalWinSoFar: totalWin,
          dropPatterns: cascadeResult.dropPatterns,
          droppingSymbols,
          newSymbols: (cascadeResult.newSymbols || []).map(entry => ({
            position: { col: entry.position?.col ?? entry.col, row: entry.position?.row ?? entry.row },
            column: entry.position?.col ?? entry.col,
            row: entry.position?.row ?? entry.row,
            symbol: entry.symbol,
            symbolType: entry.symbolType || entry.symbol,
            type: entry.type || entry.symbolType || entry.symbol,
            dropFromRow: entry.dropFromRow,
            dropTime: entry.dropTime,
            emptyRowsAbove: entry.emptyRowsAbove,
            isNewSymbol: entry.isNewSymbol !== false,
            rngSeed: entry.rngSeed || cascadeSeed
          })),
          timing: cascadeResult.timing,
          metadata: {
            ...(cascadeResult.metadata || {}),
            rngStepSeed: cascadeSeed,
            removedSymbolCount: removalCount,
            newSymbolCount
          }
        };

        // Provide canonical aliases expected by some clients/tools
        // Ensures no consumer sees "missing grid" due to field name drift
        cascadeStep.gridBefore = cascadeStep.gridStateBefore;
        cascadeStep.gridAfter = cascadeStep.gridStateAfter;
        cascadeStep.gridMid = cascadeStep.gridAfterRemoval;

        cascadeSteps.push(cascadeStep);

        // REMOVED: Cascading random multipliers during cascade loop
        // All random multipliers will be generated AFTER all cascades complete
        // This ensures consistent generation and display timing

        // Update grid for next cascade
        currentGrid = cascadeResult.newGrid;

        // Safety check to prevent infinite cascades
        if (cascadeCount >= 20) {
          this.logAuditEvent('CASCADE_LIMIT_REACHED', {
            spin_id: spinId,
            cascade_count: cascadeCount
          });
          break;
        }

        matches = this.winCalculator.findConnectedMatches(currentGrid);
      }

      // Check for scatter-triggered free spins on initial grid
      const scatterCount = this.countScatters(initialGridSnapshot);
      console.log(`🎰 FREE SPINS CHECK (initial): Found ${scatterCount} scatters on initial grid (need 4+)`);
      console.log(`  Initial grid:`, this.gridToString(initialGridSnapshot));
      if (scatterCount >= 4 && !freeSpinsActive) {
        console.log(`✨ ${scatterCount} scatters found on INITIAL grid! Triggering free spins...`);
        const freeSpinsResult = this.freeSpinsEngine.checkFreeSpinsTrigger(scatterCount, freeSpinsActive);
        console.log(`  Free spins result:`, freeSpinsResult);
        if (freeSpinsResult.triggered && freeSpinsResult.spinsAwarded > 0) {
          spinResult.bonusFeatures.freeSpinsTriggered = true;
          spinResult.bonusFeatures.freeSpinsAwarded = freeSpinsResult.spinsAwarded;
          console.log(`  ✅ FREE SPINS TRIGGERED (initial): ${freeSpinsResult.spinsAwarded} spins awarded`);
          pendingFreeSpinsCount = freeSpinsResult.spinsAwarded;
          freeSpinsTriggerDetails = {
            trigger: 'scatter_trigger',
            type: 'initial',
            scatterCount,
            spinsAwarded: freeSpinsResult.spinsAwarded,
            previousRemaining: Number.isFinite(freeSpinsRemaining) ? freeSpinsRemaining : 0,
            retrigger: false
          };

          // Add scatter payout
          const scatterPayout = this.winCalculator.calculateScatterPayout(scatterCount, betAmount);
          totalWin += scatterPayout;
        }
      }
      
      // NEW: Also check for scatters AFTER cascades complete (post-cascade scatters)
      // This allows scatters that appear during cascades to trigger free spins
      if (!freeSpinsActive && !pendingFreeSpinsCount) {
        const postCascadeScatterCount = this.countScatters(currentGrid);
        console.log(`🎰 FREE SPINS CHECK (post-cascade): Found ${postCascadeScatterCount} scatters on final grid (need 4+)`);
        console.log(`  Final grid:`, this.gridToString(currentGrid));
        if (postCascadeScatterCount >= 4) {
          console.log(`✨ ${postCascadeScatterCount} scatters found on FINAL grid! Triggering free spins...`);
          const freeSpinsResult = this.freeSpinsEngine.checkFreeSpinsTrigger(postCascadeScatterCount, false);
          console.log(`  Free spins result:`, freeSpinsResult);
          if (freeSpinsResult.triggered && freeSpinsResult.spinsAwarded > 0) {
            spinResult.bonusFeatures.freeSpinsTriggered = true;
            spinResult.bonusFeatures.freeSpinsAwarded = freeSpinsResult.spinsAwarded;
            console.log(`  ✅ FREE SPINS TRIGGERED (post-cascade): ${freeSpinsResult.spinsAwarded} spins awarded`);
            pendingFreeSpinsCount = freeSpinsResult.spinsAwarded;
            freeSpinsTriggerDetails = {
              trigger: 'scatter_post_cascade',
              type: 'post_cascade',
              scatterCount: postCascadeScatterCount,
              spinsAwarded: freeSpinsResult.spinsAwarded,
              previousRemaining: 0,
              retrigger: false
            };

            // Add scatter payout
            const scatterPayout = this.winCalculator.calculateScatterPayout(postCascadeScatterCount, betAmount);
            totalWin += scatterPayout;
          }
        }
      }

      if (freeSpinsActive) {
        const postCascadeScatterCount = this.countScatters(currentGrid);
        if (postCascadeScatterCount >= 4) {
          const retriggerResult = this.freeSpinsEngine.checkFreeSpinsRetrigger(postCascadeScatterCount);
          if (retriggerResult.triggered && retriggerResult.spinsAwarded > 0) {
            spinResult.bonusFeatures.freeSpinsRetriggered = true;
            spinResult.bonusFeatures.freeSpinsAwarded = (spinResult.bonusFeatures.freeSpinsAwarded || 0) + retriggerResult.spinsAwarded;

            const previousRemaining = Number.isFinite(freeSpinsRemaining) ? freeSpinsRemaining : 0;
            const remainingAfterSpin = Math.max(0, previousRemaining - 1);
            pendingFreeSpinsCount = remainingAfterSpin + retriggerResult.spinsAwarded;
            freeSpinsTriggerDetails = {
              trigger: 'scatter_retrigger',
              type: 'retrigger',
              scatterCount: postCascadeScatterCount,
              spinsAwarded: retriggerResult.spinsAwarded,
              previousRemaining,
              retrigger: true
            };
          }
        }
      }

      const multiplierEvents = [];
      const baseWinBeforeMultipliers = totalWin;
      let accumulatedRandomMultiplier = 0; // Sum of all RANDOM multipliers (additive, not multiplicative)
      // NOTE: DO NOT confuse with `accumulatedMultiplier` parameter which is the FREE SPINS multiplier!

      if (cascadeSteps.length > 0) {
        console.log(`🎲 Checking cascade multipliers: ${cascadeSteps.length} cascades completed, totalWin=$${totalWin.toFixed(2)}`);
        const cascadingMultiplierResult = await this.multiplierEngine.processCascadingRandomMultipliers(
          totalWin,
          cascadeSteps.length,
          { betAmount, freeSpinsActive }
        );

        if (cascadingMultiplierResult.triggered) {
          console.log(`  ✅ Cascade multipliers triggered:`, {
            count: cascadingMultiplierResult.multipliers.length,
            values: cascadingMultiplierResult.multipliers.map(m => m.multiplier),
            totalMultiplier: cascadingMultiplierResult.totalMultiplier,
            originalWin: cascadingMultiplierResult.originalWin
          });
          // CRITICAL FIX: Don't apply yet, just accumulate the multiplier value
          accumulatedRandomMultiplier += cascadingMultiplierResult.totalMultiplier;
          spinResult.bonusFeatures.randomMultipliers.push(...cascadingMultiplierResult.multipliers);
          multiplierEvents.push({
            type: 'cascade_random_multiplier',
            totalMultiplier: cascadingMultiplierResult.totalMultiplier,
            multipliers: cascadingMultiplierResult.multipliers,
            originalWin: baseWinBeforeMultipliers,
            finalWin: null // Will be set after all multipliers are accumulated
          });
        } else {
          console.log(`  ❌ Cascade multipliers NOT triggered:`, cascadingMultiplierResult.reason || 'unknown');
        }
      }

      if (totalWin > GAME_CONFIG.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
        const randomMultiplierResult = await this.multiplierEngine.processRandomMultiplier(totalWin, betAmount);

        if (randomMultiplierResult.triggered) {
          // CRITICAL FIX: Don't apply yet, just accumulate the multiplier value
          accumulatedRandomMultiplier += randomMultiplierResult.multiplier;
          spinResult.bonusFeatures.randomMultipliers.push(randomMultiplierResult);
          multiplierEvents.push({
            type: 'random_multiplier',
            totalMultiplier: randomMultiplierResult.multiplier,
            multipliers: [randomMultiplierResult],
            originalWin: baseWinBeforeMultipliers,
            finalWin: null // Will be set after all multipliers are accumulated
          });
        }
      }
      
      // CRITICAL: Apply random multipliers from current spin
      // For FREE SPINS: New multipliers + existing accumulated multiplier are BOTH applied to current win
      if (accumulatedRandomMultiplier > 0) {
        console.log(`  🔍 Random multipliers generated in current spin:`, {
          baseWinBeforeMultipliers: baseWinBeforeMultipliers.toFixed(2),
          newRandomMultipliersFromCurrentSpin: accumulatedRandomMultiplier,
          currentTotalWin: totalWin.toFixed(2),
          freeSpinsActive,
          existingAccumulatedMultiplier: freeSpinsActive ? accumulatedMultiplier : 'N/A',
          multiplierEvents: multiplierEvents.map(e => ({ type: e.type, total: e.totalMultiplier }))
        });
        
        if (freeSpinsActive) {
          // FREE SPINS MODE: Apply NEW multipliers to current spin (in addition to already-applied accumulated multiplier)
          // IMPORTANT: The existing accumulated multiplier was already applied at cascade level (line 224-226)
          // Now we need to apply the NEW multipliers from this spin as well
          const totalMultiplierForThisSpin = accumulatedMultiplier + accumulatedRandomMultiplier;
          const baseWinBeforeAnyMultipliers = totalWin / accumulatedMultiplier; // Reverse the accumulated multiplier to get base
          totalWin = baseWinBeforeAnyMultipliers * totalMultiplierForThisSpin;
          
          console.log(`  🎰 FREE SPINS MODE: Applying NEW x${accumulatedRandomMultiplier} multipliers to current spin`);
          console.log(`  🎰 Calculation: Base $${baseWinBeforeAnyMultipliers.toFixed(2)} × (accumulated ${accumulatedMultiplier} + new ${accumulatedRandomMultiplier}) = $${baseWinBeforeAnyMultipliers.toFixed(2)} × ${totalMultiplierForThisSpin} = $${totalWin.toFixed(2)}`);
          
          multiplierEvents.forEach(evt => {
            evt.finalWin = totalWin;
            evt.appliedToCurrentSpin = true;
            evt.totalMultiplierIncludingAccumulated = totalMultiplierForThisSpin;
          });
        } else {
          // REGULAR MODE: Apply immediately to current spin (no accumulated multiplier)
          totalWin = baseWinBeforeMultipliers * accumulatedRandomMultiplier;
          console.log(`  ✅ REGULAR MODE: Random multiplier x${accumulatedRandomMultiplier} applied to base $${baseWinBeforeMultipliers.toFixed(2)} = $${totalWin.toFixed(2)}`);
          
          multiplierEvents.forEach(evt => {
            evt.finalWin = totalWin;
            evt.appliedToCurrentSpin = true;
          });
        }
      }

      spinResult.multiplierEvents = multiplierEvents;

      if (multiplierEvents.length > 0) {
        const finalWinAfterMultipliers = totalWin;
        const totalAppliedMultiplier = baseWinBeforeMultipliers > 0
          ? finalWinAfterMultipliers / baseWinBeforeMultipliers
          : multiplierEvents.reduce((sum, evt) => sum + (evt.totalMultiplier || 0), 0);

        spinResult.multiplierAwarded = {
          events: multiplierEvents,
          originalWin: baseWinBeforeMultipliers,
          finalWin: finalWinAfterMultipliers,
          totalAppliedMultiplier,
          hasCascade: multiplierEvents.some(evt => evt.type === 'cascade_random_multiplier'),
          hasRandom: multiplierEvents.some(evt => evt.type === 'random_multiplier')
        };
      } else {
        spinResult.multiplierAwarded = null;
      }


      // Apply win limits and rounding
      totalWin = this.applyWinLimits(totalWin, betAmount);
      const baseWin = freeSpinsActive ? totalWin / accumulatedMultiplier : totalWin;

      // Complete spin result
      spinResult.cascadeSteps = cascadeSteps;
      spinResult.cascadeCount = cascadeSteps.length;
      spinResult.metadata.cascadeCount = cascadeSteps.length;
      spinResult.totalWin = totalWin;
      spinResult.baseWin = baseWin;
      spinResult.finalGrid = currentGrid;
      spinResult.timing.cascadeDuration = cascadeSteps.reduce((sum, step) => sum + (step.timing?.totalDuration || 0), 0);
      spinResult.timing.totalDuration = spinResult.timing.cascadeDuration + 1000; // Buffer time

      if (freeSpinsTriggerDetails && Number.isFinite(pendingFreeSpinsCount)) {
        const baseMultiplier = GAME_CONFIG.FREE_SPINS.BASE_MULTIPLIER;
        const resolvedMultiplier = freeSpinsActive
          ? (Number.isFinite(accumulatedMultiplier) ? accumulatedMultiplier : baseMultiplier)
          : baseMultiplier;

        spinResult.features.free_spins = {
          count: pendingFreeSpinsCount,
          multiplier: resolvedMultiplier,
          trigger: freeSpinsTriggerDetails.trigger,
          scatterCount: freeSpinsTriggerDetails.scatterCount,
          spinsAwarded: freeSpinsTriggerDetails.spinsAwarded,
          retrigger: Boolean(freeSpinsTriggerDetails.retrigger),
          previousRemaining: freeSpinsTriggerDetails.previousRemaining
        };

        spinResult.metadata.freeSpins = {
          ...freeSpinsTriggerDetails,
          nextCount: pendingFreeSpinsCount
        };
        spinResult.freeSpinsNextCount = pendingFreeSpinsCount;
      }

      // Update session statistics
      this.updateSessionStats(spinResult);

      // CRITICAL: Calculate new accumulated multiplier for free spins
      // The new accumulated multiplier includes both the existing accumulated + new random multipliers from this spin
      // ALWAYS set this during free spins to maintain the accumulated value across spins
      if (freeSpinsActive) {
        if (spinResult.bonusFeatures.randomMultipliers.length > 0) {
          const newMultipliersSum = spinResult.bonusFeatures.randomMultipliers
            .reduce((sum, m) => sum + m.multiplier, 0);
          
          console.log(`🎰 FREE SPINS: Processing multiplier accumulation:`, {
            previousAccumulated: accumulatedMultiplier,
            newMultipliersFromThisSpin: newMultipliersSum,
            randomMultipliersCount: spinResult.bonusFeatures.randomMultipliers.length,
            randomMultipliers: spinResult.bonusFeatures.randomMultipliers.map(m => ({
              multiplier: m.multiplier,
              type: m.type
            }))
          });
          
          // New accumulated = existing accumulated + new multipliers from this spin
          // This was ALREADY applied to the current spin's win (see line 490-492)
          const newAccumulatedMultiplier = accumulatedMultiplier + newMultipliersSum;

          spinResult.newAccumulatedMultiplier = newAccumulatedMultiplier;
          console.log(`🎰 GAME ENGINE: New accumulated multiplier for NEXT spin:`, {
            previousAccumulated: accumulatedMultiplier,
            newMultipliersFromCurrentSpin: spinResult.bonusFeatures.randomMultipliers.map(m => m.multiplier),
            newAccumulated: newAccumulatedMultiplier,
            note: 'This total was ALREADY applied to current spin win'
          });
        } else {
          // No new multipliers this spin, but MUST maintain the accumulated value
          spinResult.newAccumulatedMultiplier = accumulatedMultiplier;
          console.log(`🎰 GAME ENGINE: No new multipliers, maintaining accumulated:`, {
            accumulatedMultiplier: accumulatedMultiplier,
            note: 'Accumulated multiplier preserved for next spin'
          });
        }
      }

      this.logAuditEvent('SPIN_PROCESSING_COMPLETED', {
        spin_id: spinId,
        total_win: totalWin,
        cascade_count: cascadeCount,
        free_spins_triggered: spinResult.bonusFeatures.freeSpinsTriggered,
        random_multipliers: spinResult.bonusFeatures.randomMultipliers.length
      });

      return spinResult;

    } catch (error) {
      this.logAuditEvent('SPIN_PROCESSING_ERROR', {
        spin_id: spinId,
        error: error.message,
        stack: error.stack
      });

      throw new Error(`Spin processing failed: ${error.message}`);
    }
  }

  /**
     * Process free spins spin with accumulated multiplier handling
     * @param {Object} freeSpinRequest - Free spins specific request
     * @returns {Object} Free spins result
     */
  async processFreeSpinSpin(freeSpinRequest) {
    const {
      betAmount,
      playerId,
      sessionId,
      freeSpinsRemaining,
      accumulatedMultiplier,
      totalFreeSpinsWin = 0,
      spinId = this.generateSpinId()
    } = freeSpinRequest;

    // Process as regular spin but with free spins context
    const spinResult = await this.processCompleteSpin({
      ...freeSpinRequest,
      freeSpinsActive: true,
      accumulatedMultiplier,
      spinId
    });

    // Update free spins specific data
    spinResult.freeSpinsRemaining = Math.max(0, freeSpinsRemaining - 1);
    spinResult.totalFreeSpinsWin = totalFreeSpinsWin + spinResult.totalWin;
    spinResult.freeSpinsComplete = spinResult.freeSpinsRemaining === 0;

    // Handle multiplier accumulation during free spins
    console.log(`🎰 FREE SPINS: Processing multiplier accumulation:`, {
      previousAccumulated: accumulatedMultiplier,
      randomMultipliersCount: spinResult.bonusFeatures.randomMultipliers.length,
      randomMultipliers: spinResult.bonusFeatures.randomMultipliers.map(m => ({
        multiplier: m.multiplier,
        type: m.type,
        cascadeCount: m.cascadeCount,
        position: m.position
      }))
    });
    
    const newAccumulatedMultiplier = this.multiplierEngine.updateAccumulatedMultiplier(
      accumulatedMultiplier,
      spinResult.bonusFeatures.randomMultipliers
    );

    spinResult.newAccumulatedMultiplier = newAccumulatedMultiplier;
    console.log(`🎰 GAME ENGINE: Calculated new accumulated multiplier for free spins:`, {
      previousAccumulated: accumulatedMultiplier,
      newMultipliers: spinResult.bonusFeatures.randomMultipliers.map(m => m.multiplier),
      newAccumulated: newAccumulatedMultiplier
    });

    return spinResult;
  }

  /**
     * Calculate RTP for session validation
     * @param {number} totalBet - Total amount bet
     * @param {number} totalWon - Total amount won
     * @returns {number} RTP percentage
     */
  calculateSessionRTP(totalBet, totalWon) {
    if (totalBet === 0) {return 0;}
    return (totalWon / totalBet) * 100;
  }

  /**
     * Validate game result against expected RTP ranges
     * @param {Object} spinResult - Spin result to validate
     * @returns {Object} Validation result
     */
  validateGameResult(spinResult) {
    const winMultiplier = spinResult.totalWin / spinResult.betAmount;
    const sessionRTP = this.calculateSessionRTP(this.sessionStats.totalBet, this.sessionStats.totalWon);

    // Check if win exceeds maximum
    const maxWin = spinResult.betAmount * GAME_CONFIG.MAX_WIN_MULTIPLIER;
    const winExceedsMax = spinResult.totalWin > maxWin;

    // Check RTP deviation (allow wider range for individual spins)
    const rtpTooHigh = sessionRTP > (GAME_CONFIG.RTP * 100) + 5; // 5% tolerance
    const rtpTooLow = sessionRTP < (GAME_CONFIG.RTP * 100) - 5;

    return {
      valid: !winExceedsMax && !rtpTooHigh && !rtpTooLow,
      winMultiplier,
      sessionRTP,
      maxWinExceeded: winExceedsMax,
      rtpDeviation: Math.abs(sessionRTP - (GAME_CONFIG.RTP * 100)),
      warnings: []
    };
  }

  /**
     * Get game engine statistics for monitoring
     * @returns {Object} Comprehensive statistics
     */
  getGameStatistics() {
    const rngStats = this.rng.getStatistics();
    const currentRTP = this.calculateSessionRTP(this.sessionStats.totalBet, this.sessionStats.totalWon);

    return {
      session: {
        ...this.sessionStats,
        currentRTP,
        rtpDeviation: Math.abs(currentRTP - (GAME_CONFIG.RTP * 100)),
        winRate: this.sessionStats.totalSpins > 0 ? (this.sessionStats.totalWins / this.sessionStats.totalSpins * 100) : 0,
        averageWin: this.sessionStats.totalWins > 0 ? (this.sessionStats.totalWon / this.sessionStats.totalWins) : 0
      },
      rng: rngStats,
      systems: {
        winCalculator: this.winCalculator.getStatistics(),
        multiplierEngine: this.multiplierEngine.getStatistics(),
        freeSpinsEngine: this.freeSpinsEngine.getStatistics(),
        bonusFeatures: this.bonusFeatures.getStatistics()
      },
      compliance: {
        targetRTP: GAME_CONFIG.RTP * 100,
        maxWinMultiplier: GAME_CONFIG.MAX_WIN_MULTIPLIER,
        auditTrailEnabled: true
      }
    };
  }

  /**
     * Utility methods
     */

  generateSpinId() {
    const timestamp = Date.now();
    const random = this.rng.uuid().substring(0, 8);
    return `spin_${timestamp}_${random}`;
  }

  cloneGrid(grid) {
    return grid.map(column => [...column]);
  }

  hashGridState(grid) {
    if (!Array.isArray(grid)) {
      return null;
    }

    try {
      const serialized = JSON.stringify(grid);
      return crypto.createHash('sha256').update(serialized).digest('hex');
    } catch (error) {
      return null;
    }
  }

  countScatters(grid) {
    let count = 0;
    for (let col = 0; col < GAME_CONFIG.GRID_COLS; col++) {
      for (let row = 0; row < GAME_CONFIG.GRID_ROWS; row++) {
        if (grid[col][row] === 'infinity_glove') {
          count++;
        }
      }
    }
    return count;
  }
  
  gridToString(grid) {
    // Convert grid to readable string for logging
    const symbolShort = {
      'time_gem': 'TI',
      'space_gem': 'SP',
      'mind_gem': 'MI',
      'power_gem': 'PO',
      'reality_gem': 'RE',
      'soul_gem': 'SO',
      'thanos_weapon': 'TW',
      'scarlet_witch': 'SW',
      'thanos': 'TH',
      'infinity_glove': '🎰'
    };
    let result = '\n';
    for (let row = 0; row < GAME_CONFIG.GRID_ROWS; row++) {
      for (let col = 0; col < GAME_CONFIG.GRID_COLS; col++) {
        const symbol = grid[col][row];
        result += (symbolShort[symbol] || '??') + ' ';
      }
      result += '\n';
    }
    return result;
  }

  applyWinLimits(win, betAmount) {
    const maxWin = betAmount * GAME_CONFIG.MAX_WIN_MULTIPLIER;
    const limitedWin = Math.min(win, maxWin);
    return Math.round(limitedWin * 100) / 100; // Round to 2 decimal places
  }

  updateSessionStats(spinResult) {
    this.sessionStats.totalSpins++;
    this.sessionStats.totalBet += spinResult.betAmount;

    if (spinResult.totalWin > 0) {
      this.sessionStats.totalWins++;
      this.sessionStats.totalWon += spinResult.totalWin;
      this.sessionStats.biggestWin = Math.max(this.sessionStats.biggestWin, spinResult.totalWin);
    }
  }

  logAuditEvent(event, data = {}) {
    this.rng.emit('audit_event', {
      timestamp: Date.now(),
      component: 'GameEngine',
      event,
      data
    });
  }

  /**
     * Reset session statistics (for testing/new session)
     */
  resetSessionStats() {
    this.sessionStats = {
      totalSpins: 0,
      totalWins: 0,
      totalWon: 0,
      totalBet: 0,
      biggestWin: 0,
      currentSession: Date.now()
    };

    this.logAuditEvent('SESSION_STATS_RESET', {});
  }

  /**
     * Run comprehensive game engine validation
     * @returns {Object} Validation results
     */
  async validateGameEngine() {
    const validationResults = {
      rngCompliance: this.rng.validateCasinoCompliance(),
      systemIntegrity: {
        winCalculator: this.winCalculator.validateIntegrity(),
        multiplierEngine: this.multiplierEngine.validateIntegrity(),
        freeSpinsEngine: this.freeSpinsEngine.validateIntegrity(),
        bonusFeatures: this.bonusFeatures.validateIntegrity()
      },
      configuration: {
        rtpTarget: GAME_CONFIG.RTP,
        maxWinMultiplier: GAME_CONFIG.MAX_WIN_MULTIPLIER,
        symbolPayouts: Object.keys(GAME_CONFIG.SYMBOLS).length,
        randomMultiplierTable: GAME_CONFIG.RANDOM_MULTIPLIER.TABLE.length
      }
    };

    validationResults.overallValid = (
      validationResults.rngCompliance.overall_compliance &&
            Object.values(validationResults.systemIntegrity).every(result => result.valid)
    );

    this.logAuditEvent('GAME_ENGINE_VALIDATION', validationResults);

    return validationResults;
  }
}

module.exports = GameEngine;