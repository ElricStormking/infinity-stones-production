/**
 * walletLedger.js - Supabase-backed wallet operations
 *
 * Provides low-level wallet operations that execute against Supabase/Postgres
 * functions so we can share the same database transaction the game controller
 * uses for spin processing.
 */

const { supabaseAdmin } = require('../db/supabaseClient');

const SPIN_REFERENCE_TYPE = 'spin_result';

const toNumber = (value, fallback = 0) => {
  if (value == null) {
    return fallback;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const assertDbClient = (client) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('A pg client instance is required for atomic wallet operations');
  }
};

const setTransactionReference = async (client, transactionId, referenceId, referenceType = SPIN_REFERENCE_TYPE) => {
  if (!transactionId || !referenceId) {
    return;
  }
  await client.query(
    'UPDATE transactions SET reference_id = $1, reference_type = $2 WHERE id = $3',
    [referenceId, referenceType, transactionId]
  );
};

const buildTransactionResponse = (transactionId, playerId, type, amount, previousBalance, currentBalance, referenceId = null) => ({
  success: true,
  transaction: {
    id: transactionId,
    player_id: playerId,
    type,
    amount,
    reference_id: referenceId,
    reference_type: referenceId ? SPIN_REFERENCE_TYPE : null
  },
  balance: {
    previous: Number(previousBalance.toFixed(2)),
    current: Number(currentBalance.toFixed(2))
  }
});

async function processBet({
  client,
  playerId,
  amount,
  referenceId = null,
  description = null
}) {
  assertDbClient(client);

  const normalizedAmount = toNumber(amount);
  if (normalizedAmount <= 0) {
    throw new Error('Bet amount must be positive');
  }

  const betDescription = description || `Spin bet of ${normalizedAmount} credits`;

  const { rows } = await client.query(
    'SELECT process_bet_transaction($1, $2, $3) AS transaction_id',
    [playerId, normalizedAmount, betDescription]
  );

  const transactionId = rows?.[0]?.transaction_id;
  if (!transactionId) {
    throw new Error('Failed to record bet transaction');
  }

  if (referenceId) {
    await setTransactionReference(client, transactionId, referenceId);
  }

  const balanceRes = await client.query(
    'SELECT credits::numeric AS credits FROM players WHERE id = $1',
    [playerId]
  );
  const currentBalance = toNumber(balanceRes.rows?.[0]?.credits);
  const previousBalance = currentBalance + normalizedAmount;

  return buildTransactionResponse(
    transactionId,
    playerId,
    'bet',
    -normalizedAmount,
    previousBalance,
    currentBalance,
    referenceId
  );
}

async function processWin({
  client,
  playerId,
  amount,
  referenceId = null,
  description = null
}) {
  assertDbClient(client);

  const normalizedAmount = toNumber(amount);
  if (normalizedAmount <= 0) {
    throw new Error('Win amount must be positive');
  }

  const winDescription = description || `Spin win of ${normalizedAmount} credits`;

  const { rows } = await client.query(
    'SELECT process_win_transaction($1, $2, $3, $4) AS transaction_id',
    [playerId, normalizedAmount, referenceId, winDescription]
  );

  const transactionId = rows?.[0]?.transaction_id;
  if (!transactionId) {
    throw new Error('Failed to record win transaction');
  }

  if (referenceId) {
    await setTransactionReference(client, transactionId, referenceId);
  }

  const balanceRes = await client.query(
    'SELECT credits::numeric AS credits FROM players WHERE id = $1',
    [playerId]
  );
  const currentBalance = toNumber(balanceRes.rows?.[0]?.credits);
  const previousBalance = currentBalance - normalizedAmount;

  return buildTransactionResponse(
    transactionId,
    playerId,
    'win',
    normalizedAmount,
    previousBalance,
    currentBalance,
    referenceId
  );
}

async function getBalance(playerId, { client = null } = {}) {
  if (!playerId) {
    throw new Error('playerId is required');
  }

  let playerRow;

  if (client) {
    const { rows } = await client.query(
      'SELECT id, username, credits::numeric AS credits, is_demo, status, updated_at FROM players WHERE id = $1',
      [playerId]
    );
    playerRow = rows?.[0] || null;
  } else {
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('id, username, credits, is_demo, status, updated_at')
      .eq('id', playerId)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }
    playerRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  if (!playerRow) {
    throw new Error('Player not found');
  }

  let lastTransaction = null;
  if (client) {
    const { rows } = await client.query(
      'SELECT balance_after::numeric AS balance_after, created_at FROM transactions WHERE player_id = $1 ORDER BY created_at DESC LIMIT 1',
      [playerId]
    );
    lastTransaction = rows?.[0] || null;
  } else {
    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('balance_after, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!txError && Array.isArray(txData) && txData.length > 0) {
      lastTransaction = txData[0];
    }
  }

  const balance = toNumber(playerRow.credits);
  const lastBalance = lastTransaction ? toNumber(lastTransaction.balance_after) : balance;
  const isConsistent = !lastTransaction || Math.abs(balance - lastBalance) < 0.01;

  return {
    player_id: playerRow.id,
    username: playerRow.username || 'Unknown',
    balance,
    is_demo: Boolean(playerRow.is_demo),
    status: playerRow.status || 'active',
    balance_consistent: isConsistent,
    last_updated: lastTransaction?.created_at || playerRow.updated_at || null
  };
}

module.exports = {
  processBet,
  processWin,
  getBalance
};
