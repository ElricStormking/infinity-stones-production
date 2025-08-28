-- Supabase seed data for Infinity Storm Casino Game
-- Simple seed data for local development

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert demo players (basic test data)
INSERT INTO players (username, email, password_hash, credits, is_demo, is_admin, status) 
VALUES 
    -- Demo player
    ('demo_player', 'demo@infinitystorm.dev', '$2b$10$8K1p/a0dUrEGO6ZG6.4H6uOwpk3JjJgOhKnA7jK4Z9S4H4H4H4H4H4', 5000.00, true, false, 'active'),
    
    -- Admin user
    ('admin', 'admin@infinitystorm.dev', '$2b$10$8K1p/a0dUrEGO6ZG6.4H6uOwpk3JjJgOhKnA7jK4Z9S4H4H4H4H4H4', 10000.00, false, true, 'active'),
    
    -- Regular test player
    ('testplayer', 'test@example.com', 'dummy_hash', 5000.00, false, false, 'active')

ON CONFLICT (email) DO UPDATE SET 
    credits = EXCLUDED.credits,
    updated_at = NOW();

-- Create health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    result := json_build_object(
        'status', 'healthy',
        'timestamp', now(),
        'database', 'connected',
        'tables', json_build_array('players', 'spins', 'sessions', 'transactions')
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;