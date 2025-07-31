# Database Cleanup Plan

## Current State Analysis

### Tables in Use (Keep)
- `users` - 2 rows
- `hopsworks_clusters` - 1 row  
- `user_hopsworks_assignments` - 2 rows
- `user_credits` - 2 rows
- `usage_daily` - 3 rows

### Tables to Drop (Unused/Legacy)
- `billing_history` - 0 rows
- `credit_transactions` - 0 rows
- `clusters` - legacy, replaced by hopsworks_clusters
- `feature_groups` - not implemented
- `model_deployments` - not implemented
- `instances_backup` - legacy backup
- `invoices` - not used
- `stripe_products` - hardcoded in app
- `subscriptions` - references old clusters table
- `usage_metrics` - replaced by usage_daily
- `user_pricing_overrides` - not implemented
- `user_profiles` - redundant with users

## New Clean Schema

### Core Tables

#### 1. users (SIMPLIFIED)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,  -- Auth0 ID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  -- Account ownership
  account_owner_id TEXT REFERENCES users(id),  -- NULL = is account owner
  
  -- Billing (only for account owners)
  stripe_customer_id TEXT,
  stripe_test_customer_id TEXT,  -- Keep test separate
  
  -- Hopsworks
  hopsworks_username TEXT,
  hopsworks_project_id INTEGER,  -- Assigned project (for team members)
  
  -- System
  is_platform_admin BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 2. hopsworks_clusters (KEEP AS IS)
```sql
CREATE TABLE hopsworks_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  max_users INTEGER DEFAULT 100,
  current_users INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  kubeconfig TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 3. account_clusters (SIMPLIFIED - replaces user_hopsworks_assignments)
```sql
CREATE TABLE account_clusters (
  account_owner_id TEXT REFERENCES users(id),
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  PRIMARY KEY (account_owner_id, hopsworks_cluster_id)
);
```

#### 4. usage_tracking (SIMPLIFIED from usage_daily)
```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_owner_id TEXT REFERENCES users(id),
  date DATE NOT NULL,
  
  -- Single metric for now
  compute_units DECIMAL(10,4) DEFAULT 0,
  unit_price DECIMAL(10,4) DEFAULT 0.0001,  -- $0.0001 per unit
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (compute_units * unit_price) STORED,
  
  -- Metadata for breakdown by user
  user_breakdown JSONB DEFAULT '{}'::jsonb,  -- {"user_id": units, ...}
  raw_metrics JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(account_owner_id, date)
);
```

#### 5. credits_ledger (NEW - replaces user_credits + credit_transactions)
```sql
CREATE TABLE credits_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_owner_id TEXT REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,  -- positive = credit, negative = debit
  balance DECIMAL(10,2) NOT NULL,  -- running balance
  type TEXT CHECK (type IN ('purchase', 'usage', 'refund', 'grant')),
  description TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. team_invites (NEW - for team member invitations)
```sql
CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_owner_id TEXT REFERENCES users(id),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Migration Process

### 1. Backup Current Data
```sql
-- Export essential data
COPY (SELECT * FROM users) TO '/tmp/users_backup.csv' CSV HEADER;
COPY (SELECT * FROM hopsworks_clusters) TO '/tmp/clusters_backup.csv' CSV HEADER;
```

### 2. Create New Schema
```sql
-- Run the new schema creation scripts
```

### 3. Migrate Data
```sql
-- Since we only have 2 users, this is simple
-- Both are account owners for now (no team members yet)
UPDATE users SET account_owner_id = NULL;

-- Migrate cluster assignments to account level
INSERT INTO account_clusters (account_owner_id, hopsworks_cluster_id, assigned_at)
SELECT 
  user_id,
  hopsworks_cluster_id,
  COALESCE(assigned_at, NOW())
FROM user_hopsworks_assignments;

-- Migrate credits to ledger with running balance
INSERT INTO credits_ledger (account_owner_id, amount, balance, type, description, created_at)
SELECT 
  user_id,
  total_purchased,
  total_purchased,
  'purchase',
  'Initial balance migration',
  NOW()
FROM user_credits
WHERE total_purchased > 0;

-- Migrate usage to new tracking
INSERT INTO usage_tracking (account_owner_id, date, compute_units)
SELECT 
  user_id,
  date,
  cpu_hours * 10000  -- Convert hours to units (1 hour = 10000 units)
FROM usage_daily;
```

### 4. Drop Old Tables
```sql
DROP TABLE IF EXISTS billing_history CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
-- ... etc
```

## Benefits of New Structure

1. **Account-owner billing** - Simple: who pays owns everything
2. **Simplified usage tracking** - One metric, easy to extend
3. **Clean credits ledger** - Proper double-entry bookkeeping
4. **Only 6 core tables** - Down from 17
5. **Ready for teams** - Invite system + project assignment
6. **Future-proof** - Can add optional organizations table later

## Team Member Flow
1. Owner sends invite → Creates record in `team_invites`
2. User signs up with Auth0 → Links to owner via invite token
3. Owner assigns Hopsworks project → Updates `hopsworks_project_id`
4. Usage tracked under owner's account → In `user_breakdown` JSON

## Future: Organizations (Optional)
If users want formal organizations later:
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id),
  user_id TEXT REFERENCES users(id),
  role TEXT,
  PRIMARY KEY (organization_id, user_id)
);
```
But billing stays with the account owner - orgs are just for grouping/permissions.

## Implementation Steps

1. Review and approve schema
2. Create migration scripts
3. Test on staging
4. Schedule maintenance window
5. Execute migration
6. Update application code
7. Verify all features work