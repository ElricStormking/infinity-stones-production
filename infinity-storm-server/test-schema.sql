-- Simplified Casino Schema Test
-- This tests the core database schema components

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables
DROP TABLE IF EXISTS jackpot_contributions CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS rtp_metrics CASCADE;
DROP TABLE IF EXISTS jackpots CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS spin_results CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS test_players CASCADE;

-- Players table (Core user management)
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits DECIMAL(12,2) DEFAULT 1000.00,
    is_demo BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    CONSTRAINT positive_credits CHECK (credits >= 0),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'banned'))
);

-- Sessions table (Single active session enforcement)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Game states table (Preserve state across disconnects)
CREATE TABLE game_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id),
    state_data JSONB NOT NULL,
    game_mode VARCHAR(20) DEFAULT 'base',
    free_spins_remaining INT DEFAULT 0,
    accumulated_multiplier DECIMAL(6,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_game_mode CHECK (game_mode IN ('base', 'free_spins', 'bonus'))
);

-- Spin results table (Complete history with replay data)
CREATE TABLE spin_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id),
    spin_number BIGSERIAL,
    bet_amount DECIMAL(10,2) NOT NULL,
    initial_grid JSONB NOT NULL,
    cascades JSONB NOT NULL,
    total_win DECIMAL(12,2) DEFAULT 0,
    multipliers_applied JSONB,
    rng_seed VARCHAR(64) NOT NULL,
    game_mode VARCHAR(20) DEFAULT 'base',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT positive_bet CHECK (bet_amount >= 0.40 AND bet_amount <= 2000),
    CONSTRAINT valid_spin_game_mode CHECK (game_mode IN ('base', 'free_spins', 'bonus'))
);

-- Transactions table (Audit trail for all credit movements)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    description TEXT,
    created_by UUID REFERENCES players(id),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_transaction_type CHECK (type IN ('bet', 'win', 'adjustment', 'purchase', 'deposit', 'withdrawal')),
    CONSTRAINT valid_bet_transaction CHECK (
        (type = 'bet' AND amount < 0) OR 
        (type = 'win' AND amount > 0) OR 
        (type IN ('adjustment', 'purchase', 'deposit', 'withdrawal'))
    )
);

-- Jackpots table (Future progressive jackpot support)
CREATE TABLE jackpots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    current_value DECIMAL(12,2) DEFAULT 0,
    seed_value DECIMAL(10,2) NOT NULL,
    contribution_rate DECIMAL(5,4) NOT NULL,
    last_won_at TIMESTAMP,
    last_winner_id UUID REFERENCES players(id),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT positive_seed CHECK (seed_value >= 0),
    CONSTRAINT valid_contribution_rate CHECK (contribution_rate >= 0 AND contribution_rate <= 1)
);

-- Jackpot contributions (Tracks progressive growth)
CREATE TABLE jackpot_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jackpot_id UUID REFERENCES jackpots(id),
    spin_id UUID REFERENCES spin_results(id),
    contribution_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT positive_contribution CHECK (contribution_amount > 0)
);

-- Admin logs (Audit trail for admin operations)
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES players(id),
    action_type VARCHAR(50) NOT NULL,
    target_player_id UUID REFERENCES players(id),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_admin_action CHECK (action_type IN (
        'credit_adjustment', 'account_suspension', 'account_activation', 
        'password_reset', 'balance_inquiry', 'session_termination', 
        'account_deletion', 'permission_change'
    ))
);

-- RTP metrics (Monitors game fairness)
CREATE TABLE rtp_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_wins DECIMAL(15,2) DEFAULT 0,
    spin_count BIGINT DEFAULT 0,
    calculated_rtp DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_rtp_period CHECK (period_end > period_start),
    CONSTRAINT valid_rtp_value CHECK (calculated_rtp >= 0 AND calculated_rtp <= 200)
);

-- CREATE INDEXES
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_sessions_player_active ON sessions(player_id, is_active);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_spin_results_player_time ON spin_results(player_id, created_at DESC);
CREATE INDEX idx_transactions_player_time ON transactions(player_id, created_at DESC);

-- CREATE UNIQUE CONSTRAINTS
CREATE UNIQUE INDEX idx_one_active_session_per_player 
ON sessions(player_id) 
WHERE is_active = TRUE;

-- Health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_table_counts JSONB;
BEGIN
    SELECT jsonb_build_object(
        'players', (SELECT COUNT(*) FROM players),
        'sessions', (SELECT COUNT(*) FROM sessions WHERE is_active = TRUE),
        'spin_results', (SELECT COUNT(*) FROM spin_results),
        'transactions', (SELECT COUNT(*) FROM transactions),
        'jackpots', (SELECT COUNT(*) FROM jackpots),
        'admin_logs', (SELECT COUNT(*) FROM admin_logs)
    ) INTO v_table_counts;
    
    SELECT jsonb_build_object(
        'status', 'healthy',
        'timestamp', NOW(),
        'database', 'connected',
        'table_counts', v_table_counts,
        'schema_version', 'test_schema'
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Test data
INSERT INTO players (username, email, password_hash, credits, is_demo, is_admin) VALUES
('demo_player', 'demo@test.com', '$2b$10$test', 5000.00, true, false),
('admin_user', 'admin@test.com', '$2b$10$test', 10000.00, false, true);

SELECT 'Schema creation completed successfully' AS status;