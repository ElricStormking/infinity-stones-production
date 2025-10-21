-- ================================================
-- Drop Legacy 'spins' Table from Supabase
-- ================================================
-- This table is deprecated in favor of 'spin_results'
-- All code references have been removed
-- Safe to execute after commit 174d262
-- ================================================

-- Step 1: Optional backup (uncomment if you want to keep historical data)
-- CREATE TABLE IF NOT EXISTS spins_backup AS TABLE public.spins WITH DATA;

-- Step 2: Revoke any permissions (safe no-op if none exist)
REVOKE ALL ON TABLE public.spins FROM PUBLIC CASCADE;
REVOKE ALL ON TABLE public.spins FROM anon CASCADE;
REVOKE ALL ON TABLE public.spins FROM authenticated CASCADE;

-- Step 3: Drop the legacy spins table
DROP TABLE IF EXISTS public.spins CASCADE;

-- Verification: List remaining tables (optional)
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- ================================================
-- ✅ Cleanup Complete
-- ================================================

