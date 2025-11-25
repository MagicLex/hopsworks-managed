-- Migration: Add legal consent tracking
-- Date: 2025-11-25
-- Description: Add columns to track terms acceptance and marketing consent

-- Add terms acceptance timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- Add marketing consent flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;

-- Add index for users without terms accepted (useful for enforcement queries)
CREATE INDEX IF NOT EXISTS idx_users_terms_not_accepted
  ON users(id)
  WHERE terms_accepted_at IS NULL AND deleted_at IS NULL;
