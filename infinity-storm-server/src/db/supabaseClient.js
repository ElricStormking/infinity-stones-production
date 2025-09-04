// Supabase client configuration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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
    let query = supabaseAdmin.from('players').select('*');

    // Check if identifier is UUID or username
    if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('username', identifier);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching player:', error);
      return null;
    }

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

/**
 * Record spin result
 */
async function recordSpinResult(spinData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('spins')
      .insert({
        spin_id: spinData.spinId || `spin_${Date.now()}`,
        player_id: spinData.playerId || 'anonymous',
        bet_amount: spinData.betAmount,
        total_win: spinData.totalWin,
        rng_seed: spinData.rngSeed,
        initial_grid: spinData.initialGrid,
        cascades: spinData.cascades,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording spin:', error);
      return { error: error.message };
    }

    return { success: true, spin: data };
  } catch (err) {
    console.error('Error in recordSpinResult:', err);
    return { error: err.message };
  }
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
    // Save to spin_results table
    const { data: spinResult, error: spinError } = await supabaseAdmin
      .from('spin_results')
      .insert({
        player_id: playerId,
        bet_amount: spinData.bet,
        initial_grid: spinData.initialGrid,
        cascades: spinData.cascades,
        total_win: spinData.totalWin,
        multipliers_applied: spinData.multipliers || [],
        rng_seed: spinData.rngSeed || 'demo_seed_' + Date.now(),
        game_mode: spinData.freeSpinsActive ? 'free_spins' : 'base'
      })
      .select()
      .single();

    if (spinError) {
      console.error('Error saving spin result:', spinError);
      return { error: spinError.message };
    }

    console.log('Spin result saved to database:', spinResult.id);
    return { success: true, spinResultId: spinResult.id };
  } catch (err) {
    console.error('Error saving spin result:', err);
    return { error: err.message };
  }
}

/**
 * Get demo player or create one
 */
async function getDemoPlayer() {
  try {
    // Try to get existing demo player
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('username', 'demo_player')
      .single();

    if (existing && !fetchError) {
      return existing;
    }

    // Create new demo player if doesn't exist
    const { data: newPlayer, error: createError } = await supabaseAdmin
      .from('players')
      .insert({
        username: 'demo_player',
        email: 'demo@game.local',
        password_hash: 'demo_hash',
        credits: 5000.00,
        is_demo: true,
        status: 'active'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating demo player:', createError);
      // Return a default demo player object
      return {
        id: 'demo_' + Date.now(),
        username: 'demo_player',
        credits: 5000.00,
        is_demo: true
      };
    }

    return newPlayer;
  } catch (err) {
    console.error('Error in getDemoPlayer:', err);
    // Return a default demo player object
    return {
      id: 'demo_' + Date.now(),
      username: 'demo_player',
      credits: 5000.00,
      is_demo: true
    };
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
  getDemoPlayer
};