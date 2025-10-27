-- Simple Admins Table Migration
-- Standalone admin authentication separate from players table
-- No roles, no status, no email - just account_id and password

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast account_id lookup during login
CREATE INDEX IF NOT EXISTS idx_admins_account_id ON admins(account_id);

-- Add comment for clarity
COMMENT ON TABLE admins IS 'Simplified admin authentication table';
COMMENT ON COLUMN admins.account_id IS 'Admin login identifier (no email required)';
COMMENT ON COLUMN admins.password_hash IS 'Bcrypt hashed password';

