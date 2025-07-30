-- Migration to copy usernames from hopsworks_project_id to hopsworks_username
-- This is needed because we were incorrectly storing usernames in the project_id field

-- First, update users table where username is stored in hopsworks_project_id
UPDATE users 
SET hopsworks_username = hopsworks_project_id
WHERE hopsworks_project_id IS NOT NULL 
  AND hopsworks_project_id NOT LIKE '%-%-%-%-%' -- Not a UUID
  AND hopsworks_username IS NULL;

-- Also update the user_hopsworks_assignments table with usernames
UPDATE user_hopsworks_assignments uha
SET hopsworks_username = u.hopsworks_username
FROM users u
WHERE uha.user_id = u.id
  AND u.hopsworks_username IS NOT NULL
  AND uha.hopsworks_username IS NULL;

-- Log the migration results
SELECT 
  COUNT(*) FILTER (WHERE hopsworks_username IS NOT NULL) as users_with_username,
  COUNT(*) FILTER (WHERE hopsworks_username IS NULL) as users_without_username,
  COUNT(*) FILTER (WHERE hopsworks_project_id IS NOT NULL AND hopsworks_project_id NOT LIKE '%-%-%-%-%') as potential_usernames_in_project_id
FROM users;