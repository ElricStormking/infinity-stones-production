-- =====================================================
-- Fix financial_transactions.reference_id column type
-- Change from UUID to TEXT to support non-UUID spin IDs
-- =====================================================

-- Drop the index on reference_id (will recreate after column change)
DROP INDEX IF EXISTS idx_financial_transactions_reference;

-- Change reference_id column from UUID to TEXT
ALTER TABLE financial_transactions 
ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;

-- Recreate the index
CREATE INDEX idx_financial_transactions_reference ON financial_transactions(reference_id);

-- Update column comment
COMMENT ON COLUMN financial_transactions.reference_id IS 'Reference ID linking to related records (spin_results, transactions, etc.) - stored as TEXT to support various ID formats';

