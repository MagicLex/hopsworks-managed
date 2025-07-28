-- Debug script to check user cluster assignments

-- 1. Show all users
SELECT 'All users:' as info;
SELECT id, email, name, status, is_admin, created_at
FROM users
ORDER BY created_at;

-- 2. Show user cluster assignments
SELECT 'User cluster assignments:' as info;
SELECT 
    u.email,
    uha.user_id,
    uha.hopsworks_cluster_id,
    uha.assigned_at,
    hc.name as cluster_name,
    hc.api_url,
    hc.status as cluster_status
FROM users u
LEFT JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
LEFT JOIN hopsworks_clusters hc ON uha.hopsworks_cluster_id = hc.id
ORDER BY u.email;

-- 3. Check for missing assignments
SELECT 'Users without cluster assignments:' as info;
SELECT u.id, u.email
FROM users u
LEFT JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
WHERE uha.user_id IS NULL;

-- 4. Show clusters status
SELECT 'Hopsworks clusters:' as info;
SELECT id, name, api_url, max_users, current_users, status, 
       CASE WHEN api_key IS NULL THEN 'NOT SET' ELSE 'SET' END as api_key_status
FROM hopsworks_clusters;

-- 5. Check if api_url has proper protocol
SELECT 'Check API URLs:' as info;
SELECT name, api_url,
       CASE 
         WHEN api_url LIKE 'http://%' THEN 'HTTP (should be HTTPS)'
         WHEN api_url LIKE 'https://%' THEN 'HTTPS (correct)'
         WHEN api_url NOT LIKE 'http%' THEN 'MISSING PROTOCOL'
         ELSE 'UNKNOWN'
       END as url_check
FROM hopsworks_clusters;