-- Migration: Add 'free' billing mode
-- Date: 2026-01-21
-- Description: Adds 'free' as a valid billing_mode for free tier users

-- Update the CHECK constraint to include 'free'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_billing_mode_check;
ALTER TABLE users ADD CONSTRAINT users_billing_mode_check
  CHECK (billing_mode IN ('prepaid', 'postpaid', 'free'));

-- Note: Existing users remain unchanged (postpaid or prepaid)
-- New users will default to 'free' (handled in application code)
