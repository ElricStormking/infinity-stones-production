-- Complete Casino Schema Migration
-- This creates the full database schema for the Infinity Storm casino server
-- Based on design.md specifications for secure, scalable casino architecture

-- Create necessary extensions (uuid-ossp should be available, pgcrypto handled by migration script)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PLAYERS TABLE (Core user management)
-- Supports credits, demo mode, admin flags
-- =====================================================
DROP TABLE IF EXISTS players CASCADE;
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- SESSIONS TABLE (Single active session enforcement)
-- Enforces single active session per player
-- =====================================================
DROP TABLE IF EXISTS sessions CASCADE;
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- GAME STATES TABLE (Preserve state across disconnects)
-- Maintains player game state for reconnection
-- =====================================================
DROP TABLE IF EXISTS game_states CASCADE;
CREATE TABLE game_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- SPIN RESULTS TABLE (Complete history with replay data)
-- Stores all spin results with complete audit trail
-- =====================================================
DROP TABLE IF EXISTS spin_results CASCADE;
CREATE TABLE spin_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- TRANSACTIONS TABLE (Audit trail for all credit movements)
-- Complete audit trail for all financial operations
-- =====================================================
DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- JACKPOTS TABLE (Future progressive jackpot support)
-- Supports progressive jackpot functionality
-- =====================================================
DROP TABLE IF EXISTS jackpots CASCADE;
CREATE TABLE jackpots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- JACKPOT CONTRIBUTIONS (Tracks progressive growth)
-- Records all contributions to progressive jackpots
-- =====================================================
DROP TABLE IF EXISTS jackpot_contributions CASCADE;
CREATE TABLE jackpot_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jackpot_id UUID REFERENCES jackpots(id),
    spin_id UUID REFERENCES spin_results(id),
    contribution_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT positive_contribution CHECK (contribution_amount > 0)
);

-- =====================================================
-- ADMIN LOGS (Audit trail for admin operations)
-- Complete audit trail for all admin actions
-- =====================================================
DROP TABLE IF EXISTS admin_logs CASCADE;
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- RTP METRICS TABLE (Monitors game fairness)
-- Tracks RTP for regulatory compliance and fairness
-- =====================================================
DROP TABLE IF EXISTS rtp_metrics CASCADE;
CREATE TABLE rtp_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- =====================================================
-- DATABASE INDEXES (Performance optimization)
-- Comprehensive indexing strategy for all tables
-- =====================================================

-- Players table indexes
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_status ON players(status) WHERE status != 'active';
CREATE INDEX idx_players_is_admin ON players(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_players_created_at ON players(created_at DESC);

-- Sessions table indexes
CREATE INDEX idx_sessions_player_active ON sessions(player_id, is_active);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity DESC) WHERE is_active = TRUE;

-- Game states table indexes
CREATE INDEX idx_game_states_player ON game_states(player_id);
CREATE INDEX idx_game_states_session ON game_states(session_id);
CREATE INDEX idx_game_states_mode ON game_states(game_mode);

-- Spin results table indexes
CREATE INDEX idx_spin_results_player_time ON spin_results(player_id, created_at DESC);
CREATE INDEX idx_spin_results_session ON spin_results(session_id);
CREATE INDEX idx_spin_results_time ON spin_results(created_at DESC);
CREATE INDEX idx_spin_results_pagination ON spin_results(player_id, created_at DESC, id);
CREATE INDEX idx_spin_results_rng_seed ON spin_results(rng_seed);
CREATE INDEX idx_spin_results_bet_amount ON spin_results(bet_amount);

-- Transactions table indexes
CREATE INDEX idx_transactions_player_time ON transactions(player_id, created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_reference ON transactions(reference_id, reference_type);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);

-- Jackpots table indexes
CREATE INDEX idx_jackpots_active ON jackpots(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_jackpots_updated_at ON jackpots(updated_at DESC);

-- Jackpot contributions table indexes
CREATE INDEX idx_jackpot_contributions_jackpot ON jackpot_contributions(jackpot_id);
CREATE INDEX idx_jackpot_contributions_spin ON jackpot_contributions(spin_id);

-- Admin logs table indexes
CREATE INDEX idx_admin_logs_admin_time ON admin_logs(admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_player_id);
CREATE INDEX idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX idx_admin_logs_time ON admin_logs(created_at DESC);

-- RTP metrics table indexes
CREATE INDEX idx_rtp_metrics_period ON rtp_metrics(period_start, period_end);
CREATE INDEX idx_rtp_metrics_created_at ON rtp_metrics(created_at DESC);

-- =====================================================
-- UNIQUE CONSTRAINTS (Business logic enforcement)
-- Critical business rule constraints
-- =====================================================

-- Ensure single active session per player
CREATE UNIQUE INDEX idx_one_active_session_per_player 
ON sessions(player_id) 
WHERE is_active = TRUE;

-- Prevent duplicate spin numbers per player
CREATE UNIQUE INDEX idx_unique_spin_number_per_player
ON spin_results(player_id, spin_number);

-- Ensure unique jackpot names
CREATE UNIQUE INDEX idx_unique_jackpot_names
ON jackpots(name) 
WHERE is_active = TRUE;

-- =====================================================
-- TRIGGERS (Automated maintenance)
-- Database triggers for automated data management
-- =====================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_states_updated_at BEFORE UPDATE ON game_states 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jackpots_updated_at BEFORE UPDATE ON jackpots 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Session cleanup trigger (deactivate expired sessions)
CREATE OR REPLACE FUNCTION deactivate_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Schedule session cleanup on session table access
CREATE TRIGGER cleanup_expired_sessions 
    AFTER INSERT OR UPDATE ON sessions
    FOR EACH STATEMENT EXECUTE FUNCTION deactivate_expired_sessions();

-- =====================================================
-- VIEWS (Convenient data access)
-- Materialized and regular views for common queries
-- =====================================================

-- Active players view
CREATE VIEW active_players AS
SELECT 
    id, username, email, credits, is_demo, is_admin, 
    created_at, last_login_at
FROM players 
WHERE status = 'active';

-- Player statistics view
CREATE VIEW player_statistics AS
SELECT 
    p.id,
    p.username,
    p.credits,
    COUNT(sr.id) as total_spins,
    COALESCE(SUM(sr.bet_amount), 0) as total_bet,
    COALESCE(SUM(sr.total_win), 0) as total_win,
    COALESCE(MAX(sr.created_at), p.created_at) as last_spin
FROM players p
LEFT JOIN spin_results sr ON p.id = sr.player_id
WHERE p.status = 'active'
GROUP BY p.id, p.username, p.credits, p.created_at;

-- Recent activity view
CREATE VIEW recent_activity AS
SELECT 
    'spin' as activity_type,
    sr.player_id,
    p.username,
    sr.bet_amount as amount,
    sr.total_win as result,
    sr.created_at
FROM spin_results sr
JOIN players p ON sr.player_id = p.id
WHERE sr.created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'transaction' as activity_type,
    t.player_id,
    p.username,
    t.amount,
    t.balance_after as result,
    t.created_at
FROM transactions t
JOIN players p ON t.player_id = p.id
WHERE t.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- =====================================================
-- STORED PROCEDURES (Business logic)
-- Database procedures for common operations
-- =====================================================

-- Process bet transaction (atomic operation)
CREATE OR REPLACE FUNCTION process_bet_transaction(
    p_player_id UUID,
    p_bet_amount DECIMAL(10,2),
    p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_current_balance DECIMAL(12,2);
    v_new_balance DECIMAL(12,2);
    v_transaction_id UUID;
BEGIN
    -- Lock player row and check balance
    SELECT credits INTO v_current_balance 
    FROM players 
    WHERE id = p_player_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found: %', p_player_id;
    END IF;
    
    IF v_current_balance < p_bet_amount THEN
        RAISE EXCEPTION 'Insufficient credits. Balance: %, Required: %', 
            v_current_balance, p_bet_amount;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - p_bet_amount;
    
    -- Update player balance
    UPDATE players 
    SET credits = v_new_balance, updated_at = NOW()
    WHERE id = p_player_id;
    
    -- Record transaction
    INSERT INTO transactions (
        player_id, type, amount, balance_before, balance_after, description
    ) VALUES (
        p_player_id, 'bet', -p_bet_amount, v_current_balance, v_new_balance, 
        COALESCE(p_description, 'Spin bet')
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Process win transaction (atomic operation)
CREATE OR REPLACE FUNCTION process_win_transaction(
    p_player_id UUID,
    p_win_amount DECIMAL(12,2),
    p_spin_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_current_balance DECIMAL(12,2);
    v_new_balance DECIMAL(12,2);
    v_transaction_id UUID;
BEGIN
    -- Lock player row and get current balance
    SELECT credits INTO v_current_balance 
    FROM players 
    WHERE id = p_player_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found: %', p_player_id;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance + p_win_amount;
    
    -- Update player balance
    UPDATE players 
    SET credits = v_new_balance, updated_at = NOW()
    WHERE id = p_player_id;
    
    -- Record transaction
    INSERT INTO transactions (
        player_id, type, amount, balance_before, balance_after, 
        reference_id, reference_type, description
    ) VALUES (
        p_player_id, 'win', p_win_amount, v_current_balance, v_new_balance,
        p_spin_id, 'spin_result', COALESCE(p_description, 'Spin win')
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Get player balance safely
CREATE OR REPLACE FUNCTION get_player_balance(p_player_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_balance DECIMAL(12,2);
BEGIN
    SELECT credits INTO v_balance 
    FROM players 
    WHERE id = p_player_id AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active player not found: %', p_player_id;
    END IF;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired sessions (maintenance procedure)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER;
BEGIN
    UPDATE sessions 
    SET is_active = FALSE, updated_at = NOW()
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO admin_logs (admin_id, action_type, details)
    VALUES (
        NULL, 
        'session_cleanup',
        jsonb_build_object('sessions_deactivated', v_cleaned_count, 'timestamp', NOW())
    );
    
    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HEALTH CHECK FUNCTIONS
-- Database health monitoring functions
-- =====================================================

-- Comprehensive health check
CREATE OR REPLACE FUNCTION health_check()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_table_counts JSONB;
    v_active_sessions INTEGER;
    v_total_players INTEGER;
BEGIN
    -- Get table counts
    SELECT jsonb_build_object(
        'players', (SELECT COUNT(*) FROM players),
        'sessions', (SELECT COUNT(*) FROM sessions WHERE is_active = TRUE),
        'spin_results', (SELECT COUNT(*) FROM spin_results),
        'transactions', (SELECT COUNT(*) FROM transactions),
        'jackpots', (SELECT COUNT(*) FROM jackpots),
        'admin_logs', (SELECT COUNT(*) FROM admin_logs)
    ) INTO v_table_counts;
    
    -- Get active metrics
    SELECT COUNT(*) INTO v_active_sessions FROM sessions WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_total_players FROM players WHERE status = 'active';
    
    -- Build result
    SELECT jsonb_build_object(
        'status', 'healthy',
        'timestamp', NOW(),
        'database', 'connected',
        'table_counts', v_table_counts,
        'metrics', jsonb_build_object(
            'active_sessions', v_active_sessions,
            'total_players', v_total_players
        ),
        'schema_version', '002_complete_casino_schema'
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION COMPLETE
-- Schema version 002_complete_casino_schema installed
-- =====================================================

-- Record migration completion
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT,
    installed_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description) VALUES 
('002_complete_casino_schema', 'Complete casino database schema with all tables, indexes, constraints, and procedures')
ON CONFLICT (version) DO UPDATE SET
    description = EXCLUDED.description,
    installed_at = NOW();

-- Grant all necessary permissions (skip if role doesn't exist)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO infinity_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO infinity_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO infinity_app;