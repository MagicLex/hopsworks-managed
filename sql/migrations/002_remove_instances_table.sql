-- Migration: Remove instances table and clean up shared cluster model
-- Date: 2025-07-28
-- Purpose: Remove the confusing instances table since we use shared clusters

-- 1. First, backup any important data from instances table (if needed)
-- This creates a backup table with the old data just in case
CREATE TABLE IF NOT EXISTS instances_backup AS 
SELECT * FROM instances;

-- 2. Drop the instances table
DROP TABLE IF EXISTS instances CASCADE;

-- 3. Ensure all users have cluster assignments
-- Find users without cluster assignments and assign them to available clusters
DO $$
DECLARE
    unassigned_user RECORD;
    available_cluster RECORD;
BEGIN
    -- Loop through users without cluster assignments
    FOR unassigned_user IN 
        SELECT u.id 
        FROM users u
        LEFT JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
        WHERE uha.user_id IS NULL
        AND u.status = 'active'
    LOOP
        -- Find available cluster with capacity
        SELECT * INTO available_cluster
        FROM hopsworks_clusters
        WHERE status = 'active'
        AND current_users < max_users
        ORDER BY current_users ASC
        LIMIT 1;
        
        -- If found, assign user
        IF available_cluster.id IS NOT NULL THEN
            INSERT INTO user_hopsworks_assignments (user_id, hopsworks_cluster_id)
            VALUES (unassigned_user.id, available_cluster.id)
            ON CONFLICT DO NOTHING;
            
            -- Increment cluster user count
            UPDATE hopsworks_clusters 
            SET current_users = current_users + 1
            WHERE id = available_cluster.id;
        END IF;
    END LOOP;
END $$;

-- 4. Add comment to document the change
COMMENT ON TABLE user_hopsworks_assignments IS 'Maps users to shared Hopsworks cluster endpoints. Users share clusters, not individual instances.';

-- 5. Verify the migration
SELECT 
    'Total users' as metric,
    COUNT(*) as count
FROM users
WHERE status = 'active'
UNION ALL
SELECT 
    'Users with cluster assignments' as metric,
    COUNT(DISTINCT user_id) as count
FROM user_hopsworks_assignments
UNION ALL
SELECT 
    'Total clusters' as metric,
    COUNT(*) as count
FROM hopsworks_clusters
WHERE status = 'active';