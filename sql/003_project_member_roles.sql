-- Migration: Add project member roles tracking
-- Date: 2025-02-02
-- Purpose: Track team member roles in Hopsworks projects locally for state management

-- =====================================================
-- PROJECT MEMBER ROLES TABLE
-- =====================================================

-- This table tracks the roles of team members in Hopsworks projects
-- It serves as a local cache/source of truth for project access
CREATE TABLE IF NOT EXISTS project_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User relationships
  member_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Project info (from Hopsworks)
  project_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  project_namespace TEXT,
  
  -- Role management
  role TEXT NOT NULL CHECK (role IN ('Data owner', 'Data scientist', 'Observer')),
  
  -- Sync status with Hopsworks
  synced_to_hopsworks BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  
  -- Metadata
  added_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique member per project
  UNIQUE(member_id, project_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_project_member_roles_member 
  ON project_member_roles(member_id);

CREATE INDEX IF NOT EXISTS idx_project_member_roles_owner 
  ON project_member_roles(account_owner_id);

CREATE INDEX IF NOT EXISTS idx_project_member_roles_project 
  ON project_member_roles(project_id, project_name);

CREATE INDEX IF NOT EXISTS idx_project_member_roles_sync_status 
  ON project_member_roles(synced_to_hopsworks, last_sync_at) 
  WHERE synced_to_hopsworks = false;

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_project_member_roles_updated_at 
BEFORE UPDATE ON project_member_roles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS
-- =====================================================

-- View to see all project members with their details
CREATE OR REPLACE VIEW project_members_detail AS
SELECT 
  pmr.id,
  pmr.project_id,
  pmr.project_name,
  pmr.project_namespace,
  pmr.role,
  pmr.synced_to_hopsworks,
  pmr.last_sync_at,
  pmr.created_at,
  pmr.updated_at,
  
  -- Member details
  m.id as member_id,
  m.email as member_email,
  m.name as member_name,
  m.hopsworks_username as member_hopsworks_username,
  
  -- Owner details
  o.id as owner_id,
  o.email as owner_email,
  o.name as owner_name,
  o.hopsworks_username as owner_hopsworks_username,
  
  -- Added by details
  ab.email as added_by_email,
  ab.name as added_by_name
FROM project_member_roles pmr
JOIN users m ON pmr.member_id = m.id
JOIN users o ON pmr.account_owner_id = o.id
LEFT JOIN users ab ON pmr.added_by = ab.id;

-- View to see pending syncs
CREATE OR REPLACE VIEW pending_role_syncs AS
SELECT 
  pmr.*,
  m.email as member_email,
  m.hopsworks_username,
  o.email as owner_email
FROM project_member_roles pmr
JOIN users m ON pmr.member_id = m.id
JOIN users o ON pmr.account_owner_id = o.id
WHERE pmr.synced_to_hopsworks = false
  AND pmr.sync_error IS NULL
  AND m.hopsworks_username IS NOT NULL
ORDER BY pmr.created_at ASC;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get all projects for a member
CREATE OR REPLACE FUNCTION get_member_projects(p_member_id TEXT)
RETURNS TABLE (
  project_id INTEGER,
  project_name TEXT,
  role TEXT,
  synced BOOLEAN,
  owner_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pmr.project_id,
    pmr.project_name,
    pmr.role,
    pmr.synced_to_hopsworks,
    o.email
  FROM project_member_roles pmr
  JOIN users o ON pmr.account_owner_id = o.id
  WHERE pmr.member_id = p_member_id
  ORDER BY pmr.project_name;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert a project member role
CREATE OR REPLACE FUNCTION upsert_project_member_role(
  p_member_id TEXT,
  p_owner_id TEXT,
  p_project_id INTEGER,
  p_project_name TEXT,
  p_role TEXT,
  p_added_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_role_id UUID;
BEGIN
  INSERT INTO project_member_roles (
    member_id, 
    account_owner_id, 
    project_id, 
    project_name, 
    role,
    added_by,
    synced_to_hopsworks
  ) VALUES (
    p_member_id,
    p_owner_id,
    p_project_id,
    p_project_name,
    p_role,
    p_added_by,
    false
  )
  ON CONFLICT (member_id, project_id) 
  DO UPDATE SET
    role = EXCLUDED.role,
    synced_to_hopsworks = false,
    sync_error = NULL,
    updated_at = NOW()
  RETURNING id INTO v_role_id;
  
  RETURN v_role_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL DATA MIGRATION
-- =====================================================

-- Migrate existing project assignments if any exist
-- This assumes team members might already have projects assigned
INSERT INTO project_member_roles (
  member_id,
  account_owner_id,
  project_id,
  project_name,
  role,
  synced_to_hopsworks,
  created_at
)
SELECT DISTINCT
  u.id as member_id,
  u.account_owner_id,
  up.project_id,
  up.project_name,
  'Data scientist' as role,  -- Default role for existing assignments
  true as synced_to_hopsworks,  -- Assume existing are already synced
  up.created_at
FROM users u
JOIN user_projects up ON up.user_id = u.account_owner_id
WHERE u.account_owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_member_roles pmr 
    WHERE pmr.member_id = u.id 
    AND pmr.project_id = up.project_id
  )
ON CONFLICT (member_id, project_id) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE project_member_roles IS 'Tracks team member roles in Hopsworks projects, serving as local state management';
COMMENT ON COLUMN project_member_roles.synced_to_hopsworks IS 'Whether this role assignment has been successfully synced to Hopsworks';
COMMENT ON COLUMN project_member_roles.sync_error IS 'Error message if sync to Hopsworks failed';
COMMENT ON COLUMN project_member_roles.role IS 'Project role: Data owner, Data scientist, or Observer';