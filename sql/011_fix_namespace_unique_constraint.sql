-- Fix namespace unique constraint
-- Date: 2026-01-26
-- Purpose: Change namespace unique constraint to only apply to active projects
--
-- Problem: When a project becomes inactive and another user gets a project with
-- the same namespace, the sync fails because namespace is globally unique.
--
-- Solution: Make namespace unique only among active projects via partial unique index.

-- Step 1: Drop the global unique constraint
ALTER TABLE user_projects DROP CONSTRAINT IF EXISTS user_projects_namespace_key;

-- Step 2: Drop old regular index (replaced by unique partial index below)
DROP INDEX IF EXISTS idx_user_projects_namespace;

-- Step 3: Create partial unique index (namespace unique only for active projects)
-- This allows inactive projects to have "orphaned" namespaces that can be reassigned
CREATE UNIQUE INDEX IF NOT EXISTS user_projects_namespace_active_unique
ON user_projects(namespace) WHERE status = 'active';

-- Step 4: Clean up any duplicate inactive entries that might exist
-- Keep only the most recent inactive entry per namespace
DELETE FROM user_projects a
USING user_projects b
WHERE a.namespace = b.namespace
  AND a.status = 'inactive'
  AND b.status = 'inactive'
  AND a.updated_at < b.updated_at;
