-- Extend allowed admin_logs action types to match application usage
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS valid_admin_action;
ALTER TABLE admin_logs
  ADD CONSTRAINT valid_admin_action CHECK (action_type IN (
    'credit_adjustment', 'account_suspension', 'account_activation',
    'password_reset', 'balance_inquiry', 'session_termination',
    'account_deletion', 'permission_change', 'jackpot_reset',
    'jackpot_award', 'system_maintenance', 'database_backup',
    'security_event', 'login_attempt', 'data_export',
    'configuration_change', 'spin_replay', 'transaction_review',
    'player_verification',
    -- Newly added types used by controllers
    'metrics_access', 'realtime_metrics_access', 'rtp_metrics_access',
    'compliance_report_generation', 'session_cleanup'
  ));

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('003_admin_logs_actions_extend', 'Extend admin_logs valid action types to include login_attempt, metrics and maintenance actions')
ON CONFLICT (version) DO UPDATE SET description = EXCLUDED.description, installed_at = NOW();
