-- Create hourly usage table for more granular tracking
CREATE TABLE IF NOT EXISTS usage_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  hour TIMESTAMP WITH TIME ZONE NOT NULL, -- Hour timestamp (e.g., 2025-07-29T14:00:00Z)
  date DATE NOT NULL, -- For easier daily aggregation
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  
  -- Resource metrics
  cpu_hours DECIMAL(10,4) DEFAULT 0, -- CPU cores used this hour
  gpu_hours DECIMAL(10,4) DEFAULT 0,
  memory_gb_hours DECIMAL(10,4) DEFAULT 0, -- Memory GB used this hour
  storage_gb DECIMAL(10,4) DEFAULT 0, -- Current storage usage
  
  -- Instance info
  instance_type TEXT,
  instance_count INTEGER DEFAULT 0,
  
  -- Cost tracking
  total_cost DECIMAL(10,4) DEFAULT 0,
  
  -- Metadata
  projects JSONB DEFAULT '[]', -- Array of project info
  pods JSONB DEFAULT '[]', -- Pod details if needed
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, hour)
);

-- Indexes for performance
CREATE INDEX idx_usage_hourly_user_date ON usage_hourly(user_id, date);
CREATE INDEX idx_usage_hourly_date ON usage_hourly(date);
CREATE INDEX idx_usage_hourly_hour ON usage_hourly(hour);

-- Add new columns to usage_daily for K8s metrics
ALTER TABLE usage_daily 
ADD COLUMN IF NOT EXISTS memory_gb_hours DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS project_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_deducted DECIMAL(10,4) DEFAULT 0;

-- Add username column to users table for K8s mapping
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS hopsworks_username TEXT;

-- Update user_hopsworks_assignments to include username
ALTER TABLE user_hopsworks_assignments
ADD COLUMN IF NOT EXISTS hopsworks_username TEXT;