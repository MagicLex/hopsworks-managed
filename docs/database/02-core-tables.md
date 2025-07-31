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
  
  -- Features
  is_admin BOOLEAN DEFAULT false,           -- Platform admin flag
  auto_refill_enabled BOOLEAN DEFAULT false,
  auto_refill_amount DECIMAL(10,2) DEFAULT 50.00,
  auto_refill_threshold DECIMAL(10,2) DEFAULT 10.00,
  feature_flags JSONB DEFAULT '{}'::jsonb,  -- Feature toggles
  
  -- Hopsworks
  hopsworks_username TEXT,                  -- Username in Hopsworks system
  hopsworks_project_id INTEGER,             -- Assigned project (for team members)
  
  -- Metadata
  registration_source TEXT,                 -- How user found us
  registration_ip INET,                     -- IP at registration
  metadata JSONB DEFAULT '{}'::jsonb        -- Flexible metadata
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_team_invites_token` - For quick token lookups (only pending)
- `idx_team_invites_email` - For checking existing invites
- `idx_team_invites_owner` - For listing owner's invites

### Business Rules
- Invites expire after 7 days by default
- Only one pending invite per email per owner
- Token is used in invite acceptance URL
- When accepted, Auth0 webhook links new user to owner

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