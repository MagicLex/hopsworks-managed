# Database Patterns

## Authentication & Authorization

### User Sync Pattern
- Auth0 is the source of truth for authentication
- Supabase stores user metadata and app-specific data
- Users are synced on first login via `/api/auth/sync-user`
- Admin status is stored in Supabase `users.is_admin` column

### Admin Access Pattern
```typescript
// Backend: Check admin status
const { data: user } = await supabase
  .from('users')
  .select('is_admin')
  .eq('id', session.user.sub)
  .single();

if (!user?.is_admin) {
  return res.status(403).json({ error: 'Forbidden' });
}

// Frontend: Use the useAdmin hook
const { isAdmin, loading } = useAdmin();
```

## Row Level Security (RLS)

We use service role key for all API operations, handling auth in the application layer:

```sql
-- Simple RLS policies for service role
CREATE POLICY "Service role full access" ON table_name FOR ALL USING (true);
```

This approach:
- Simplifies policy management
- Allows complex business logic in API layer
- Better performance (no RLS overhead)
- Auth0 handles authentication, we handle authorization

## Database Migrations

### Running Migrations
1. Use Supabase SQL editor for production
2. Always use `IF NOT EXISTS` clauses
3. Check existing schema before running

### Migration Pattern
```sql
-- Tables
CREATE TABLE IF NOT EXISTS table_name (...);

-- Columns
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

-- Policies
CREATE POLICY IF NOT EXISTS "policy_name" ON table_name ...;
```

## Cluster Management

### Two Types of Clusters
1. **`clusters`** - Individual user deployments/instances
2. **`hopsworks_clusters`** - Hopsworks cluster endpoints (e.g., demo.hops.works)

### Auto-assignment Pattern
When users sign up:
1. Find hopsworks_cluster with available capacity
2. Assign user to hopsworks_cluster
3. Increment cluster's `current_users`
4. Store assignment in `user_hopsworks_assignments`

The assignment happens automatically in `/api/auth/sync-user` when a new user signs up.

### Hopsworks Cluster States
- `active`: Accepting new users
- `full`: At capacity (current_users >= max_users)
- `maintenance`: Temporarily unavailable
- `inactive`: Decommissioned

## Performance Patterns

### Indexes
Always index:
- Foreign keys
- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Boolean flags with WHERE conditions

### Timestamps
- Use `TIMESTAMP WITH TIME ZONE` for all timestamps
- Auto-update `updated_at` with triggers
- Store UTC times, display in user's timezone

## Database Schema

### Core Tables

#### users
```sql
users
├── id (TEXT, PK)           -- Auth0 sub
├── email (TEXT, UNIQUE)
├── name (TEXT)
├── is_admin (BOOLEAN)      -- Admin access
├── status (TEXT)           -- active/suspended/deleted
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
├── last_login_at (TIMESTAMPTZ)
├── login_count (INTEGER)
└── metadata (JSONB)        -- Flexible extra data
```

#### user_credits
```sql
user_credits
├── id (UUID, PK)
├── user_id (TEXT, FK → users.id)
├── total_purchased (DECIMAL)
├── total_used (DECIMAL)
├── cpu_hours_used (DECIMAL)
├── gpu_hours_used (DECIMAL)
├── storage_gb_months (DECIMAL)
└── updated_at (TIMESTAMPTZ)
```

#### clusters (User Deployments)
```sql
clusters
├── id (UUID, PK)
├── user_id (UUID, FK → users.id)
├── deployment_type (TEXT)
├── zone (TEXT)
├── status (TEXT)
├── hopsworks_project_id (TEXT)
├── hopsworks_api_key (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### hopsworks_clusters (Cluster Endpoints)
```sql
hopsworks_clusters
├── id (UUID, PK)
├── name (TEXT, UNIQUE)     -- e.g., 'demo.hops.works'
├── api_url (TEXT)
├── api_key (TEXT)          -- Encrypted
├── max_users (INTEGER)
├── current_users (INTEGER)
├── status (TEXT)           -- active/maintenance/full/inactive
├── metadata (JSONB)
└── created_at/updated_at (TIMESTAMPTZ)
```

#### user_hopsworks_assignments
```sql
user_hopsworks_assignments
├── id (UUID, PK)
├── user_id (TEXT, FK → users.id)
├── hopsworks_cluster_id (UUID, FK → hopsworks_clusters.id)
├── assigned_at (TIMESTAMPTZ)
└── UNIQUE(user_id, hopsworks_cluster_id)
```

#### instances
```sql
instances
├── id (UUID, PK)
├── user_id (TEXT, FK → users.id, UNIQUE)
├── instance_name (TEXT)
├── hopsworks_url (TEXT)
├── status (TEXT)           -- provisioning/active/stopped/deleted
├── created_at (TIMESTAMPTZ)
├── activated_at (TIMESTAMPTZ)
└── deleted_at (TIMESTAMPTZ)
```

### Query Patterns

#### Get User with All Related Data
```typescript
const { data: userData } = await supabase
  .from('users')
  .select(`
    *,
    user_credits (
      total_purchased,
      total_used,
      cpu_hours_used,
      gpu_hours_used
    ),
    instances (
      instance_name,
      status,
      hopsworks_url
    )
  `)
  .eq('id', userId)
  .single();
```

#### Find Available Hopsworks Cluster for New User
```typescript
const { data: availableCluster } = await supabase
  .from('hopsworks_clusters')
  .select('*')
  .eq('status', 'active')
  .lt('current_users', supabase.raw('max_users'))
  .order('current_users', { ascending: true })
  .limit(1)
  .single();
```

#### Get User's Daily Usage
```typescript
const { data: usage } = await supabase
  .from('usage_daily')
  .select('*')
  .eq('user_id', userId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date', { ascending: false });
```

#### Admin: Get All Users with Credits
```typescript
const { data: users } = await supabase
  .from('users')
  .select(`
    *,
    user_credits!left (
      total_purchased,
      total_used
    )
  `)
  .order('created_at', { ascending: false });
```

#### Update User Credits (Atomic)
```typescript
// Read current value
const { data: credits } = await supabase
  .from('user_credits')
  .select('total_used')
  .eq('user_id', userId)
  .single();

// Update with new value
const newTotal = (credits?.total_used || 0) + amountUsed;
await supabase
  .from('user_credits')
  .update({ total_used: newTotal })
  .eq('user_id', userId);
```

### JSONB Queries

#### Store Flexible Metadata
```typescript
// Store
await supabase
  .from('users')
  .update({ 
    metadata: {
      preferences: { theme: 'dark', notifications: true },
      tags: ['beta', 'power-user']
    }
  })
  .eq('id', userId);

// Query by JSONB field
const { data } = await supabase
  .from('users')
  .select('*')
  .contains('metadata', { tags: ['beta'] });
```