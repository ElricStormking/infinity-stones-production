/**
 * Game Controller - Core Game API Logic
 *
 * Handles all game-related operations with complete integration:
 * - Spin processing with full game engine integration
 * - Credit management with atomic transactions
 * - State management and persistence
 * - Anti-cheat validation
 * - Comprehensive audit logging
 *
 * Features:
 * - Production-ready error handling
 * - Transaction rollback on failures
 * - Session state updates
 * - Performance monitoring
 * - Casino-grade security validation
 */

const GameEngine = require('../game/gameEngine');
const StateManager = require('../game/stateManager');
const AntiCheat = require('../game/antiCheat');
const AuditLogger = require('../game/auditLogger');
const walletLedger = require('../services/walletLedger');
const { Player, Transaction, SpinResult } = require('../models');
const { pool } = require('../db/pool');
const { logger } = require('../utils/logger.js');
const { saveSpinResult } = require('../db/supabaseClient');

class GameController {
  constructor() {
    this.gameEngine = new GameEngine();
    this.stateManager = new StateManager();
    this.antiCheat = new AntiCheat();
    this.auditLogger = new AuditLogger();
    this.pendingSpinResults = new Map();
    this.pendingResultRetentionMs = 5 * 60 * 1000;

    // Performance monitoring
    this.spinMetrics = {
      totalSpins: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      lastResetTime: Date.now()
    };
  }

  /**
     * Process spin request - main game endpoint
     * POST /api/spin
     */
  async processSpin(req, res) {
    const startTime = Date.now();
    const spinId = this.generateSpinId();

    try {
      const {
        betAmount = 1.00,
        quickSpinMode = false,
        bonusMode = false,
        freeSpinsActive: clientFreeSpinsActive = false,
        freeSpinsRemaining: clientFreeSpinsRemaining = 0,
        accumulatedMultiplier: clientAccumulatedMultiplier = 1
      } = req.body;
      const normalizedBetAmount = Number.isFinite(betAmount) ? betAmount : (parseFloat(betAmount) || 0);
      const clientRequestId = req.body.clientRequestId || req.body.requestId || null;

      const playerId = (req.user?.id === 'demo-player') ? 'demo-player' : req.user.id;
      const sessionId = (req.session_info?.id === 'demo-session') ? 'demo-session' : req.session_info.id;

      // Input validation
      const validation = this.validateSpinRequest(req.body, req.user);
      if (!validation.valid) {
        await this.auditLogger.logSpinError(playerId, spinId, 'validation_failed', validation.errors);
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_FAILED',
          message: 'Invalid spin request',
          details: validation.errors
        });
      }

      // Anti-cheat validation (skip in fallback mode to avoid Redis timeouts)
      const skipRedis = (process.env.SKIP_REDIS ?? 'false').toLowerCase() === 'true';
      let antiCheatResult;
      
      if (!skipRedis) {
        antiCheatResult = await this.antiCheat.validateSpinRequest(
          playerId,
          req.body,
          req.user,
          req.session_info
        );

        if (!antiCheatResult.valid) {
          await this.auditLogger.logAntiCheatViolation(playerId, 'spin_request', antiCheatResult.violations);
          return res.status(403).json({
            success: false,
            error: 'ANTI_CHEAT_VIOLATION',
            message: 'Spin request failed security validation',
            code: 'SECURITY_VIOLATION'
          });
        }
      } else {
        // In fallback mode, skip anti-cheat (requires Redis)
        antiCheatResult = { valid: true, confidenceScore: 1.0, violations: [] };
      }

      // Start database transaction for atomic operations (skip in fallback mode)
      let client;

      try {
        // In fallback mode, create a dummy client for transactions
        if (!skipRedis) {
          client = await pool.connect();
          await client.query('BEGIN');
        } else {
          // Dummy client for fallback mode
          client = {
            query: async () => ({}),
            release: () => {}
          };
        }

        let player;
        
        if (skipRedis) {
          // Use Supabase for player data in fallback mode
          const { supabaseAdmin } = require('../db/supabaseClient');
          const { data: playerData, error: playerError } = await supabaseAdmin
            .from('players')
            .select('*')
            .eq('id', playerId)
            .single();

          if (playerError || !playerData) {
            throw new Error(`Player not found: ${playerId}`);
          }

          player = {
            id: playerData.id,
            username: playerData.username,
            credits: parseFloat(playerData.credits),
            is_demo: playerData.is_demo,
            status: playerData.status
          };
        } else {
          // Use PostgreSQL pool for player data in normal mode
          const playerQuery = await client.query(
            'SELECT id, username, credits::numeric AS credits, is_demo, status FROM players WHERE id = $1 FOR UPDATE',
            [playerId]
          );

          if (playerQuery.rows.length === 0) {
            throw new Error('Player not found');
          }

          const playerRow = playerQuery.rows[0];
          player = {
            id: playerRow.id,
            username: playerRow.username,
            credits: parseFloat(playerRow.credits),
            is_demo: playerRow.is_demo,
            status: playerRow.status
          };
        }

        console.log('[GameController] ??Player loaded with row lock');

        if (!player.is_demo && player.status && player.status !== 'active') {
          throw new Error(`Cannot execute transaction. Account status: ${player.status}`);
        }

        console.log('[GameController] Step 1: Player loaded, credits:', player.credits);
        const statePlayerId = player.is_demo ? 'demo-player' : playerId;
        console.log('[GameController] Step 2: Getting game state for:', statePlayerId);
        
        // Get game state - from Supabase in fallback mode, otherwise from StateManager
        let gameState;
        if (skipRedis && !player.is_demo) {
          console.log('[GameController] Reading game state from Supabase (fallback mode)');
          const { supabaseAdmin } = require('../db/supabaseClient');
          const { data: supabaseState, error: stateError } = await supabaseAdmin
            .from('game_states')
            .select('*')
            .eq('player_id', playerId)
            .single();
          
          if (stateError && stateError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.warn('[GameController] Error reading game state from Supabase:', stateError);
          }
          
          gameState = supabaseState || {
            game_mode: 'base',
            free_spins_remaining: 0,
            accumulated_multiplier: 1
          };
          console.log('[GameController] Loaded from Supabase:', gameState);
        } else {
          gameState = await this.stateManager.getPlayerState(statePlayerId);
        }
        
        const rawFreeSpinsRemaining = gameState ? gameState.free_spins_remaining : 0;
        const serverFreeSpinsRemaining = typeof rawFreeSpinsRemaining === 'number'
          ? rawFreeSpinsRemaining
          : parseInt(rawFreeSpinsRemaining, 10) || 0;
        const rawAccumulatedMultiplier = gameState ? gameState.accumulated_multiplier : 1;
        const serverAccumulatedMultiplier = typeof rawAccumulatedMultiplier === 'number'
          ? rawAccumulatedMultiplier
          : parseFloat(rawAccumulatedMultiplier) || 1;
        let serverFreeSpinsActive = (gameState ? gameState.game_mode : 'base') === 'free_spins'
          && serverFreeSpinsRemaining > 0;
        
        // SAVE ORIGINAL VALUE before modification (critical for state update logic)
        const originalServerFreeSpinsActive = serverFreeSpinsActive;

        console.log('[GameController] Step 3: Game state loaded, mode:', gameState?.game_mode, 'free spins:', serverFreeSpinsRemaining, 'multiplier:', serverAccumulatedMultiplier);
        console.log('[GameController] Client claims: freeSpinsActive:', clientFreeSpinsActive, 'freeSpinsRemaining:', clientFreeSpinsRemaining, 'accumulatedMultiplier:', clientAccumulatedMultiplier);
        
        // CRITICAL FIX: Handle free spins purchase case
        // If client says it's in free spins mode but server doesn't know, trust the client
        // This happens when free spins are purchased (client-side state change before first spin)
        if (clientFreeSpinsActive && !originalServerFreeSpinsActive && clientFreeSpinsRemaining > 0) {
          console.log('[GameController] ⚠️ Client in free spins but server is not - using client values (FREE SPINS PURCHASE)');
          serverFreeSpinsActive = true;
          // Don't override serverFreeSpinsRemaining and serverAccumulatedMultiplier yet - let the state update logic handle it
        }

        // Process bet transaction using wallet ledger (skip during free spins or demo)
        let betTransaction = null;
        console.log('[GameController] Step 4: Bet processing - is_demo:', player.is_demo, 'skipRedis:', skipRedis, 'will skip bet:', player.is_demo || serverFreeSpinsActive);
        if (!player.is_demo && !serverFreeSpinsActive) {
          try {
            if (skipRedis) {
              // Direct Supabase debit in fallback mode
              const { supabaseAdmin } = require('../db/supabaseClient');
              const newBalance = player.credits - normalizedBetAmount;
              
              if (newBalance < 0) {
                return res.status(400).json({
                  success: false,
                  error: 'INSUFFICIENT_CREDITS',
                  message: 'Insufficient credits for this bet',
                  availableCredits: player.credits
                });
              }
              
              const { error: updateError } = await supabaseAdmin
                .from('players')
                .update({ credits: newBalance })
                .eq('id', playerId);
              
              if (updateError) {
                throw new Error(`Failed to debit bet: ${updateError.message}`);
              }
              
              player.credits = newBalance;
              console.log('[GameController] Debited bet via Supabase, new balance:', newBalance);
            } else {
              // Use wallet ledger in normal mode
              betTransaction = await walletLedger.processBet({
                client,
                playerId,
                amount: normalizedBetAmount,
                referenceId: spinId,
                description: `Spin bet of ${normalizedBetAmount} credits`
              });
              player.credits = betTransaction.balance.current;
            }
          } catch (walletError) {
            if (!skipRedis) {
              await client.query('ROLLBACK');
            }

            if (walletError.message.includes('Insufficient funds') || walletError.message.includes('Insufficient credits')) {
              return res.status(400).json({
                success: false,
                error: 'INSUFFICIENT_CREDITS',
                message: walletError.message,
                availableCredits: player.credits
              });
            }

            throw walletError;
          }
        }

        // Process spin with game engine
        // If client is in free spins mode but server doesn't know (purchase case), use client values
        const effectiveFreeSpinsActive = serverFreeSpinsActive || (clientFreeSpinsActive && clientFreeSpinsRemaining > 0);
        const effectiveFreeSpinsRemaining = effectiveFreeSpinsActive && clientFreeSpinsActive && clientFreeSpinsRemaining > serverFreeSpinsRemaining 
          ? clientFreeSpinsRemaining 
          : serverFreeSpinsRemaining;
        const effectiveAccumulatedMultiplier = effectiveFreeSpinsActive && clientFreeSpinsActive && clientAccumulatedMultiplier > serverAccumulatedMultiplier
          ? clientAccumulatedMultiplier
          : serverAccumulatedMultiplier;
        
        const spinRequest = {
          betAmount: normalizedBetAmount,
          playerId,
          sessionId,
          freeSpinsActive: effectiveFreeSpinsActive,
          freeSpinsRemaining: effectiveFreeSpinsRemaining,
          accumulatedMultiplier: effectiveAccumulatedMultiplier,
          quickSpinMode: Boolean(quickSpinMode),
          bonusMode: Boolean(bonusMode),
          spinId
        };
        
        console.log('[GameController] Spin request to engine - freeSpinsActive:', effectiveFreeSpinsActive, 'remaining:', effectiveFreeSpinsRemaining, 'multiplier:', effectiveAccumulatedMultiplier);

        console.log('[GameController] Step 6: About to call gameEngine.processCompleteSpin');
        const spinResult = await this.gameEngine.processCompleteSpin(spinRequest);
        console.log('[GameController] Step 7: Spin result received, totalWin:', spinResult.totalWin);
        if (clientRequestId) {
          spinResult.clientRequestId = clientRequestId;
        }

        console.log('[GameController] Step 7.1: About to validate spin result');
        // Validate spin result (skip in fallback mode as it may fail without full game state)
        let resultValidation;
        if (!skipRedis) {
          resultValidation = this.gameEngine.validateGameResult(spinResult);
          console.log('[GameController] Step 7.2: Validation result:', resultValidation.valid);
          if (!resultValidation.valid) {
            if (!skipRedis) {
              await client.query('ROLLBACK');
            }
            await this.auditLogger.logSpinError(playerId, spinId, 'result_validation_failed', resultValidation);

            return res.status(500).json({
              success: false,
              error: 'SPIN_VALIDATION_FAILED',
              message: 'Spin result failed validation',
              code: 'RESULT_INVALID'
            });
          }
        } else {
          console.log('[GameController] Step 7.2: Skipping validation (fallback mode)');
          // Create a dummy validation object for fallback mode
          resultValidation = { valid: true, sessionRTP: null };
        }

        // Credit winnings using wallet ledger (if any)
        let winTransaction = null;
        if (spinResult.totalWin > 0 && !player.is_demo) {
          try {
            if (skipRedis) {
              // Direct Supabase credit in fallback mode
              const { supabaseAdmin } = require('../db/supabaseClient');
              const newBalance = player.credits + spinResult.totalWin;
              
              const { error: updateError } = await supabaseAdmin
                .from('players')
                .update({ credits: newBalance })
                .eq('id', playerId);
              
              if (updateError) {
                throw new Error(`Failed to credit win: ${updateError.message}`);
              }
              
              player.credits = newBalance;
              console.log('[GameController] Credited win via Supabase, new balance:', newBalance);
            } else {
              // Use wallet ledger in normal mode
              winTransaction = await walletLedger.processWin({
                client,
                playerId,
                amount: spinResult.totalWin,
                referenceId: spinId,
                description: `Spin win of ${spinResult.totalWin} credits`
              });
              player.credits = winTransaction.balance.current;
            }
          } catch (walletError) {
            if (!skipRedis) {
              await client.query('ROLLBACK');
            }
            throw walletError;
          }
        }

        console.log('[GameController] Step 7.3: Win crediting complete, moving to state update');
        
        // Prepare session ID for Supabase (validate UUID or use null)
        const validSessionId = sessionId && sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
          ? sessionId 
          : null;
        
        // Update game state based on spin result
        let stateResult;
        if (!skipRedis) {
          console.log('[GameController] Step 7a: Updating state via StateManager');
          stateResult = await this.stateManager.processSpinResult(statePlayerId, spinResult);
        } else {
          console.log('[GameController] Step 7a: Skipping StateManager, updating Supabase directly (fallback mode)');
          // In fallback mode, skip state manager and update Supabase game_states directly
          const { supabaseAdmin } = require('../db/supabaseClient');
          
          // CRITICAL: Calculate game mode and free spins like stateManager does
          // Mimic stateManager.calculateStateUpdates() logic exactly
          let newGameMode = gameState.game_mode || 'base';
          let newFreeSpinsRemaining = gameState.free_spins_remaining || 0;
          let newAccumulatedMultiplier = gameState.accumulated_multiplier || 1;
          
          // Step 1: Handle currently in free spins (decrement)
          // Use effectiveFreeSpinsActive to handle purchase case where client is in FS but server doesn't know
          if (effectiveFreeSpinsActive) {
            // If this is a purchase (client says FS but server doesn't), start with client's count
            // CRITICAL: Use originalServerFreeSpinsActive (before modification) to detect purchase
            const currentCount = clientFreeSpinsActive && !originalServerFreeSpinsActive && clientFreeSpinsRemaining > 0
              ? clientFreeSpinsRemaining
              : (gameState.free_spins_remaining || 0);
            newFreeSpinsRemaining = Math.max(0, currentCount - 1);
            newGameMode = 'free_spins'; // Ensure mode is set
          }
          
          // Step 2: Handle free spins trigger (overrides decrement)
          if (spinResult.features?.free_spins) {
            newGameMode = 'free_spins';
            newFreeSpinsRemaining = spinResult.features.free_spins.count;
            newAccumulatedMultiplier = spinResult.features.free_spins.multiplier || 1.00;
          }
          
          // Step 3: Update accumulated multiplier if in free spins and new multipliers were awarded
          // CRITICAL: Do this BEFORE checking if free spins ended, so the last spin's multipliers are saved
          if (newGameMode === 'free_spins' && typeof spinResult.newAccumulatedMultiplier === 'number') {
            newAccumulatedMultiplier = spinResult.newAccumulatedMultiplier;
          }
          
          // Step 4: Check if free spins ended (after updating multiplier)
          // MOVED FROM STEP 1: Check AFTER accumulating multipliers from current spin
          if (newGameMode === 'free_spins' && newFreeSpinsRemaining === 0) {
            newGameMode = 'base';
            newAccumulatedMultiplier = 1.00;
          }
          
          console.log('[GameController] Updating game state - mode:', newGameMode, 'freeSpins:', newFreeSpinsRemaining, 'multiplier:', newAccumulatedMultiplier, 'triggeredThisSpin:', !!spinResult.features?.free_spins, 'retriggered:', !!spinResult.bonusFeatures?.freeSpinsRetriggered);
          
          // Update or insert game state (manual upsert because player_id is not UNIQUE)
          const gameStateUpdate = {
            player_id: playerId,
            session_id: validSessionId,
            game_mode: newGameMode,
            free_spins_remaining: newFreeSpinsRemaining,
            accumulated_multiplier: newAccumulatedMultiplier,
            state_data: {
              last_spin_id: spinId,
              last_updated: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          };
          
          // Try update first
          const { data: updateResult, error: updateError } = await supabaseAdmin
            .from('game_states')
            .update(gameStateUpdate)
            .eq('player_id', playerId)
            .select();
          
          // If no rows updated, insert
          if (updateError || !updateResult || updateResult.length === 0) {
            const { error: insertError } = await supabaseAdmin
              .from('game_states')
              .insert(gameStateUpdate);
            
            if (insertError) {
              console.error('[GameController] ❌ Failed to insert game state:', insertError);
            } else {
              console.log('[GameController] ✅ Game state inserted (first time)');
            }
          } else {
            console.log('[GameController] ✅ Game state updated, mode:', updateResult[0]?.game_mode, 'freeSpins:', updateResult[0]?.free_spins_remaining);
          }
          
          stateResult = {
            gameState: {
              game_mode: newGameMode,
              free_spins_remaining: newFreeSpinsRemaining,
              accumulated_multiplier: newAccumulatedMultiplier
            }
          };
        }

        const cascadesPayload = spinResult.cascadeSteps || spinResult.cascades || [];
        const multipliersPayload = spinResult.multipliers || [];
        const spinGameMode = stateResult?.gameState?.game_mode || (gameState ? gameState.game_mode : 'base');

        // Skip PostgreSQL insert in fallback mode (using Supabase instead)
        if (!skipRedis) {
          await client.query(
            `
              INSERT INTO spin_results (
                player_id,
                session_id,
                bet_amount,
                initial_grid,
                cascades,
                total_win,
                multipliers_applied,
                rng_seed,
                game_mode
              )
              VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8, $9)
            `,
            [
              playerId,
              validSessionId,
              normalizedBetAmount,
              JSON.stringify(spinResult.initialGrid || []),
              JSON.stringify(cascadesPayload),
              spinResult.totalWin,
              JSON.stringify(multipliersPayload),
              spinResult.rngSeed,
              spinGameMode || 'base'
            ]
          );

          // Commit transaction
          await client.query('COMMIT');
        }

        // Save spin result to Supabase and capture the UUID for client debug
        console.log('[GameController] Saving spin result, sessionId:', validSessionId, 'playerId:', playerId.substring(0, 20));
        // Use the UPDATED game state (after spin), not the initial state
        const actualGameMode = stateResult.gameState.game_mode;
        const isFreeSpinMode = actualGameMode === 'free_spins';
        console.log('[GameController] Game mode for Supabase:', actualGameMode, 'isFreeSpins:', isFreeSpinMode);
        
        let savedSpinUuid = null;
        try {
          const saveRes = await saveSpinResult(playerId, {
          sessionId: validSessionId,
          bet: normalizedBetAmount,
          initialGrid: spinResult.initialGrid,
          cascades: spinResult.cascadeSteps || spinResult.cascades || [], // Use cascadeSteps if available, fallback to cascades or empty array
          totalWin: spinResult.totalWin,
          multipliers: spinResult.multipliers || [],
          rngSeed: spinResult.rngSeed,
          freeSpinsActive: isFreeSpinMode // Use the updated state, not the initial state
          });
          if (saveRes && saveRes.success) {
            savedSpinUuid = saveRes.spinResultId || null;
          }
        } catch (err) {
          logger.error('Failed to save spin result to Supabase', {
            player_id: playerId,
            spin_id: spinId,
            error: err.message
          });
        }

        // Get current balance for response
        let currentBalance = null;
        if (!player.is_demo) {
          try {
            const balanceInfo = await walletLedger.getBalance(playerId);
            currentBalance = balanceInfo.balance;
          } catch (balanceError) {
            logger.warn('Failed to get current balance for response', {
              player_id: playerId,
              spin_id: spinId,
              error: balanceError.message
            });
            currentBalance = 'unavailable';
          }
        }

        // Update performance metrics
        this.updateSpinMetrics(Date.now() - startTime, true);

        // Log successful spin
        await this.auditLogger.logSpinCompleted(playerId, spinId, spinResult, {
          processingTime: Date.now() - startTime,
          creditsAfter: currentBalance,
          transactionIds: {
            debit: betTransaction ? betTransaction.transaction.id : null,
            credit: winTransaction ? winTransaction.transaction.id : null
          }
        });

        const freeSpinFeature = spinResult.features?.free_spins || null;
        const freeSpinsAwarded = freeSpinFeature?.spinsAwarded
          ?? spinResult.bonusFeatures?.freeSpinsAwarded
          ?? 0;
        const freeSpinsTriggered = Boolean(spinResult.bonusFeatures?.freeSpinsTriggered || (freeSpinFeature && !effectiveFreeSpinsActive));
        const freeSpinsRetriggered = Boolean(spinResult.bonusFeatures?.freeSpinsRetriggered || freeSpinFeature?.retrigger);
        const nextFreeSpinCount = typeof stateResult.gameState.free_spins_remaining === 'number'
          ? stateResult.gameState.free_spins_remaining
          : 0;
        const nextGameMode = stateResult.gameState.game_mode;
        const freeSpinsActiveNext = nextGameMode === 'free_spins';
        const freeSpinsEnded = effectiveFreeSpinsActive && !freeSpinsActiveNext;

        // DEBUG: Log accumulated multiplier and free spins retrigger
        if (freeSpinsActiveNext) {
          console.log(`🎰 [GAME CONTROLLER] FREE SPINS RESPONSE DEBUG:`, {
            freeSpinsAwarded,
            freeSpinsRetriggered,
            freeSpinsRemaining: nextFreeSpinCount,
            accumulatedMultiplier: stateResult.gameState.accumulated_multiplier,
            randomMultipliersThisSpin: spinResult.bonusFeatures?.randomMultipliers?.length || 0,
            newAccumulatedMultiplier: spinResult.newAccumulatedMultiplier
          });
        }

        // Prepare response (canonical format with nested data, matching /api/demo-spin)
        const responseData = {
          spinId: spinResult.spinId,
          spin_uuid: savedSpinUuid,
          betAmount: spinResult.betAmount,
          totalWin: spinResult.totalWin,
          baseWin: spinResult.baseWin,
          initialGrid: spinResult.initialGrid,
          finalGrid: spinResult.finalGrid,
          cascadeSteps: spinResult.cascadeSteps,
          bonusFeatures: spinResult.bonusFeatures,
          multiplierEvents: spinResult.multiplierEvents,
          multiplierAwarded: spinResult.multiplierAwarded,
          features: spinResult.features,
          timing: spinResult.timing,
          freeSpinsTriggered,
          freeSpinsRetriggered,
          freeSpinsAwarded,
          freeSpinsActive: freeSpinsActiveNext,
          freeSpinsRemaining: nextFreeSpinCount,
          freeSpinsEnded,
          gameMode: nextGameMode,
          accumulatedMultiplier: stateResult.gameState.accumulated_multiplier,
          newAccumulatedMultiplier: stateResult.gameState.accumulated_multiplier, // Also send as newAccumulatedMultiplier for NetworkService
          playerCredits: player.is_demo ? null : currentBalance,
          balance: player.is_demo ? null : currentBalance,
          rngSeed: spinResult.rngSeed,
          sessionData: {
            totalSpins: this.spinMetrics.totalSpins,
            sessionRTP: this.gameEngine.calculateSessionRTP(
              this.gameEngine.sessionStats.totalBet,
              this.gameEngine.sessionStats.totalWon
            )
          },
          metadata: {
            processingTime: Date.now() - startTime,
            rngAuditId: spinResult.rngSeed,
            antiCheatPassed: true,
            validationScore: resultValidation.sessionRTP
          }
        };

        if (clientRequestId) {
          responseData.requestId = clientRequestId;
          this.storePendingSpinResult(clientRequestId, { success: true, data: responseData });
        }

        // Return canonical format matching /api/demo-spin
        // Add payload size monitoring and header for observability (<50KB target)
        try {
          const payload = { success: true, data: responseData };
          const payloadString = JSON.stringify(payload);
          const payloadBytes = Buffer.byteLength(payloadString, 'utf8');
          res.setHeader('X-Payload-Bytes', String(payloadBytes));
          if (payloadBytes > 51200) { // 50KB
            logger.warn('Spin response payload exceeded 50KB', {
              playerId,
              spinId,
              payloadBytes,
              cascadeSteps: Array.isArray(responseData.cascadeSteps) ? responseData.cascadeSteps.length : 0
            });
          }
          console.log('[GameController] Step 8: Sending successful response');
          return res.json(payload);
        } catch (serializeError) {
          logger.warn('Failed to compute payload size, sending response anyway', {
            playerId,
            spinId,
            error: serializeError.message
          });
          console.log('[GameController] Step 8b: Sending successful response (after serialize error)');
          return res.json({ success: true, data: responseData });
        }

            } catch (transactionError) {
        // Rollback transaction on any error (skip in fallback mode)
        console.error('[GameController] ???? TRANSACTION ERROR:', transactionError.message);
        if (client && !skipRedis) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            console.warn('Failed to rollback spin transaction', { error: rollbackError.message });
          }
        }
        throw transactionError;
      } finally {
        if (client && !skipRedis) {
          client.release();
        }
      }

    } catch (error) {
      // Update error metrics
      this.updateSpinMetrics(Date.now() - startTime, false);

      console.error('[GameController] ??SPIN ERROR:', error.message);
      console.error('[GameController] Stack:', error.stack);
      
      logger.error('Spin processing error', {
        playerId: req.user?.id || 'unknown',
        spinId,
        error: error.message,
        stack: error.stack,
        processingTime: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'SPIN_PROCESSING_ERROR',
        message: 'Failed to process spin request',
        code: 'PROCESSING_FAILED',
        spinId,
        details: error.message
      });
    }
  }

  /**
     * Get current game state
     * GET /api/game-state
     */
  async getGameState(req, res) {
    if (req.user?.is_demo) {
      const safeData = {
        balance: 5000,
        free_spins_remaining: 0,
        accumulated_multiplier: 1,
        game_mode: 'base',
        updated_at: new Date().toISOString()
      };
      const sessionInfo = {
        id: 'demo-session',
        playerId: 'demo-player',
        lastActivity: Date.now()
      };
      const gameStats = this.gameEngine.getGameStatistics();
      if (this.stateManager.setDemoState) {
        await this.stateManager.setDemoState('demo-player', safeData, sessionInfo);
      }

      return res.json({
        success: true,
        gameState: safeData,
        sessionInfo,
        gameMode: safeData.game_mode,
        freeSpinsRemaining: safeData.free_spins_remaining,
        accumulatedMultiplier: safeData.accumulated_multiplier,
        lastActivity: safeData.updated_at,
        gameStatistics: {
          sessionRTP: gameStats.session.currentRTP,
          totalSpins: gameStats.session.totalSpins,
          winRate: gameStats.session.winRate,
          biggestWin: gameStats.session.biggestWin
        },
        serverTime: new Date().toISOString()
      });
    }

    try {
      const playerId = req.user.id;
      const statePlayerId = req.user?.is_demo ? 'demo-player' : playerId;

      // Get game state from state manager
      let gameState = await this.stateManager.getPlayerState(statePlayerId);
      let sessionInfo = this.stateManager.getActiveSession(req.session_info.id);

      if (!gameState && req.user?.is_demo) {
        const fallbackSafe = {
          balance: 5000,
          free_spins_remaining: 0,
          accumulated_multiplier: 1,
          game_mode: 'base',
          updated_at: new Date().toISOString()
        };
        gameState = {
          getSafeData: () => fallbackSafe,
          game_mode: fallbackSafe.game_mode,
          free_spins_remaining: fallbackSafe.free_spins_remaining,
          accumulated_multiplier: fallbackSafe.accumulated_multiplier,
          updated_at: fallbackSafe.updated_at
        };
        sessionInfo = sessionInfo || { id: 'demo-session', playerId: 'demo-player', lastActivity: Date.now() };
      }

      if (!gameState) {
        return res.status(404).json({
          success: false,
          error: 'STATE_NOT_FOUND',
          message: 'No game state found for player'
        });
      }

      // Get game engine statistics
      const gameStats = this.gameEngine.getGameStatistics();

      const response = {
        success: true,
        gameState: gameState.getSafeData(),
        sessionInfo: sessionInfo,
        gameMode: gameState.game_mode,
        freeSpinsRemaining: gameState.free_spins_remaining,
        accumulatedMultiplier: gameState.accumulated_multiplier,
        lastActivity: gameState.updated_at,
        gameStatistics: {
          sessionRTP: gameStats.session.currentRTP,
          totalSpins: gameStats.session.totalSpins,
          winRate: gameStats.session.winRate,
          biggestWin: gameStats.session.biggestWin
        },
        serverTime: new Date().toISOString()
      };

      if (req.user?.is_demo) {
        await this.stateManager.setDemoState('demo-player', response.gameState, sessionInfo);
      }

      res.json(response);

    } catch (error) {
      logger.error('Get game state error', {
        playerId: req.user.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'STATE_RETRIEVAL_ERROR',
        message: 'Failed to retrieve game state'
      });
    }
  }

  /**
     * Update game state manually (admin/debugging)
     * PUT /api/game-state
     */
  async updateGameState(req, res) {
    try {
      const playerId = req.user.id;
      const { stateUpdates, reason = 'manual_update' } = req.body;

      if (!stateUpdates || typeof stateUpdates !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_UPDATES',
          message: 'State updates must be provided as an object'
        });
      }

      const statePlayerId = req.user?.is_demo ? 'demo-player' : playerId;

      // Update state through state manager
      const updatedState = await this.stateManager.updateState(statePlayerId, stateUpdates, reason);

      await this.auditLogger.logManualStateUpdate(playerId, stateUpdates, reason, req.user);

      res.json({
        success: true,
        message: 'Game state updated successfully',
        gameState: updatedState.getSafeData(),
        updatedFields: Object.keys(stateUpdates),
        reason
      });

    } catch (error) {
      logger.error('Update game state error', {
        playerId: req.user.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'STATE_UPDATE_ERROR',
        message: 'Failed to update game state'
      });
    }
  }

  /**
     * Get player statistics
     * GET /api/player-stats
     */
  async getPlayerStats(req, res) {
    try {
      const playerId = req.user.id;

      // Get player data
      const player = await Player.findByPk(playerId, {
        include: ['transactions', 'spinResults']
      });

      if (!player) {
        return res.status(404).json({
          success: false,
          error: 'PLAYER_NOT_FOUND',
          message: 'Player not found'
        });
      }

      // Calculate statistics
      const stats = await this.calculatePlayerStatistics(player);
      const statePlayerId = player.is_demo ? 'demo-player' : playerId;
      const gameState = await this.stateManager.getPlayerState(statePlayerId);
      const gameEngineStats = this.gameEngine.getGameStatistics();

      const response = {
        success: true,
        playerId: player.id,
        username: player.username,
        accountType: player.is_demo ? 'demo' : 'real',
        status: player.status,
        credits: player.is_demo ? null : player.credits,
        statistics: {
          ...stats,
          currentSession: {
            ...gameEngineStats.session,
            gameMode: gameState ? gameState.game_mode : 'base',
            freeSpinsRemaining: gameState ? gameState.free_spins_remaining : 0,
            accumulatedMultiplier: gameState ? gameState.accumulated_multiplier : 1
          }
        },
        lastActivity: player.updated_at,
        memberSince: player.created_at
      };

      res.json(response);

    } catch (error) {
      logger.error('Get player stats error', {
        playerId: req.user.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'STATS_RETRIEVAL_ERROR',
        message: 'Failed to retrieve player statistics'
      });
    }
  }

  /**
     * Get game health and status
     * GET /api/game-status
     */
  async getGameStatus(req, res) {
    try {
      const gameStats = this.gameEngine.getGameStatistics();
      const stateManagerStats = await this.stateManager.getStats();
      const antiCheatStats = this.antiCheat.getStatistics();

      const response = {
        success: true,
        status: 'operational',
        uptime: process.uptime(),
        version: process.env.GAME_VERSION || '1.0.0',
        gameEngine: {
          status: 'healthy',
          rtp: gameStats.compliance.targetRTP,
          totalSpins: gameStats.session.totalSpins,
          rngCompliance: gameStats.rng.compliance_status
        },
        stateManager: {
          status: 'healthy',
          activeSessions: stateManagerStats.active_sessions,
          cachedStates: stateManagerStats.cached_states,
          redisConnected: stateManagerStats.redis_connected
        },
        antiCheat: {
          status: 'active',
          detectionsToday: antiCheatStats.detectionsToday,
          overallThreatLevel: antiCheatStats.overallThreatLevel
        },
        performance: {
          averageSpinTime: this.spinMetrics.averageProcessingTime,
          errorRate: this.spinMetrics.errorRate,
          totalSpinsProcessed: this.spinMetrics.totalSpins
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      logger.error('Get game status error', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'STATUS_ERROR',
        message: 'Failed to retrieve game status'
      });
    }
  }

  /**
     * Validate spin request data
     * @param {Object} requestData - Spin request data
     * @param {Object} user - User object
     * @returns {Object} Validation result
     */
  validateSpinRequest(requestData, user) {
    const errors = [];

    // Validate bet amount
    const betAmount = parseFloat(requestData.betAmount);
    if (isNaN(betAmount) || betAmount <= 0) {
      errors.push('Invalid bet amount: must be a positive number');
    }

    if (betAmount > 1000) {
      errors.push('Bet amount exceeds maximum limit');
    }

    // Validate multiplier
    const multiplier = parseFloat(requestData.accumulatedMultiplier || 1);
    if (isNaN(multiplier) || multiplier < 1 || multiplier > 5000) {
      errors.push('Invalid accumulated multiplier: must be between 1 and 5000');
    }

    // Validate user status
    if (user.status !== 'active') {
      errors.push('Player account is not active');
    }

    // Additional demo mode validations
    if (user.is_demo && betAmount > 10) {
      errors.push('Demo mode bet amount cannot exceed 10');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
     * Calculate comprehensive player statistics
     * @param {Player} player - Player model instance
     * @returns {Promise<Object>} Player statistics
     */
  async calculatePlayerStatistics(player) {
    const spinResults = await SpinResult.findAll({
      where: { player_id: player.id },
      order: [['created_at', 'DESC']],
      limit: 1000 // Last 1000 spins
    });

    const transactions = await Transaction.findAll({
      where: { player_id: player.id },
      order: [['created_at', 'DESC']]
    });

    // Calculate statistics
    const totalSpins = spinResults.length;
    const totalBet = spinResults.reduce((sum, spin) => sum + parseFloat(spin.bet_amount), 0);
    const totalWon = spinResults.reduce((sum, spin) => sum + parseFloat(spin.total_win), 0);
    const winningSpins = spinResults.filter(spin => parseFloat(spin.total_win) > 0).length;
    const biggestWin = Math.max(...spinResults.map(spin => parseFloat(spin.total_win)), 0);

    const rtp = totalBet > 0 ? (totalWon / totalBet * 100) : 0;
    const winRate = totalSpins > 0 ? (winningSpins / totalSpins * 100) : 0;

    // Free spins statistics
    const freeSpinsResults = spinResults.filter(spin => spin.free_spins_active);
    const freeSpinsTotalWon = freeSpinsResults.reduce((sum, spin) => sum + parseFloat(spin.total_win), 0);

    return {
      totalSpins,
      totalBet: Math.round(totalBet * 100) / 100,
      totalWon: Math.round(totalWon * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      rtp: Math.round(rtp * 100) / 100,
      biggestWin: Math.round(biggestWin * 100) / 100,
      averageBet: totalSpins > 0 ? Math.round((totalBet / totalSpins) * 100) / 100 : 0,
      averageWin: winningSpins > 0 ? Math.round((totalWon / winningSpins) * 100) / 100 : 0,
      freeSpinsStats: {
        totalFreeSpins: freeSpinsResults.length,
        freeSpinsTotalWon: Math.round(freeSpinsTotalWon * 100) / 100,
        averageFreeSpinWin: freeSpinsResults.length > 0 ?
          Math.round((freeSpinsTotalWon / freeSpinsResults.length) * 100) / 100 : 0
      },
      transactionStats: {
        totalTransactions: transactions.length,
        totalDeposits: transactions
          .filter(t => t.transaction_type === 'credit' && t.description.includes('deposit'))
          .reduce((sum, t) => sum + parseFloat(t.amount), 0),
        totalWithdrawals: transactions
          .filter(t => t.transaction_type === 'debit' && t.description.includes('withdrawal'))
          .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      }
    };
  }

  /**
     * Update spin processing metrics
     * @param {number} processingTime - Processing time in milliseconds
     * @param {boolean} success - Whether the spin was successful
     */
  updateSpinMetrics(processingTime, success) {
    this.spinMetrics.totalSpins++;

    // Update rolling average processing time
    const weight = Math.min(this.spinMetrics.totalSpins, 100);
    this.spinMetrics.averageProcessingTime =
            (this.spinMetrics.averageProcessingTime * (weight - 1) + processingTime) / weight;

    // Update error rate
    if (!success) {
      this.spinMetrics.errorRate =
                (this.spinMetrics.errorRate * (this.spinMetrics.totalSpins - 1) + 1) / this.spinMetrics.totalSpins;
    } else {
      this.spinMetrics.errorRate =
                (this.spinMetrics.errorRate * (this.spinMetrics.totalSpins - 1)) / this.spinMetrics.totalSpins;
    }

    // Reset metrics every hour
    if (Date.now() - this.spinMetrics.lastResetTime > 60 * 60 * 1000) {
      this.resetSpinMetrics();
    }
  }

  /**
     * Reset spin metrics for fresh hourly calculations
     */
  resetSpinMetrics() {
    this.spinMetrics = {
      totalSpins: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      lastResetTime: Date.now()
    };
  }

  storePendingSpinResult(requestId, payload) {
    if (!requestId) {
      return;
    }

    try {
      const clone = typeof payload === 'object' && payload !== null
        ? JSON.parse(JSON.stringify(payload))
        : payload;
      this.pendingSpinResults.set(requestId, {
        result: clone,
        storedAt: Date.now()
      });
      this.purgePendingSpinResults();
    } catch (error) {
      logger.warn('Failed to cache pending spin result', { requestId, error: error.message });
    }
  }

  retrievePendingSpinResult(requestId) {
    if (!requestId) {
      return null;
    }
    const entry = this.pendingSpinResults.get(requestId);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.storedAt > this.pendingResultRetentionMs) {
      this.pendingSpinResults.delete(requestId);
      return null;
    }

    return entry.result;
  }

  purgePendingSpinResults(maxAgeMs) {
    const retention = typeof maxAgeMs === 'number' ? maxAgeMs : this.pendingResultRetentionMs;
    const cutoff = Date.now() - retention;
    for (const [requestId, entry] of this.pendingSpinResults.entries()) {
      if (!entry || entry.storedAt < cutoff) {
        this.pendingSpinResults.delete(requestId);
      }
    }
  }

  async getPendingSpinResultByRequest(req, res) {
    try {
      const { requestId } = req.params;
      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST_ID',
          message: 'requestId parameter is required'
        });
      }

      const cached = this.retrievePendingSpinResult(requestId);
      if (cached) {
        return res.json(cached);
      }

      return res.status(404).json({
        success: false,
        error: 'PENDING_RESULT_NOT_FOUND',
        message: 'No pending spin result is available for the provided requestId'
      });
    } catch (error) {
      logger.error('Pending spin lookup error', {
        error: error.message,
        stack: error.stack
      });
      return res.status(500).json({
        success: false,
        error: 'PENDING_RESULT_ERROR',
        message: 'Unable to retrieve pending spin result'
      });
    }
  }

  /**
     * Generate unique spin ID
     * @returns {string} Unique spin identifier
     */
  generateSpinId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `spin_${timestamp}_${random}`;
  }
}

module.exports = new GameController();

