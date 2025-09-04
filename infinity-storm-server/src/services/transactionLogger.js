/**
 * Transaction Logger Service
 *
 * Provides regulatory-compliant transaction logging for all financial operations
 * Ensures complete audit trail for casino operations
 */

const { Pool } = require('pg');
const { logger } = require('../utils/logger');

class TransactionLogger {
  constructor() {
    // Create dedicated connection pool for transaction logging
    this.pool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 54322,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: false,
      // Dedicated pool for transaction logging
      min: 1,
      max: 5
    });
  }

  /**
     * Log a financial transaction with full audit trail
     * @param {Object} transaction - Transaction details
     * @returns {Promise<string>} Transaction ID
     */
  async logTransaction(transaction) {
    const client = await this.pool.connect();

    try {
      // Generate unique transaction ID
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Ensure transactions table exists
      await this.ensureTransactionsTable(client);

      // Insert transaction record
      const query = `
                INSERT INTO financial_transactions (
                    transaction_id,
                    player_id,
                    session_id,
                    transaction_type,
                    amount,
                    balance_before,
                    balance_after,
                    reference_id,
                    description,
                    metadata,
                    ip_address,
                    user_agent,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                RETURNING transaction_id, created_at
            `;

      const values = [
        transactionId,
        transaction.player_id,
        transaction.session_id || null,
        transaction.type,
        transaction.amount,
        transaction.balance_before,
        transaction.balance_after,
        transaction.reference_id || null,
        transaction.description,
        JSON.stringify(transaction.metadata || {}),
        transaction.ip_address || null,
        transaction.user_agent || null
      ];

      const result = await client.query(query, values);

      // Log the transaction creation
      logger.info('Transaction logged', {
        transaction_id: transactionId,
        player_id: transaction.player_id,
        type: transaction.type,
        amount: transaction.amount,
        balance_after: transaction.balance_after
      });

      return result.rows[0];

    } catch (error) {
      logger.error('Transaction logging failed', {
        error: error.message,
        player_id: transaction.player_id,
        type: transaction.type,
        amount: transaction.amount
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
     * Log a spin bet transaction
     */
  async logSpinBet(playerId, sessionId, amount, balanceBefore, balanceAfter, spinId, metadata = {}) {
    return await this.logTransaction({
      player_id: playerId,
      session_id: sessionId,
      type: 'SPIN_BET',
      amount: -Math.abs(amount), // Always negative for bets
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: spinId,
      description: `Slot spin bet: $${amount}`,
      metadata: {
        spin_id: spinId,
        bet_amount: amount,
        ...metadata
      }
    });
  }

  /**
     * Log a spin win transaction
     */
  async logSpinWin(playerId, sessionId, amount, balanceBefore, balanceAfter, spinId, metadata = {}) {
    if (amount <= 0) {return null;} // No transaction for zero wins

    return await this.logTransaction({
      player_id: playerId,
      session_id: sessionId,
      type: 'SPIN_WIN',
      amount: Math.abs(amount), // Always positive for wins
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: spinId,
      description: `Slot spin win: $${amount}`,
      metadata: {
        spin_id: spinId,
        win_amount: amount,
        ...metadata
      }
    });
  }

  /**
     * Log account registration transaction (initial credits)
     */
  async logRegistrationBonus(playerId, amount, metadata = {}) {
    return await this.logTransaction({
      player_id: playerId,
      session_id: null,
      type: 'REGISTRATION_BONUS',
      amount: Math.abs(amount),
      balance_before: 0,
      balance_after: amount,
      reference_id: playerId,
      description: `Registration bonus: $${amount}`,
      metadata: {
        bonus_type: 'registration',
        ...metadata
      }
    });
  }

  /**
     * Get transaction history for a player
     */
  async getPlayerTransactions(playerId, options = {}) {
    const client = await this.pool.connect();

    try {
      const limit = Math.min(options.limit || 50, 1000); // Max 1000 transactions
      const offset = options.offset || 0;
      const fromDate = options.from_date ? new Date(options.from_date) : null;
      const toDate = options.to_date ? new Date(options.to_date) : null;

      let query = `
                SELECT 
                    transaction_id,
                    transaction_type,
                    amount,
                    balance_before,
                    balance_after,
                    reference_id,
                    description,
                    metadata,
                    created_at
                FROM financial_transactions 
                WHERE player_id = $1
            `;

      const params = [playerId];
      let paramCount = 1;

      if (fromDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        params.push(fromDate);
      }

      if (toDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        params.push(toDate);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await client.query(query, params);

      return {
        transactions: result.rows,
        total_count: result.rowCount,
        limit,
        offset
      };

    } catch (error) {
      logger.error('Failed to fetch player transactions', {
        error: error.message,
        player_id: playerId
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
     * Get transaction summary for a player
     */
  async getPlayerTransactionSummary(playerId, options = {}) {
    const client = await this.pool.connect();

    try {
      const fromDate = options.from_date ? new Date(options.from_date) : null;
      const toDate = options.to_date ? new Date(options.to_date) : null;

      let query = `
                SELECT 
                    transaction_type,
                    COUNT(*) as transaction_count,
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
                    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits,
                    SUM(amount) as net_amount
                FROM financial_transactions 
                WHERE player_id = $1
            `;

      const params = [playerId];
      let paramCount = 1;

      if (fromDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        params.push(fromDate);
      }

      if (toDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        params.push(toDate);
      }

      query += ' GROUP BY transaction_type ORDER BY transaction_type';

      const result = await client.query(query, params);

      // Calculate overall summary
      let totalCredits = 0;
      let totalDebits = 0;
      let totalTransactions = 0;

      result.rows.forEach(row => {
        totalCredits += parseFloat(row.total_credits || 0);
        totalDebits += parseFloat(row.total_debits || 0);
        totalTransactions += parseInt(row.transaction_count || 0);
      });

      return {
        by_type: result.rows,
        summary: {
          total_transactions: totalTransactions,
          total_credits: totalCredits.toFixed(2),
          total_debits: totalDebits.toFixed(2),
          net_amount: (totalCredits - totalDebits).toFixed(2)
        }
      };

    } catch (error) {
      logger.error('Failed to fetch player transaction summary', {
        error: error.message,
        player_id: playerId
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
     * Ensure the financial_transactions table exists
     */
  async ensureTransactionsTable(client) {
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS financial_transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(255) UNIQUE NOT NULL,
                player_id UUID NOT NULL,
                session_id UUID,
                transaction_type VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                balance_before DECIMAL(10,2) NOT NULL,
                balance_after DECIMAL(10,2) NOT NULL,
                reference_id VARCHAR(255),
                description TEXT,
                metadata JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                
                -- Indexes for performance
                CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT
            );
            
            -- Create indexes if they don't exist
            CREATE INDEX IF NOT EXISTS idx_financial_transactions_player_id ON financial_transactions(player_id);
            CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(transaction_type);
            CREATE INDEX IF NOT EXISTS idx_financial_transactions_reference ON financial_transactions(reference_id);
            CREATE INDEX IF NOT EXISTS idx_financial_transactions_transaction_id ON financial_transactions(transaction_id);
        `;

    await client.query(createTableQuery);
  }

  /**
     * Close the connection pool
     */
  async close() {
    await this.pool.end();
  }
}

// Export singleton instance
module.exports = new TransactionLogger();