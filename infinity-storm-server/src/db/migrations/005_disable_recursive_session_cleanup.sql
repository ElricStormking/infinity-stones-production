-- Disable recursive session cleanup trigger that caused stack depth exceeded
-- Safe to run multiple times

DROP TRIGGER IF EXISTS cleanup_expired_sessions ON sessions;

-- Keep function around for manual/cron use, but avoid automatic recursion
-- You can perform periodic cleanup with:
--   UPDATE sessions SET is_active = FALSE WHERE expires_at < NOW() AND is_active = TRUE;


