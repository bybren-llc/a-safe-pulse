-- Migration 008: Add columns for OAuth token migration tracking
-- Supports the transition from long-lived to short-lived + refresh token rotation (ASP-87)

-- Track migration status per organization
ALTER TABLE linear_tokens ADD COLUMN IF NOT EXISTS migration_status TEXT NOT NULL DEFAULT 'pending';
-- Values: 'pending' (not migrated), 'migrated' (successfully migrated), 'failed' (migration attempted but failed)

-- Preserve old access token for safe rollback
ALTER TABLE linear_tokens ADD COLUMN IF NOT EXISTS old_access_token TEXT;

-- Track when migration occurred
ALTER TABLE linear_tokens ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP;

-- Index for querying by migration status
CREATE INDEX IF NOT EXISTS idx_linear_tokens_migration_status ON linear_tokens(migration_status);
