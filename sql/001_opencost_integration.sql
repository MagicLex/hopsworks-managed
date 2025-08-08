-- OpenCost Integration Migration
-- Date: 2025-01-08
-- Purpose: Add project mapping and OpenCost cost tracking

-- 1. Create user_projects mapping table
CREATE TABLE IF NOT EXISTS user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  namespace TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- 2. Add OpenCost columns to usage_daily
ALTER TABLE usage_daily 
ADD COLUMN IF NOT EXISTS opencost_cpu_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opencost_ram_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opencost_storage_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opencost_total_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opencost_cpu_hours DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opencost_ram_gb_hours DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS project_breakdown JSONB;

-- 3. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_projects_namespace ON user_projects(namespace) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_projects_last_seen ON user_projects(last_seen_at);

-- 4. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_projects_updated_at
BEFORE UPDATE ON user_projects
FOR EACH ROW EXECUTE FUNCTION update_user_projects_updated_at();

-- 5. Clean up old data (optional - comment out if you want to keep historical data)
-- UPDATE usage_daily SET total_cost = opencost_total_cost WHERE opencost_total_cost > 0;