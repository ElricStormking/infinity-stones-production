-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PLAYERS TABLE (Core user management)
-- Supports credits, demo mode, admin flags
-- =====================================================
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
-- SPINS TABLE (Legacy compatibility)
-- =====================================================
CREATE TABLE spins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spin_id TEXT NOT NULL,
    player_id TEXT,
    bet_amount NUMERIC(12,2) NOT NULL,
    total_win NUMERIC(12,2) NOT NULL,
    rng_seed TEXT,
    initial_grid JSONB NOT NULL,
    cascades JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SPIN RESULTS TABLE (Complete history with replay data)
-- Stores all spin results with complete audit trail
-- =====================================================
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
-- ADMIN LOGS (Audit trail for admin operations)
-- Complete audit trail for all admin actions
-- =====================================================
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
-- =====================================================

-- Players table indexes
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_username ON players(username);

-- Sessions table indexes
CREATE INDEX idx_sessions_player_active ON sessions(player_id, is_active);
CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- Spins table indexes (legacy)
CREATE INDEX idx_spins_created_at ON spins(created_at DESC);
CREATE INDEX idx_spins_player ON spins(player_id, created_at DESC);

-- Spin results table indexes
CREATE INDEX idx_spin_results_player_time ON spin_results(player_id, created_at DESC);
CREATE INDEX idx_spin_results_session ON spin_results(session_id);

-- Transactions table indexes
CREATE INDEX idx_transactions_player_time ON transactions(player_id, created_at DESC);

-- =====================================================
-- TRIGGERS (Automated maintenance)
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