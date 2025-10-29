/**
 * Financial Transaction Logger
 *
 * Logs all player balance changes to the financial_transactions table
 * for complete audit trail and accounting purposes.
 *
 * Skips logging for demo players.
 */

const { supabaseAdmin } = require('../db/supabaseClient');
const { logger } = require('../utils/logger');

/**
 * Check if player is a demo player (skip logging)
 */
const isDemoPlayer = (playerId) => {
  return playerId === 'demo-player' || !playerId;
};

/**
 * Generic function to log a financial transaction
 */
async function logFinancialTransaction({
  playerId,
  transactionType,
  amount,
  balanceBefore,
  balanceAfter,
  referenceId = null,
  referenceType = null,
  description = null,
  metadata = null
}) {
  // Skip logging for demo players
  if (isDemoPlayer(playerId)) {
    logger.debug('Skipping financial transaction log for demo player');
    return { success: true, skipped: true, reason: 'demo_player' };
  }

  // Guard: allow disabling via env (default disabled for local/dev Docker)
  const enableSupabaseLog = (process.env.ENABLE_SUPABASE_FINANCIAL_LOG ?? 'false').toLowerCase() === 'true';
  if (!enableSupabaseLog) {
    logger.debug('Skipping Supabase financial log (ENABLE_SUPABASE_FINANCIAL_LOG=false)');
    return { success: true, skipped: true, reason: 'dev_skip' };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('financial_transactions')
      .insert({
        player_id: playerId,
        transaction_type: transactionType,
        amount: parseFloat(amount),
        balance_before: parseFloat(balanceBefore),
        balance_after: parseFloat(balanceAfter),
        reference_id: referenceId,
        reference_type: referenceType,
        description,
        metadata
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to log financial transaction', {
        error: error.message,
        playerId,
        transactionType,
        amount
      });
      return { success: false, error: error.message };
    }

    logger.info('Financial transaction logged', {
      id: data.id,
      playerId,
      transactionType,
      amount,
      balanceBefore,
      balanceAfter
    });

    return { success: true, data };
  } catch (err) {
    logger.error('Exception logging financial transaction', {
      error: err.message,
      stack: err.stack,
      playerId,
      transactionType
    });
    return { success: false, error: err.message };
  }
}

/**
 * Log bet deduction
 */
async function logBetDeduction(playerId, amount, balanceBefore, balanceAfter, spinId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'bet_deduction',
    amount: -Math.abs(amount), // Ensure negative
    balanceBefore,
    balanceAfter,
    referenceId: spinId,
    referenceType: spinId ? 'spin_result' : null,
    description: `Bet deduction of ${amount} credits`,
    metadata: { spin_id: spinId }
  });
}

/**
 * Log win payout
 */
async function logWinPayout(playerId, amount, balanceBefore, balanceAfter, spinId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'win_payout',
    amount: Math.abs(amount), // Ensure positive
    balanceBefore,
    balanceAfter,
    referenceId: spinId,
    referenceType: spinId ? 'spin_result' : null,
    description: `Win payout of ${amount} credits`,
    metadata: { spin_id: spinId }
  });
}

/**
 * Log free spins purchase
 */
async function logFreeSpinsPurchase(playerId, amount, balanceBefore, balanceAfter, purchaseId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'free_spins_purchase',
    amount: -Math.abs(amount), // Ensure negative (cost)
    balanceBefore,
    balanceAfter,
    referenceId: purchaseId,
    referenceType: 'free_spins_purchase',
    description: `Free spins purchase for ${Math.abs(amount)} credits`,
    metadata: { purchase_id: purchaseId }
  });
}

/**
 * Log portal deposit
 */
async function logPortalDeposit(playerId, amount, balanceBefore, balanceAfter, referenceId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'portal_deposit',
    amount: Math.abs(amount), // Ensure positive
    balanceBefore,
    balanceAfter,
    referenceId,
    referenceType: 'portal_transaction',
    description: `Portal deposit of ${amount} credits`,
    metadata: { portal_reference: referenceId }
  });
}

/**
 * Log portal withdrawal
 */
async function logPortalWithdrawal(playerId, amount, balanceBefore, balanceAfter, referenceId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'portal_withdrawal',
    amount: -Math.abs(amount), // Ensure negative
    balanceBefore,
    balanceAfter,
    referenceId,
    referenceType: 'portal_transaction',
    description: `Portal withdrawal of ${Math.abs(amount)} credits`,
    metadata: { portal_reference: referenceId }
  });
}

/**
 * Log adjustment (manual balance correction)
 */
async function logAdjustment(playerId, amount, balanceBefore, balanceAfter, reason, adminId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'adjustment',
    amount: parseFloat(amount),
    balanceBefore,
    balanceAfter,
    referenceId: adminId,
    referenceType: 'admin_adjustment',
    description: `Balance adjustment: ${reason}`,
    metadata: { reason, admin_id: adminId }
  });
}

/**
 * Log bonus credit
 */
async function logBonusCredit(playerId, amount, balanceBefore, balanceAfter, bonusType, bonusId = null) {
  return logFinancialTransaction({
    playerId,
    transactionType: 'bonus_credit',
    amount: Math.abs(amount), // Ensure positive
    balanceBefore,
    balanceAfter,
    referenceId: bonusId,
    referenceType: 'bonus',
    description: `Bonus credit: ${bonusType}`,
    metadata: { bonus_type: bonusType, bonus_id: bonusId }
  });
}

module.exports = {
  logFinancialTransaction,
  logBetDeduction,
  logWinPayout,
  logFreeSpinsPurchase,
  logPortalDeposit,
  logPortalWithdrawal,
  logAdjustment,
  logBonusCredit
};

