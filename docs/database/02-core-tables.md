# Core Tables

## users

The central table for all user accounts, including both account owners and team members.

### Schema
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                      -- Auth0 user ID (e.g., 'auth0|123', 'google-oauth2|456')
  email TEXT UNIQUE NOT NULL,               -- User's email address
  name TEXT,                                -- Display name
  created_at TIMESTAMPTZ DEFAULT NOW(),     -- Account creation time
  updated_at TIMESTAMPTZ DEFAULT NOW(),     -- Last update time
  last_login_at TIMESTAMPTZ,                -- Last login timestamp
  login_count INTEGER DEFAULT 0,            -- Number of logins
  status TEXT DEFAULT 'active',             -- Account status
  
  -- Account ownership
  account_owner_id TEXT REFERENCES users(id), -- NULL = account owner, otherwise ID of owner
  
  -- Billing
  billing_mode TEXT DEFAULT 'postpaid',     -- 'prepaid' or 'postpaid'
  stripe_customer_id TEXT,                  -- Stripe customer ID (production)
  stripe_test_customer_id TEXT,             -- Stripe customer ID (test mode)
  stripe_subscription_id TEXT,              -- Active subscription (postpaid SaaS)
  stripe_subscription_status TEXT,          -- Cached Stripe status
 
  -- Features
  is_admin BOOLEAN DEFAULT false,           -- Platform admin flag
  feature_flags JSONB DEFAULT '{}'::jsonb,  -- Feature toggles
  
  -- Hopsworks
  hopsworks_username TEXT,                  -- Username in Hopsworks system
  
  -- Metadata
  registration_source TEXT,                 -- How user found us
  registration_ip INET,                     -- IP at registration
  metadata JSONB DEFAULT '{}'::jsonb        -- Flexible metadata (corporate_ref, etc.)
);
```

### Indexes
- `users_pkey` - Primary key on `id`
- `users_email_key` - Unique constraint on `email`
- `idx_users_created_at` - For sorting by creation date
- `idx_users_account_owner` - For finding team members
- `idx_users_stripe_customer_id` - For Stripe lookups

### Constraints
- `users_status_check` - Status must be one of: 'active', 'suspended', 'deleted'
- `users_billing_mode_check` - Billing mode must be: 'prepaid' or 'postpaid'

### Key Relationships
- Self-referential `account_owner_id` creates team hierarchy
- Team members have `account_owner_id` set
- Account owners have `account_owner_id = NULL`

### Usage Examples
```sql
-- Find all account owners
SELECT * FROM users WHERE account_owner_id IS NULL;

-- Find team members for an owner
SELECT * FROM users WHERE account_owner_id = 'auth0|123';

-- Find user with Stripe customer
SELECT * FROM users WHERE stripe_customer_id = 'cus_ABC123';
```

## team_invites

Tracks pending invitations for team members.

### Schema
```sql
CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_owner_id TEXT REFERENCES users(id) NOT NULL,  -- Who sent the invite
  email TEXT NOT NULL,                                  -- Invited email
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,                              -- When accepted
  accepted_by_user_id TEXT REFERENCES users(id),       -- Who accepted
  project_role TEXT DEFAULT 'Data scientist',           -- Desired project role
  auto_assign_projects BOOLEAN DEFAULT true,            -- Auto-sync into owner's projects
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_team_invites_token` - For quick token lookups (only pending)
- `idx_team_invites_email` - For checking existing invites
- `idx_team_invites_owner` - For listing owner's invites

### Business Rules
- Invites expire after 7 days by default.
- Only one pending invite per email per owner.
- Token is used in invite acceptance URL.
- When accepted, Auth0 webhook links new user to owner.
- `project_role` controls the initial Hopsworks role (`Data owner`, `Data scientist`, `Observer`).
- `auto_assign_projects` triggers automatic project membership syncing during join.

### Usage Examples
```sql
-- Find pending invites for an owner
SELECT * FROM team_invites 
WHERE account_owner_id = 'auth0|123' 
AND accepted_at IS NULL
AND expires_at > NOW();

-- Check if invite is valid
SELECT * FROM team_invites 
WHERE token = 'abc-123-def'
AND accepted_at IS NULL 
AND expires_at > NOW();

-- Mark invite as accepted
UPDATE team_invites 
SET accepted_at = NOW(), 
    accepted_by_user_id = 'google-oauth2|789'
WHERE token = 'abc-123-def';
```

## project_member_roles

Caches team member access to Hopsworks projects and the sync state.

### Schema
```sql
CREATE TABLE project_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  project_namespace TEXT,
  role TEXT NOT NULL CHECK (role IN ('Data owner', 'Data scientist', 'Observer')),
  synced_to_hopsworks BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  added_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, project_id)
);
```

### Indexes
- `idx_project_member_roles_member` – Look up all projects for a member.
- `idx_project_member_roles_owner` – Show all members per owner.
- `idx_project_member_roles_sync_status` – Identify pending syncs.

### Business Rules
- Each member can appear once per project (`UNIQUE(member_id, project_id)`).
- `synced_to_hopsworks` flips to `true` after successful API sync.
- Records are inserted/updated via `upsert_project_member_role()` when:
  - Team members auto-join projects.
  - Admins bulk-sync roles from the dashboard.

### Usage Examples
```sql
-- Pending sync jobs for automation
SELECT * FROM project_member_roles 
WHERE synced_to_hopsworks = false 
  AND sync_error IS NULL;

-- List a member's project roster
SELECT project_name, role FROM project_member_roles
WHERE member_id = 'auth0|member';

-- Clear a sync error after rerunning a job
UPDATE project_member_roles
SET sync_error = NULL,
    synced_to_hopsworks = false
WHERE id = 'uuid';
```

## Key Design Decisions

### 1. Auth0 ID as Primary Key
- Uses Auth0's `sub` claim directly
- No separate internal user ID
- Format: `provider|unique_id`

### 2. Simple Team Model
- No complex roles/permissions
- Just owners and members
- Members have no billing access

### 3. Flexible Metadata
- JSONB columns for extensibility
- `metadata` for general purpose
- `feature_flags` for feature toggles

### 4. Billing Mode Flexibility
- Supports both prepaid and postpaid
- Controlled at user level
- Only account owners have billing
