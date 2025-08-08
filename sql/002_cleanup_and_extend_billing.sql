-- Migration: Cleanup legacy columns and add comprehensive billing fields
-- Date: 2025-08-08
-- Description: Remove legacy columns, add GPU/storage fields for complete billing

-- First, drop the views that depend on the legacy columns
DROP VIEW IF EXISTS account_usage CASCADE;
DROP VIEW IF EXISTS account_usage_summary CASCADE;

-- Drop legacy columns that are no longer used
ALTER TABLE usage_daily
  DROP COLUMN IF EXISTS cpu_hours,
  DROP COLUMN IF EXISTS gpu_hours,
  DROP COLUMN IF EXISTS storage_gb,
  DROP COLUMN IF EXISTS feature_store_api_calls,
  DROP COLUMN IF EXISTS model_inference_calls,
  DROP COLUMN IF EXISTS credits_deducted;

-- Add new comprehensive billing columns
ALTER TABLE usage_daily
  -- GPU tracking
  ADD COLUMN IF NOT EXISTS opencost_gpu_cost DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opencost_gpu_hours DECIMAL(10,4) DEFAULT 0,
  
  -- Storage breakdown
  ADD COLUMN IF NOT EXISTS online_storage_gb DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offline_storage_gb DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_storage_cost DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offline_storage_cost DECIMAL(10,4) DEFAULT 0,
  
  -- Network and other costs
  ADD COLUMN IF NOT EXISTS network_egress_gb DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_egress_cost DECIMAL(10,4) DEFAULT 0,
  
  -- Instance types for tracking
  ADD COLUMN IF NOT EXISTS instance_types JSONB DEFAULT '{}',
  
  -- Better efficiency metrics
  ADD COLUMN IF NOT EXISTS resource_efficiency JSONB DEFAULT '{}';

-- Update user_credits table to track GPU usage
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS gpu_hours_purchased DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_storage_gb_months DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offline_storage_gb_months DECIMAL(10,2) DEFAULT 0;

-- Recreate the views using OpenCost fields
CREATE VIEW account_usage AS
SELECT 
    COALESCE(u.account_owner_id, u.id) AS account_owner_id,
    ud.date,
    SUM(ud.opencost_cpu_hours) AS total_cpu_hours,
    SUM(ud.opencost_gpu_hours) AS total_gpu_hours,
    SUM(ud.opencost_ram_gb_hours) AS total_ram_gb_hours,
    SUM(ud.online_storage_gb) AS total_online_storage_gb,
    SUM(ud.offline_storage_gb) AS total_offline_storage_gb,
    SUM(ud.opencost_total_cost) AS total_cost,
    SUM(ud.opencost_cpu_cost) AS cpu_cost,
    SUM(ud.opencost_gpu_cost) AS gpu_cost,
    SUM(ud.opencost_ram_cost) AS ram_cost,
    SUM(ud.online_storage_cost + ud.offline_storage_cost) AS storage_cost
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), ud.date;

-- Recreate account_usage_summary with more details
CREATE VIEW account_usage_summary AS
SELECT 
    COALESCE(u.account_owner_id, u.id) AS account_owner_id,
    u.email AS owner_email,
    COUNT(DISTINCT CASE WHEN u.account_owner_id IS NOT NULL THEN u.id END) AS team_member_count,
    SUM(ud.opencost_cpu_hours) AS total_cpu_hours,
    SUM(ud.opencost_gpu_hours) AS total_gpu_hours,
    SUM(ud.opencost_ram_gb_hours) AS total_ram_gb_hours,
    SUM(ud.online_storage_gb) AS total_online_storage_gb,
    SUM(ud.offline_storage_gb) AS total_offline_storage_gb,
    SUM(ud.opencost_total_cost) AS total_cost,
    MAX(ud.date) AS last_usage_date
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), u.email;

-- Add comments for documentation
COMMENT ON COLUMN usage_daily.opencost_cpu_cost IS 'CPU cost from OpenCost (USD)';
COMMENT ON COLUMN usage_daily.opencost_gpu_cost IS 'GPU cost from OpenCost (USD)';
COMMENT ON COLUMN usage_daily.opencost_ram_cost IS 'RAM cost from OpenCost (USD)';
COMMENT ON COLUMN usage_daily.opencost_storage_cost IS 'PV storage cost from OpenCost (USD)';
COMMENT ON COLUMN usage_daily.opencost_total_cost IS 'Total cost from OpenCost (USD) - source of truth';

COMMENT ON COLUMN usage_daily.opencost_cpu_hours IS 'CPU core-hours consumed';
COMMENT ON COLUMN usage_daily.opencost_gpu_hours IS 'GPU hours consumed';
COMMENT ON COLUMN usage_daily.opencost_ram_gb_hours IS 'RAM GB-hours consumed';

COMMENT ON COLUMN usage_daily.online_storage_gb IS 'Online DB storage in GB (MySQL, etc)';
COMMENT ON COLUMN usage_daily.offline_storage_gb IS 'Offline storage in GB (HDFS, object storage)';
COMMENT ON COLUMN usage_daily.online_storage_cost IS 'Cost for online storage';
COMMENT ON COLUMN usage_daily.offline_storage_cost IS 'Cost for offline storage';

COMMENT ON COLUMN usage_daily.network_egress_gb IS 'Network egress in GB';
COMMENT ON COLUMN usage_daily.network_egress_cost IS 'Network egress cost';

COMMENT ON COLUMN usage_daily.instance_types IS 'JSON breakdown of instance types used';
COMMENT ON COLUMN usage_daily.resource_efficiency IS 'JSON metrics for CPU/RAM/GPU efficiency';
COMMENT ON COLUMN usage_daily.project_breakdown IS 'Per-project cost breakdown from OpenCost (JSONB)';

-- Create index for new columns if needed
CREATE INDEX IF NOT EXISTS idx_usage_daily_gpu ON usage_daily(opencost_gpu_hours) WHERE opencost_gpu_hours > 0;
CREATE INDEX IF NOT EXISTS idx_usage_daily_storage ON usage_daily(online_storage_gb, offline_storage_gb);

-- Grant appropriate permissions
GRANT SELECT ON account_usage TO authenticated;
GRANT SELECT ON account_usage_summary TO authenticated;