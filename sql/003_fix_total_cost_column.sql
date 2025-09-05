-- Migration: Fix total_cost column usage
-- Date: 2025-09-04
-- Purpose: Remove unused opencost_total_cost column and fix views to use total_cost

-- First, drop the views that depend on the column
DROP VIEW IF EXISTS account_usage CASCADE;
DROP VIEW IF EXISTS account_usage_summary CASCADE;

-- Recreate the views using total_cost instead of opencost_total_cost
CREATE VIEW account_usage AS
SELECT 
    COALESCE(u.account_owner_id, u.id) AS account_owner_id,
    ud.date,
    SUM(ud.opencost_cpu_hours) AS total_cpu_hours,
    SUM(ud.opencost_gpu_hours) AS total_gpu_hours,
    SUM(ud.opencost_ram_gb_hours) AS total_ram_gb_hours,
    SUM(ud.online_storage_gb) AS total_online_storage_gb,
    SUM(ud.offline_storage_gb) AS total_offline_storage_gb,
    SUM(ud.total_cost) AS total_cost,  -- Changed from opencost_total_cost
    SUM(ud.opencost_cpu_cost) AS cpu_cost,
    SUM(ud.opencost_gpu_cost) AS gpu_cost,
    SUM(ud.opencost_ram_cost) AS ram_cost,
    SUM(ud.online_storage_cost + ud.offline_storage_cost) AS storage_cost
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), ud.date;

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
    SUM(ud.total_cost) AS total_cost,  -- Changed from opencost_total_cost
    MAX(ud.date) AS last_usage_date
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), u.email;

-- Grant permissions on the views
GRANT SELECT ON account_usage TO authenticated;
GRANT SELECT ON account_usage_summary TO authenticated;

-- Now we can safely drop the unused column
ALTER TABLE usage_daily 
DROP COLUMN IF EXISTS opencost_total_cost;

-- Update comment on total_cost to clarify it's the source of truth
COMMENT ON COLUMN usage_daily.total_cost IS 'Total cost calculated from usage (USD) - source of truth for billing';