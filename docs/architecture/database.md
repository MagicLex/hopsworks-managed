# Database CLI Access

## Quick Connect

```bash
# From .env.local
source .env.local && PGPASSWORD="$POSTGRES_PASSWORD" psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.pahfsiosiuxdkiebepav

# Direct (with password from env)
PGPASSWORD="$POSTGRES_PASSWORD" psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.pahfsiosiuxdkiebepav
```

## Common Commands

```bash
# List tables
\dt

# Show table structure  
\d usage_daily

# Quick query
-c "SELECT COUNT(*) FROM users;"
```

## Tables
- `users` - User accounts
- `usage_daily` - Daily costs (has `created_at` NOT `updated_at`)
- `user_projects` - Namespace mappings
- `user_hopsworks_assignments` - Cluster assignments
- `hopsworks_clusters` - Cluster configs
- `team_invites` - Pending invites
- `project_member_roles` - Team member project access (tracks sync status to Hopsworks)
- `user_credits` - Prepaid credits
- `stripe_products` - Stripe mappings

## Useful Queries

### User Hopsworks Assignment Status

```sql
-- Check if user has valid Hopsworks assignment
SELECT
  u.email,
  u.hopsworks_user_id,
  u.hopsworks_username,
  uha.hopsworks_cluster_id,
  hc.name as cluster_name,
  uha.assigned_at
FROM users u
LEFT JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
LEFT JOIN hopsworks_clusters hc ON uha.hopsworks_cluster_id = hc.id
WHERE u.email = 'user@example.com';

-- Find users with invalid hopsworks_user_id (0 or NULL)
SELECT
  u.email,
  u.hopsworks_user_id,
  u.hopsworks_username,
  uha.hopsworks_user_id as assignment_id
FROM users u
JOIN user_hopsworks_assignments uha ON u.id = uha.user_id
WHERE u.hopsworks_user_id IS NULL
   OR u.hopsworks_user_id = 0
   OR uha.hopsworks_user_id IS NULL
   OR uha.hopsworks_user_id = 0;

-- Fix user with incorrect hopsworks_user_id
-- (First verify the correct ID in Hopsworks, then update)
UPDATE users
SET hopsworks_user_id = 11209, hopsworks_username = 'correctusername'
WHERE id = 'auth0|userid';

UPDATE user_hopsworks_assignments
SET hopsworks_user_id = 11209
WHERE user_id = 'auth0|userid';
```

### Team Member Project Access

```sql
-- View all project assignments for a team member
SELECT
  pmr.project_name,
  pmr.role,
  pmr.synced_to_hopsworks,
  pmr.sync_error,
  u.email as member_email,
  o.email as owner_email
FROM project_member_roles pmr
JOIN users u ON pmr.member_id = u.id
JOIN users o ON pmr.account_owner_id = o.id
WHERE u.email = 'member@example.com';

-- Purge failed sync attempts for a member (clean slate for retry)
DELETE FROM project_member_roles
WHERE member_id IN (
  SELECT id FROM users WHERE email = 'member@example.com'
);

-- View all pending syncs across all members
SELECT
  pmr.project_name,
  u.email as member_email,
  o.email as owner_email,
  pmr.sync_error
FROM project_member_roles pmr
JOIN users u ON pmr.member_id = u.id
JOIN users o ON pmr.account_owner_id = o.id
WHERE pmr.synced_to_hopsworks = false
ORDER BY pmr.created_at DESC;
```