-- Quick cleanup script to fix the current database state
-- Run this to clean up the provisioning instances mess

-- 1. Show current state
SELECT 'Current instances table data:' as info;
SELECT user_id, instance_name, status, created_at 
FROM instances 
ORDER BY created_at DESC;

-- 2. Show users without cluster assignments
SELECT 'Users without cluster assignments:' as info;
SELECT u.id, u.email, u.created_at
FROM users u
LEFT JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
WHERE uha.user_id IS NULL
AND u.status = 'active';

-- 3. Show available clusters
SELECT 'Available clusters with capacity:' as info;
SELECT id, name, api_url, current_users, max_users, (max_users - current_users) as available_slots
FROM hopsworks_clusters
WHERE status = 'active'
AND current_users < max_users
ORDER BY current_users ASC;

-- 4. To clean up (uncomment to run):
-- DROP TABLE IF EXISTS instances CASCADE;

-- 5. To assign all unassigned users to clusters (uncomment to run):
/*
DO $$
DECLARE
    unassigned_user RECORD;
    available_cluster RECORD;
BEGIN
    FOR unassigned_user IN 
        SELECT u.id 
        FROM users u
        LEFT JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
        WHERE uha.user_id IS NULL
        AND u.status = 'active'
    LOOP
        SELECT * INTO available_cluster
        FROM hopsworks_clusters
        WHERE status = 'active'
        AND current_users < max_users
        ORDER BY current_users ASC
        LIMIT 1;
        
        IF available_cluster.id IS NOT NULL THEN
            INSERT INTO user_hopsworks_assignments (user_id, hopsworks_cluster_id)
            VALUES (unassigned_user.id, available_cluster.id);
            
            UPDATE hopsworks_clusters 
            SET current_users = current_users + 1
            WHERE id = available_cluster.id;
            
            RAISE NOTICE 'Assigned user % to cluster %', unassigned_user.id, available_cluster.name;
        ELSE
            RAISE WARNING 'No available cluster for user %', unassigned_user.id;
        END IF;
    END LOOP;
END $$;
*/