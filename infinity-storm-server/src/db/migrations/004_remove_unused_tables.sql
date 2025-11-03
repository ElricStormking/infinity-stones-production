-- Migration: Remove unused tables
-- Version: 004
-- Date: 2025-11-02
-- Purpose: Clean up unused jackpot and RTP metrics tables that are not used in production
-- 
-- Tables being removed:
-- 1. jackpot_contributions (0 records, feature not implemented)
-- 2. jackpots (0 records, feature not implemented)
-- 3. rtp_metrics (0 records, redundant data - can calculate from spin_results)
--
-- This migration is safe to run as these tables have:
-- - No data (0 records in all tables)
-- - No active dependencies in game logic
-- - No API endpoints using them

BEGIN;

-- Drop jackpot_contributions first (has foreign key to jackpots)
DROP TABLE IF EXISTS jackpot_contributions CASCADE;
COMMENT ON SCHEMA public IS 'Dropped jackpot_contributions table - feature not implemented';

-- Drop jackpots table
DROP TABLE IF EXISTS jackpots CASCADE;
COMMENT ON SCHEMA public IS 'Dropped jackpots table - feature not implemented';

-- Drop rtp_metrics table
DROP TABLE IF EXISTS rtp_metrics CASCADE;
COMMENT ON SCHEMA public IS 'Dropped rtp_metrics table - redundant with spin_results data';

-- Record this migration in schema_migrations table
-- Actual columns: version (varchar 50), description (text), installed_at (timestamp)
INSERT INTO schema_migrations (version, description) 
VALUES ('004', 'Remove unused tables: jackpots, jackpot_contributions, rtp_metrics')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Verification queries (run these after migration to confirm)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
-- Expected result: jackpots, jackpot_contributions, and rtp_metrics should NOT appear in the list
