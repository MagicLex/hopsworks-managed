# Database Overview

## Connection Details

### Database Provider
- **Provider**: Supabase (PostgreSQL)
- **Project Reference**: `pahfsiosiuxdkiebepav`
- **Region**: `us-east-1`

### Connection Methods

#### Connection Pooler (Recommended for Serverless)
```
postgresql://postgres.pahfsiosiuxdkiebepav:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
- **Port**: 6543
- **Use for**: Next.js API routes, serverless functions

#### Direct Connection
```
postgresql://postgres.pahfsiosiuxdkiebepav:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```
- **Port**: 5432
- **Use for**: Migrations, long-running connections

### Using psql
```bash
# Connection pooler
PGPASSWORD='your-password' psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -U postgres.pahfsiosiuxdkiebepav -d postgres

# Direct connection
PGPASSWORD='your-password' psql -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.pahfsiosiuxdkiebepav -d postgres
```

### Environment Variables
- Password stored in `.env.local` as `SUPABASE_DB_PASSWORD`
- Service role key in `SUPABASE_SERVICE_ROLE_KEY`

## Architecture Principles

### 1. Account-Owner Billing Model
- Account owners (users with `account_owner_id = NULL`) pay for everything
- Team members (users with `account_owner_id` set) have no billing access
- All usage is tracked at both user and account level

### 2. Team Structure
- Simple two-level hierarchy: owners and members
- No complex organization structure
- Team members linked via `account_owner_id` foreign key

### 3. Cluster Assignment
- Users assigned to Hopsworks clusters via `user_hopsworks_assignments`
- Team members automatically assigned to same cluster as owner
- Clusters have capacity limits (`max_users`)

### 4. Usage Tracking
- Daily granularity in `usage_daily` table
- Tracks both `user_id` and `account_owner_id`
- Costs calculated based on usage metrics

## Security

### Row Level Security (RLS)
- Currently disabled for simplicity
- All access controlled via service role key in API layer
- Future consideration for enabling RLS

### Authentication
- Users authenticated via Auth0
- User IDs are Auth0 sub claims (e.g., `auth0|123`, `google-oauth2|456`)
- API routes verify Auth0 sessions

## Data Types

### Common Patterns
- **IDs**: 
  - User IDs: `TEXT` (Auth0 format)
  - System IDs: `UUID` with `gen_random_uuid()`
- **Timestamps**: `TIMESTAMPTZ` (with timezone)
- **Money**: `DECIMAL(10,2)` for USD amounts
- **JSON**: `JSONB` for flexible metadata

### Naming Conventions
- Tables: `snake_case` plural (e.g., `users`, `team_invites`)
- Columns: `snake_case` (e.g., `account_owner_id`)
- Foreign keys: `{table}_id` (e.g., `user_id`, `cluster_id`)
- Timestamps: `{action}_at` (e.g., `created_at`, `accepted_at`)