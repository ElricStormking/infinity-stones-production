-- Drop legacy spins table
-- This table was replaced by spin_results table
-- Migration created: 2025-10-24

-- Drop the table (this will cascade and remove permissions)
DROP TABLE IF EXISTS public.spins CASCADE;

-- Note: All spin data should be stored in public.spin_results table instead

