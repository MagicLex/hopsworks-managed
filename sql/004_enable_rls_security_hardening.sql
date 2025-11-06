-- Migration: Enable RLS and security hardening
-- Date: 2025-11-06
-- Purpose: Defense in depth - protect all tables and views with proper RLS policies
-- Applied: Yes (manually executed 2025-11-06)

-- =====================================================
-- SECURITY AUDIT FINDINGS (2025-11-06)
-- =====================================================
-- Before this migration:
-- - user_projects: RLS disabled, no policies
-- - project_member_roles: RLS disabled, no policies
-- - 6 tables had "qual = true" policies (OPEN TO ALL)
-- - stripe_products: RLS enabled but 0 policies (inaccessible)
-- - 5 views had GRANT SELECT TO authenticated (potential leak)
--
-- After this migration:
-- - ALL tables have RLS enabled with proper policies
-- - ALL views revoked from public/authenticated/anon
-- - Service role access preserved (bypasses RLS)
-- =====================================================

-- =====================================================
-- DROP INSECURE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Service role full access users" ON users;
DROP POLICY IF EXISTS "Service role full access usage" ON usage_daily;
DROP POLICY IF EXISTS "Service role full access credits" ON user_credits;
DROP POLICY IF EXISTS "Service role full access hopsworks_assignments" ON user_hopsworks_assignments;
DROP POLICY IF EXISTS "Service role full access team_invites" ON team_invites;
DROP POLICY IF EXISTS "Service role full access hopsworks_clusters" ON hopsworks_clusters;

-- =====================================================
-- ENABLE RLS ON MISSING TABLES
-- =====================================================

ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_member_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.jwt()::json->>'sub');

CREATE POLICY "Users can view team members"
  ON users FOR SELECT
  USING (
    account_owner_id IS NOT NULL
    AND account_owner_id = auth.jwt()::json->>'sub'
  );

CREATE POLICY "Users can view their account owner"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT account_owner_id FROM users WHERE id = auth.jwt()::json->>'sub'
    )
  );

-- =====================================================
-- USAGE_DAILY TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own usage"
  ON usage_daily FOR SELECT
  USING (user_id = auth.jwt()::json->>'sub');

-- =====================================================
-- USER_CREDITS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (user_id = auth.jwt()::json->>'sub');

-- =====================================================
-- USER_HOPSWORKS_ASSIGNMENTS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own assignment"
  ON user_hopsworks_assignments FOR SELECT
  USING (user_id = auth.jwt()::json->>'sub');

-- =====================================================
-- TEAM_INVITES TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view invites they sent"
  ON team_invites FOR SELECT
  USING (account_owner_id = auth.jwt()::json->>'sub');

CREATE POLICY "Users can view invites sent to them"
  ON team_invites FOR SELECT
  USING (email = auth.jwt()::json->>'email');

-- =====================================================
-- HOPSWORKS_CLUSTERS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view their assigned cluster"
  ON hopsworks_clusters FOR SELECT
  USING (
    id IN (
      SELECT hopsworks_cluster_id
      FROM user_hopsworks_assignments
      WHERE user_id = auth.jwt()::json->>'sub'
    )
  );

-- =====================================================
-- STRIPE_PRODUCTS TABLE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view stripe products"
  ON stripe_products FOR SELECT
  USING (true);

-- =====================================================
-- USER_PROJECTS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own projects"
  ON user_projects FOR SELECT
  USING (user_id = auth.jwt()::json->>'sub');

-- =====================================================
-- PROJECT_MEMBER_ROLES TABLE POLICIES
-- =====================================================

CREATE POLICY "Members can view own roles"
  ON project_member_roles FOR SELECT
  USING (member_id = auth.jwt()::json->>'sub');

CREATE POLICY "Owners can view team member roles"
  ON project_member_roles FOR SELECT
  USING (account_owner_id = auth.jwt()::json->>'sub');

-- =====================================================
-- SECURE VIEWS (REVOKE PUBLIC ACCESS)
-- =====================================================

-- Enable security barrier on views
ALTER VIEW account_usage SET (security_barrier = true);
ALTER VIEW account_usage_summary SET (security_barrier = true);
ALTER VIEW team_members SET (security_barrier = true);
ALTER VIEW pending_role_syncs SET (security_barrier = true);
ALTER VIEW project_members_detail SET (security_barrier = true);

-- Revoke all public/authenticated/anon access
REVOKE ALL ON account_usage FROM authenticated, anon, public;
REVOKE ALL ON account_usage_summary FROM authenticated, anon, public;
REVOKE ALL ON team_members FROM authenticated, anon, public;
REVOKE ALL ON pending_role_syncs FROM authenticated, anon, public;
REVOKE ALL ON project_members_detail FROM authenticated, anon, public;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Check all policies exist:
-- SELECT tablename, COUNT(policyname) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;

-- Check views have no public access:
-- SELECT schemaname, viewname,
--        COALESCE(string_agg(privilege_type, ', '), 'No privileges') as granted_privileges
-- FROM pg_views v
-- LEFT JOIN information_schema.table_privileges tp
--   ON v.viewname = tp.table_name
--   AND v.schemaname = tp.table_schema
--   AND tp.grantee IN ('authenticated', 'anon', 'public')
-- WHERE v.schemaname = 'public'
-- GROUP BY schemaname, viewname
-- ORDER BY viewname;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Users can view own profile" ON users IS 'Users can query their own user record';
COMMENT ON POLICY "Users can view team members" ON users IS 'Account owners can view their team members';
COMMENT ON POLICY "Users can view their account owner" ON users IS 'Team members can view their account owner profile';

COMMENT ON POLICY "Users can view own usage" ON usage_daily IS 'Users can only see their own usage records';
COMMENT ON POLICY "Users can view own credits" ON user_credits IS 'Users can only see their own credit balance';
COMMENT ON POLICY "Users can view own assignment" ON user_hopsworks_assignments IS 'Users can only see their own cluster assignment';

COMMENT ON POLICY "Users can view invites they sent" ON team_invites IS 'Account owners can view invites they created';
COMMENT ON POLICY "Users can view invites sent to them" ON team_invites IS 'Users can view invites sent to their email';

COMMENT ON POLICY "Users can view their assigned cluster" ON hopsworks_clusters IS 'Users can only view the cluster they are assigned to';
COMMENT ON POLICY "Anyone can view stripe products" ON stripe_products IS 'Public read access for pricing information';

COMMENT ON POLICY "Users can view own projects" ON user_projects IS 'Users can only query their own project mappings';
COMMENT ON POLICY "Members can view own roles" ON project_member_roles IS 'Team members can view their own project role assignments';
COMMENT ON POLICY "Owners can view team member roles" ON project_member_roles IS 'Account owners can view project roles for their team members';
