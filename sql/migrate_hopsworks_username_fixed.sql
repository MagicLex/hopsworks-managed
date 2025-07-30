-- Migration to add hopsworks_username column and migrate data
-- This handles the case where we might have multiple users tables in different schemas

-- First, let's check which schema has our custom users table with hopsworks data
DO $$
BEGIN
    -- Check if we have the custom users table (not auth.users)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
    ) THEN
        -- Add hopsworks_username column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND table_schema = 'public'
            AND column_name = 'hopsworks_username'
        ) THEN
            ALTER TABLE public.users 
            ADD COLUMN hopsworks_username TEXT;
            RAISE NOTICE 'Added hopsworks_username column to public.users';
        END IF;

        -- Check if hopsworks_project_id column exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND table_schema = 'public'
            AND column_name = 'hopsworks_project_id'
        ) THEN
            -- Migrate data from hopsworks_project_id to hopsworks_username
            UPDATE public.users 
            SET hopsworks_username = hopsworks_project_id
            WHERE hopsworks_project_id IS NOT NULL 
              AND hopsworks_project_id NOT LIKE '%-%-%-%-%' -- Not a UUID
              AND hopsworks_username IS NULL;
              
            RAISE NOTICE 'Migrated usernames from hopsworks_project_id to hopsworks_username';
        ELSE
            RAISE NOTICE 'No hopsworks_project_id column found - nothing to migrate';
        END IF;
    END IF;
END $$;

-- Also update the user_hopsworks_assignments table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'user_hopsworks_assignments'
    ) THEN
        -- Add column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'user_hopsworks_assignments' 
            AND column_name = 'hopsworks_username'
        ) THEN
            ALTER TABLE user_hopsworks_assignments 
            ADD COLUMN hopsworks_username TEXT;
            RAISE NOTICE 'Added hopsworks_username column to user_hopsworks_assignments';
        END IF;

        -- Update assignments with usernames from users table
        UPDATE user_hopsworks_assignments uha
        SET hopsworks_username = u.hopsworks_username
        FROM public.users u
        WHERE uha.user_id = u.id
          AND u.hopsworks_username IS NOT NULL
          AND uha.hopsworks_username IS NULL;
          
        RAISE NOTICE 'Updated user_hopsworks_assignments with usernames';
    END IF;
END $$;

-- Show results
SELECT 
  'Users with hopsworks_username' as metric,
  COUNT(*) FILTER (WHERE hopsworks_username IS NOT NULL) as count
FROM public.users
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND table_schema = 'public' 
    AND column_name = 'hopsworks_username'
)
UNION ALL
SELECT 
  'Users without hopsworks_username' as metric,
  COUNT(*) FILTER (WHERE hopsworks_username IS NULL) as count
FROM public.users
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND table_schema = 'public' 
    AND column_name = 'hopsworks_username'
);