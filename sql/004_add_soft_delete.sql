-- Migration: Add soft delete support for user accounts
-- Date: 2025-11-05
-- Purpose: Implement soft delete for self-deletion to preserve audit trail and allow rollback

-- Add deleted_at timestamp to track when account was soft deleted
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deletion_reason for audit purposes
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Index for performance when filtering out deleted users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Index for active users (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user self-deleted their account (soft delete)';
COMMENT ON COLUMN users.deletion_reason IS 'Reason for account deletion (user_requested, team_member_removed, admin_action)';
