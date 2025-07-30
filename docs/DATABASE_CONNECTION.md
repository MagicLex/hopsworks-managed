# Database Connection & Schema Documentation

## Supabase Database Connection

### Connection Details

**Project Reference**: `pahfsiosiuxdkiebepav`

### Connection Methods

#### Via Pooler (Recommended for applications)
```bash
postgresql://postgres.pahfsiosiuxdkiebepav:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

#### Direct Connection (For migrations/admin)
```bash
postgresql://postgres:[YOUR-PASSWORD]@db.pahfsiosiuxdkiebepav.supabase.co:5432/postgres
```

### Using psql CLI

```bash
# Via pooler (transaction mode)
PGPASSWORD='[YOUR-PASSWORD]' psql "postgresql://postgres.pahfsiosiuxdkiebepav:[URL-ENCODED-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Note: If password contains special characters, URL-encode them (e.g., @ becomes %40)
```

## Current Database Schema

### Tables Overview

```
billing_history            feature_groups          stripe_products
clusters                   hopsworks_clusters      subscriptions
credit_transactions        instances_backup        usage_daily
invoices                   model_deployments       usage_metrics
user_credits              user_hopsworks_assignments   user_pricing_overrides
user_profiles             users
```

### Core Tables

#### usage_daily Table

| Column Name | Data Type | Description |
|------------|-----------|-------------|
| id | uuid | Primary key |
| user_id | text | References users(id) |
| date | date | Usage date |
| cpu_hours | numeric | CPU hours consumed |
| gpu_hours | numeric | GPU hours consumed |
| storage_gb | numeric | Storage in GB |
| feature_store_api_calls | integer | Feature store API calls |
| model_inference_calls | integer | Model inference API calls |
| created_at | timestamp with time zone | Record creation time |
| hopsworks_cluster_id | uuid | References hopsworks_clusters(id) |
| total_cost | numeric | Total cost for the day |
| credits_deducted | numeric | Credits deducted (prepaid users) |

#### hopsworks_clusters Table

| Column Name | Data Type | Description |
|------------|-----------|-------------|
| id | uuid | Primary key |
| name | text | Cluster name |
| api_url | text | Hopsworks API endpoint |
| api_key | text | API key (encrypted) |
| max_users | integer | Maximum user capacity |
| current_users | integer | Current user count |
| status | text | active/inactive/maintenance |
| created_at | timestamp with time zone | Creation time |
| updated_at | timestamp with time zone | Last update |
| metadata | jsonb | Additional metadata |
| kubeconfig | text | Kubernetes config for metrics |

#### users Table (Key Columns)

| Column Name | Data Type | Description |
|------------|-----------|-------------|
| id | text | Auth0 user ID (primary key) |
| email | text | User email |
| name | text | User full name |
| is_admin | boolean | Admin access flag |
| billing_mode | text | prepaid/postpaid |
| feature_flags | jsonb | Feature toggles |
| hopsworks_username | text | Hopsworks username |
| created_at | timestamp with time zone | Account creation |
| status | text | active/suspended/deleted |

### Useful Queries

```sql
-- Check table schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usage_daily' 
ORDER BY ordinal_position;

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check recent usage records
SELECT * FROM usage_daily 
ORDER BY date DESC 
LIMIT 10;
```

## Migration Status

Note: Some migrations in the codebase haven't been applied to production yet. Always verify the actual schema before making changes:

- ✅ Basic usage_daily structure
- ✅ hopsworks_cluster_id, total_cost, credits_deducted columns
- ❌ instance_hours, memory_gb_hours columns (in code but not in prod)
- ❌ project_count, instance_type columns (in code but not in prod)

## Environment Variables

Add to `.env.local`:
```env
# For direct database access (optional)
SUPABASE_DB_PASSWORD=your-password-here
```