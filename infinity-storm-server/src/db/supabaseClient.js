// Supabase client configuration
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables from multiple potential locations so local dev works regardless of cwd
const envCandidates = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(process.cwd(), '.env')
];

envCandidates.forEach((candidate) => {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  }
});

// Utility to normalize usernames for comparisons
const normalizeUsername = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseAnonKey || !supabaseServiceKey) {
  console.warn('⚠️ Supabase keys not found in environment variables');
}

// Create public client (for client-side operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  },
  db: {
    schema: 'public'
  }
});

const DEFAULT_TEST_PASSWORD = process.env.TEST_PLAYER_DEFAULT_PASSWORD || 'PortalTest!234';
const DEFAULT_TEST_EMAIL_DOMAIN = process.env.TEST_PLAYER_DEFAULT_EMAIL_DOMAIN || 'portal.test';
const DEMO_IDENTIFIER = 'demo-player';
const DEMO_SESSION_ID = 'demo-session';

const normalizeInitialCredits = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parseFloat(parsed.toFixed(2));
};
// Create admin client (for server-side operations with full privileges)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Helper functions for common database operations

/**
 * Get player by ID or username
 */
async function getPlayer(identifier) {
  try {
    console.log('[getPlayer] Looking up identifier:', identifier, 'type:', typeof identifier);
    let query = supabaseAdmin.from('players').select('*');

    // Check if identifier is UUID or username
    if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.log('[getPlayer] Querying by ID');
      query = query.eq('id', identifier);
    } else {
      console.log('[getPlayer] Querying by username');
      query = query.eq('username', identifier);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('[getPlayer] Error fetching player:', error, 'identifier:', identifier);
      return null;
    }
    
    console.log('[getPlayer] Found player:', data ? data.username : 'NULL');

    return data;
  } catch (err) {
    console.error('Error in getPlayer:', err);
    return null;
  }
}

/**
 * Get player balance
 */
async function getPlayerBalance(playerId) {
  try {
    const player = await getPlayer(playerId);
    if (!player) {
      return { error: 'Player not found', balance: 0 };
    }

    return {
      balance: parseFloat(player.credits || 0),
      playerId: player.id,
      username: player.username
    };
  } catch (err) {
    console.error('Error getting balance:', err);
    return { error: err.message, balance: 0 };
  }
}

/**
 * Update player balance
 */
async function updatePlayerBalance(playerId, newBalance) {
  try {
    const { data, error } = await supabaseAdmin
      .from('players')
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', playerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating balance:', error);
      return { error: error.message };
    }

    return { success: true, balance: parseFloat(data.credits) };
  } catch (err) {
    console.error('Error in updatePlayerBalance:', err);
    return { error: err.message };
  }
}

/**
 * Create transaction record
 */
async function createTransaction(playerId, type, amount, balanceBefore, balanceAfter, description) {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert({
        player_id: playerId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return { error: error.message };
    }

    return { success: true, transaction: data };
  } catch (err) {
    console.error('Error in createTransaction:', err);
    return { error: err.message };
  }
}

// Legacy 'spins' table helper removed in favor of spin_results.
async function recordSpinResult() {
  return { error: 'Deprecated: use saveSpinResult() (spin_results) instead' };
}

/**
 * Process bet (deduct from balance and create transaction)
 */
async function processBet(playerId, betAmount) {
  try {
    // Get current balance
    const { balance: currentBalance, error: balanceError } = await getPlayerBalance(playerId);
    if (balanceError) {
      return { error: balanceError };
    }

    // Check sufficient funds
    if (currentBalance < betAmount) {
      return { error: 'Insufficient balance' };
    }

    // Calculate new balance
    const newBalance = currentBalance - betAmount;

    // Update balance
    const { error: updateError } = await updatePlayerBalance(playerId, newBalance);
    if (updateError) {
      return { error: updateError };
    }

    // Create transaction record
    await createTransaction(
      playerId,
      'bet',
      -betAmount,
      currentBalance,
      newBalance,
      `Bet ${betAmount}`
    );

    return {
      success: true,
      balance: newBalance,
      previousBalance: currentBalance
    };
  } catch (err) {
    console.error('Error processing bet:', err);
    return { error: err.message };
  }
}

/**
 * Process win (add to balance and create transaction)
 */
async function processWin(playerId, winAmount) {
  try {
    // Get current balance
    const { balance: currentBalance, error: balanceError } = await getPlayerBalance(playerId);
    if (balanceError) {
      return { error: balanceError };
    }

    // Calculate new balance
    const newBalance = currentBalance + winAmount;

    // Update balance
    const { error: updateError } = await updatePlayerBalance(playerId, newBalance);
    if (updateError) {
      return { error: updateError };
    }

    // Create transaction record
    await createTransaction(
      playerId,
      'win',
      winAmount,
      currentBalance,
      newBalance,
      `Win ${winAmount}`
    );

    return {
      success: true,
      balance: newBalance,
      previousBalance: currentBalance
    };
  } catch (err) {
    console.error('Error processing win:', err);
    return { error: err.message };
  }
}

/**
 * Save spin result to database
 */
async function saveSpinResult(playerId, spinData) {
  try {
    // Handle demo player - convert string 'demo-player' to actual UUID
    let actualPlayerId = playerId;
    let actualSessionId = spinData.sessionId;

    const playerIdentifier = typeof playerId === 'string' ? playerId.trim() : '';
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(playerIdentifier);

    if (playerIdentifier && !isUuid) {
      const ensureResult = await ensureTestPlayer(playerIdentifier, {
        allowCreate: true,
        markDemo: normalizeUsername(playerIdentifier) === normalizeUsername(DEMO_IDENTIFIER),
        initialCredits: normalizeInitialCredits(spinData.initialCredits || 0),
        returnPassword: false
      });

      if (ensureResult?.error) {
        return { error: ensureResult.error };
      }

      actualPlayerId = ensureResult.player.id;
    }

    // Handle demo session - set to null since we don't have a real session UUID
    if (actualSessionId === DEMO_SESSION_ID) {
      actualSessionId = null;
    }
    
    // Save to spin_results table
    // Ensure cascades is always an array (not null/undefined) to satisfy NOT NULL constraint
    const cascadesArray = Array.isArray(spinData.cascades) ? spinData.cascades : [];
    
    const { data: spinResult, error: spinError } = await supabaseAdmin
      .from('spin_results')
      .insert({
        player_id: actualPlayerId,
        session_id: actualSessionId,
        bet_amount: spinData.bet,
        initial_grid: spinData.initialGrid,
        cascades: cascadesArray,
        total_win: spinData.totalWin,
        multipliers_applied: spinData.multipliers || [],
        rng_seed: spinData.rngSeed || 'demo_seed_' + Date.now(),
        game_mode: spinData.freeSpinsActive ? 'free_spins' : 'base'
      })
      .select()
      .single();

    if (spinError) {
      console.error('Error saving spin result to Supabase:', spinError);
      console.error('Spin data:', { playerId: actualPlayerId, sessionId: actualSessionId, bet: spinData.bet });
      return { error: spinError.message };
    }

    console.log('✅ Spin result saved to Supabase:', spinResult.id, '| Player:', actualPlayerId, '| Win:', spinData.totalWin);
    return { success: true, spinResultId: spinResult.id };
  } catch (err) {
    console.error('Error saving spin result to Supabase:', err);
    return { error: err.message };
  }
}

/**
 * Get demo player or create one
 */
async function getDemoPlayer() {
  const result = await ensureTestPlayer(DEMO_IDENTIFIER, {
    allowCreate: true,
    markDemo: true,
    initialCredits: 5000,
    returnPassword: false
  });
  return result.player || null;
}

/**
 * Ensure a test player exists (create if missing)
 */
async function ensureTestPlayer(identifier, options = {}) {
  try {
    const trimmed = (identifier || '').trim();
    const {
      allowCreate = true,
      markDemo = false,
      initialCredits = 0,
      returnPassword = false,
      predefinedId = null
    } = options;

    if (!trimmed) {
      return { error: 'Player identifier is required' };
    }

    // Build a set of identifiers we consider equivalent to the canonical test player
    const candidateIdentifiers = new Set();
    candidateIdentifiers.add(trimmed);
    candidateIdentifiers.add(normalizeUsername(trimmed));

    if (markDemo) {
      candidateIdentifiers.add(DEMO_IDENTIFIER);
      candidateIdentifiers.add(normalizeUsername(DEMO_IDENTIFIER));
    }

    // Attempt to fetch an existing player using any candidate identifier
    for (const candidate of candidateIdentifiers) {
      if (!candidate) {
        continue;
      }
      const player = await getPlayer(candidate);
      if (player) {
        return {
          player,
          created: false,
          password: returnPassword ? DEFAULT_TEST_PASSWORD : undefined
        };
      }
    }

    if (!allowCreate) {
      return { error: `Player '${trimmed}' not found and automatic creation disabled` };
    }

    const normalizedUsername = normalizeUsername(trimmed);
    const username = normalizedUsername || `test_player_${Date.now()}`;
    const now = new Date().toISOString();
    const email = `${username}@${DEFAULT_TEST_EMAIL_DOMAIN}`;
    const passwordHash = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);
    const insertPayload = {
      username,
      email,
      password_hash: passwordHash,
      credits: normalizeInitialCredits(initialCredits),
      is_demo: Boolean(markDemo),
      status: 'active',
      created_at: now,
      updated_at: now
    };

    if (predefinedId) {
      insertPayload.id = predefinedId;
    }

    const { data, error } = await supabaseAdmin
      .from('players')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating test player:', error);

      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        for (const retryCandidate of candidateIdentifiers) {
          if (!retryCandidate) {
            continue;
          }
          const retryPlayer = await getPlayer(retryCandidate);
          if (retryPlayer) {
            return {
              player: retryPlayer,
              created: false,
              password: returnPassword ? DEFAULT_TEST_PASSWORD : undefined
            };
          }
        }
      }

      return { error: error.message };
    }

    return {
      player: data,
      created: true,
      password: returnPassword ? DEFAULT_TEST_PASSWORD : undefined
    };
  } catch (err) {
    console.error('ensureTestPlayer failed:', err);
    return { error: err.message };
  }
}

module.exports = {
  supabase,
  supabaseAdmin,
  getPlayer,
  getPlayerBalance,
  updatePlayerBalance,
  createTransaction,
  recordSpinResult,
  processBet,
  processWin,
  saveSpinResult,
  getDemoPlayer,
  ensureTestPlayer
};

/**
 * Fetch paginated spin history for a player from spin_results (preferred) with fallback to spins.
 * @param {string} playerId
 * @param {number} limit - max 200
 * @param {number} offset
 * @param {'asc'|'desc'} order
 */
async function getSpinHistory(playerId, limit = 200, offset = 0, order = 'desc') {
  try {
    const cappedLimit = Math.min(Math.max(1, Number(limit) || 200), 200);
    const start = Number(offset) || 0;
    const end = start + cappedLimit - 1;

    // Try spin_results first
    let { data, error, count } = await supabaseAdmin
      .from('spin_results')
      .select('*', { count: 'exact' })
      .eq('player_id', playerId)
      .order('created_at', { ascending: order === 'asc' })
      .range(start, end);

    if (error) {
      console.warn('getSpinHistory spin_results error, falling back to spins:', error.message);
    }

    if (!error && Array.isArray(data)) {
      return { table: 'spin_results', rows: data, total: count || data.length };
    }

    // Legacy spins table no longer queried
    return { table: 'spin_results', rows: [], total: 0 };
  } catch (err) {
    console.error('getSpinHistory exception:', err);
    return { error: err.message };
  }
}

module.exports.getSpinHistory = getSpinHistory;
