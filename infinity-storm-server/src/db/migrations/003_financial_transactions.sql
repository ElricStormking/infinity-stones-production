-- =====================================================
-- FINANCIAL TRANSACTIONS TABLE
-- Records ALL player balance changes for complete audit trail
-- Separate from the transactions table for detailed accounting
-- =====================================================
DROP TABLE IF EXISTS financial_transactions CASCADE;

CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_financial_transaction_type CHECK (
        transaction_type IN (
            'bet_deduction',
            'win_payout', 
            'free_spins_purchase',
            'portal_deposit',
            'portal_withdrawal',
            'adjustment',
            'bonus_credit'
        )
    ),
    CONSTRAINT valid_balance_calculation CHECK (
        balance_after = balance_before + amount
    )
);

-- Indexes for performance
CREATE INDEX idx_financial_transactions_player ON financial_transactions(player_id);
CREATE INDEX idx_financial_transactions_created ON financial_transactions(created_at DESC);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(transaction_type);
CREATE INDEX idx_financial_transactions_reference ON financial_transactions(reference_id);

-- Comment for documentation
COMMENT ON TABLE financial_transactions IS 'Complete audit trail of all player balance changes including bets, wins, purchases, and portal transfers';
COMMENT ON COLUMN financial_transactions.transaction_type IS 'Type of balance change: bet_deduction, win_payout, free_spins_purchase, portal_deposit, portal_withdrawal, adjustment, bonus_credit';
COMMENT ON COLUMN financial_transactions.amount IS 'Amount of change (negative for deductions, positive for credits)';
COMMENT ON COLUMN financial_transactions.metadata IS 'Additional transaction details stored as JSON';

