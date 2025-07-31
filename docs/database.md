# Database Guide

**Note**: This is a simplified overview. For comprehensive documentation, see the [`/docs/database/`](./database/) directory.

## Quick Links

- [Complete Database Documentation](./database/README.md)
- [Core Tables Reference](./database/02-core-tables.md)
- [Billing Tables Reference](./database/03-billing-tables.md)
- [Migration History](./database/06-migrations.md)

## Connection

Using Supabase PostgreSQL with two connection methods:

### Connection Pooler (Recommended)
```
postgresql://postgres.pahfsiosiuxdkiebepav:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
- Port: 6543
- Use for serverless environments
- Project ref: `pahfsiosiuxdkiebepav`
- Region: `us-east-1`

### Direct Connection
```
postgresql://postgres.pahfsiosiuxdkiebepav:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```
- Port: 5432
- Use for long-running connections

### Using psql
```bash
# Connection pooler (recommended)
PGPASSWORD='your-password' psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -U postgres.pahfsiosiuxdkiebepav -d postgres

# Direct connection
PGPASSWORD='your-password' psql -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.pahfsiosiuxdkiebepav -d postgres
```

### Important Notes
- **URL Encoding**: Only needed in connection strings, NOT when using psql with PGPASSWORD
  - In URLs: `@` becomes `%40`
  - With psql: Use password as-is
- Password is in `.env.local` as `SUPABASE_DB_PASSWORD`

### Common Connection Errors
- `FATAL: Tenant or user not found` - Wrong project reference or region
- `Wrong password` - Check if you're URL-encoding when you shouldn't be

## Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- Auth0 ID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  is_admin BOOLEAN DEFAULT false,
  hopsworks_username TEXT,           -- Synced from Hopsworks
  stripe_customer_id TEXT
);
```

#### hopsworks_clusters
```sql
CREATE TABLE hopsworks_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  max_users INTEGER DEFAULT 100,
  current_users INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  kubeconfig TEXT,                   -- For metrics collection
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### user_hopsworks_assignments
```sql
CREATE TABLE user_hopsworks_assignments (
  user_id TEXT REFERENCES users(id),
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  hopsworks_username TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, hopsworks_cluster_id)
);
```

### Billing Tables

#### usage_daily
```sql
CREATE TABLE usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  date DATE NOT NULL,
  cpu_hours DECIMAL DEFAULT 0,
  gpu_hours DECIMAL DEFAULT 0,
  storage_gb_months DECIMAL DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  total_cost DECIMAL DEFAULT 0,
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_daily_user_date ON usage_daily(user_id, date);
```

#### user_credits
```sql
CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  total_purchased DECIMAL DEFAULT 0,
  total_used DECIMAL DEFAULT 0,
  cpu_hours_used DECIMAL DEFAULT 0,
  gpu_hours_used DECIMAL DEFAULT 0,
  storage_gb_months DECIMAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### billing_history
```sql
CREATE TABLE billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  stripe_invoice_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Design Patterns

### Auth0 ID Pattern
All user references use Auth0 ID format:
```
auth0|507f1f77bcf86cd799439011
google-oauth2|115161017478488946656
```

### Service Role Pattern
Use service role key for admin operations:
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### RLS (Row Level Security)
Currently disabled for simplicity. In production, enable RLS:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);
```

## Common Queries

### User Management
```sql
-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com';

-- Get user with cluster assignment
SELECT u.*, c.name as cluster_name, a.hopsworks_username
FROM users u
LEFT JOIN user_hopsworks_assignments a ON u.id = a.user_id
LEFT JOIN hopsworks_clusters c ON a.hopsworks_cluster_id = c.id
WHERE u.id = 'USER_ID';

-- Admin users
SELECT * FROM users WHERE is_admin = true;
```

### Usage Tracking
```sql
-- Current month usage
SELECT SUM(total_cost) as monthly_total
FROM usage_daily
WHERE user_id = 'USER_ID'
AND date >= date_trunc('month', CURRENT_DATE);

-- Daily breakdown
SELECT date, cpu_hours, gpu_hours, storage_gb_months, total_cost
FROM usage_daily
WHERE user_id = 'USER_ID'
ORDER BY date DESC
LIMIT 30;
```

### Cluster Management
```sql
-- Cluster utilization
SELECT 
  c.name,
  c.current_users,
  c.max_users,
  COUNT(a.user_id) as assigned_users
FROM hopsworks_clusters c
LEFT JOIN user_hopsworks_assignments a ON c.id = a.hopsworks_cluster_id
GROUP BY c.id;
```

## Migrations

Track applied migrations:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Related Documentation

- [API Patterns](api.md) - Database access patterns
- [Billing System](billing.md) - Usage tracking details