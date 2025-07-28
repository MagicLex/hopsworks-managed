-- Run this in Supabase SQL editor

-- First, check if tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- If users table doesn't exist, run the initial schema
-- Copy from supabase/migrations/001_initial_schema.sql

-- Then run the admin/clusters migration
-- Copy from supabase/migrations/003_admin_and_clusters.sql

-- Finally, make yourself admin:
-- UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';