-- Migration: Add spending cap tracking
-- Date: 2026-01-16
-- Description: Add columns for spending cap and alert tracking

-- Add spending cap column (NULL means no cap set)
ALTER TABLE users ADD COLUMN IF NOT EXISTS spending_cap DECIMAL(10,2) DEFAULT NULL;

-- Add spending alerts tracking (stores which thresholds have been alerted this month)
-- Format: {"month": "2026-01", "alerts_sent": ["80", "90", "100"]}
ALTER TABLE users ADD COLUMN IF NOT EXISTS spending_alerts_sent JSONB DEFAULT NULL;

-- Add index for users with spending cap set (useful for cron batch processing)
CREATE INDEX IF NOT EXISTS idx_users_with_spending_cap
  ON users(id)
  WHERE spending_cap IS NOT NULL AND deleted_at IS NULL;
