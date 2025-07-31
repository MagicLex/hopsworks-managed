-- Add metadata columns to track how and when cluster assignments are made
ALTER TABLE user_hopsworks_assignments 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS assigned_by TEXT DEFAULT 'system';

-- Add comment explaining the assigned_by values
COMMENT ON COLUMN user_hopsworks_assignments.assigned_by IS 'How the assignment was made: system (automatic after payment), admin (manual override), migration (data migration)';

-- Update existing assignments to have metadata
UPDATE user_hopsworks_assignments 
SET assigned_at = COALESCE(assigned_at, NOW()),
    assigned_by = COALESCE(assigned_by, 'migration')
WHERE assigned_at IS NULL;