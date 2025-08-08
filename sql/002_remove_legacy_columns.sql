-- Migration: Remove legacy columns from usage_daily
-- Date: 2025-08-08
-- Description: Remove legacy billing columns that have been replaced by OpenCost fields

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

-- Recreate the views using OpenCost fields
CREATE VIEW account_usage AS
SELECT 
    COALESCE(u.account_owner_id, u.id) AS account_owner_id,
    ud.date,
    SUM(ud.opencost_cpu_hours) AS total_cpu_hours,
    SUM(ud.opencost_ram_gb_hours) AS total_ram_gb_hours,
    SUM(ud.opencost_storage_cost) AS total_storage_cost,
    SUM(ud.opencost_total_cost) AS total_cost
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), ud.date;

-- Recreate account_usage_summary if it exists
CREATE VIEW account_usage_summary AS
SELECT 
    COALESCE(u.account_owner_id, u.id) AS account_owner_id,
    u.email AS owner_email,
    COUNT(DISTINCT CASE WHEN u.account_owner_id IS NOT NULL THEN u.id END) AS team_member_count,
    SUM(ud.opencost_cpu_hours) AS total_cpu_hours,
    SUM(ud.opencost_ram_gb_hours) AS total_ram_gb_hours,
    SUM(ud.opencost_total_cost) AS total_cost,
    MAX(ud.date) AS last_usage_date
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), u.email;

-- Update comments on remaining columns
COMMENT ON COLUMN usage_daily.opencost_cpu_cost IS 'CPU cost from OpenCost (USD) - source of truth';
COMMENT ON COLUMN usage_daily.opencost_ram_cost IS 'RAM cost from OpenCost (USD) - source of truth';
COMMENT ON COLUMN usage_daily.opencost_storage_cost IS 'Storage cost from OpenCost (USD) - source of truth';
COMMENT ON COLUMN usage_daily.opencost_total_cost IS 'Total cost from OpenCost (USD) - source of truth';
COMMENT ON COLUMN usage_daily.opencost_cpu_hours IS 'CPU hours consumed from OpenCost';
COMMENT ON COLUMN usage_daily.opencost_ram_gb_hours IS 'RAM GB-hours consumed from OpenCost';
COMMENT ON COLUMN usage_daily.project_breakdown IS 'Per-project cost breakdown from OpenCost (JSONB)';
COMMENT ON COLUMN usage_daily.total_cost IS 'Aggregated total cost for the day (backward compatibility)';

-- Grant appropriate permissions
GRANT SELECT ON account_usage TO authenticated;
GRANT SELECT ON account_usage_summary TO authenticated;