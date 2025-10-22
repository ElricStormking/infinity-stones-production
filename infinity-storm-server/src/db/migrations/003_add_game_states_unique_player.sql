-- =====================================================
-- Add UNIQUE constraint to game_states.player_id
-- =====================================================
-- This allows upsert operations to work correctly
-- Each player should have exactly one game state row
-- =====================================================

-- First, remove any duplicate rows (keep the most recent)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY updated_at DESC) AS rn
  FROM game_states
)
DELETE FROM game_states
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add UNIQUE constraint
ALTER TABLE game_states
ADD CONSTRAINT game_states_player_id_unique UNIQUE (player_id);

-- Verify constraint was added
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'game_states' AND constraint_type = 'UNIQUE';

-- =====================================================
-- ✅ Migration Complete
-- =====================================================

