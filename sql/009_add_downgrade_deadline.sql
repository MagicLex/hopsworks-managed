-- Add downgrade_deadline field for tracking free tier compliance
-- When a user downgrades from postpaid to free with >1 project,
-- they have until this deadline to delete projects or get suspended

ALTER TABLE users ADD COLUMN IF NOT EXISTS downgrade_deadline TIMESTAMPTZ;

-- Index for efficient querying of users past their deadline
CREATE INDEX IF NOT EXISTS idx_users_downgrade_deadline
ON users (downgrade_deadline)
WHERE downgrade_deadline IS NOT NULL;
