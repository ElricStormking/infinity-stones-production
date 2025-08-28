-- PostgreSQL initialization script for Infinity Storm
-- This script runs when the PostgreSQL container starts for the first time

-- Create the main database if it doesn't exist
-- Note: The database is already created by POSTGRES_DB env var, so we just ensure proper setup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC for consistency
SET timezone = 'UTC';

-- Create user for application if not exists (backup, since Docker should handle this)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'infinity_app') THEN
        CREATE USER infinity_app WITH PASSWORD 'infinity_app_password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE infinity_storm TO infinity_app;
GRANT ALL ON SCHEMA public TO infinity_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO infinity_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO infinity_app;

-- Create basic health check table for monitoring
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'healthy',
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial health check record
INSERT INTO health_check (status, last_check) VALUES ('healthy', NOW()) ON CONFLICT DO NOTHING;

-- Create function to update health check
CREATE OR REPLACE FUNCTION update_health_check()
RETURNS VOID AS $$
BEGIN
    UPDATE health_check SET last_check = NOW() WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Log successful initialization
INSERT INTO health_check (status, last_check) VALUES ('initialized', NOW());