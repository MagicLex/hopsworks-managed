# Views and Functions

## Database Views

### team_members

Provides an easy way to query team member relationships.

```sql
CREATE OR REPLACE VIEW team_members AS
SELECT 
  tm.id as member_id,
  tm.email as member_email,
  tm.name as member_name,
  tm.created_at as joined_at,
  tm.hopsworks_username,
  tm.hopsworks_project_id,
  tm.last_login_at,
  owner.id as owner_id,
  owner.email as owner_email,
  owner.name as owner_name
FROM users tm
JOIN users owner ON tm.account_owner_id = owner.id
WHERE tm.account_owner_id IS NOT NULL;
```

**Usage:**
```sql
-- Get all team members for an owner
SELECT * FROM team_members WHERE owner_id = 'auth0|123';

-- Count team sizes
SELECT owner_email, COUNT(*) as team_size
FROM team_members
GROUP BY owner_id, owner_email
ORDER BY team_size DESC;
```

### account_usage

Simple view for account-level usage aggregation.

```sql
CREATE OR REPLACE VIEW account_usage AS
SELECT 
  COALESCE(u.account_owner_id, u.id) as account_owner_id,
  date,
  SUM(cpu_hours) as total_cpu_hours,
  SUM(gpu_hours) as total_gpu_hours,
  SUM(storage_gb) as total_storage_gb,
  SUM(cpu_hours * 0.1 + gpu_hours * 1.0 + storage_gb * 0.01) as total_cost
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), date;
```

**Usage:**
```sql
-- Get monthly usage for an account
SELECT 
  DATE_TRUNC('month', date) as month,
  SUM(total_cpu_hours) as monthly_cpu,
  SUM(total_cost) as monthly_cost
FROM account_usage
WHERE account_owner_id = 'auth0|123'
GROUP BY month
ORDER BY month DESC;
```

### account_usage_summary

Detailed view with user breakdown for account-level billing.

```sql
CREATE OR REPLACE VIEW account_usage_summary AS
SELECT 
  COALESCE(u.account_owner_id, u.id) as account_owner_id,
  ud.date,
  SUM(ud.cpu_hours) as total_cpu_hours,
  SUM(ud.gpu_hours) as total_gpu_hours,
  SUM(ud.storage_gb) as total_storage_gb,
  SUM(ud.cpu_hours * 0.0001) as total_cost,
  COUNT(DISTINCT ud.user_id) as active_users,
  jsonb_object_agg(
    ud.user_id, 
    jsonb_build_object(
      'cpu_hours', ud.cpu_hours,
      'gpu_hours', ud.gpu_hours,
      'storage_gb', ud.storage_gb
    )
  ) as user_breakdown
FROM usage_daily ud
JOIN users u ON ud.user_id = u.id
GROUP BY COALESCE(u.account_owner_id, u.id), ud.date;
```

**Usage:**
```sql
-- Get detailed breakdown for a specific date
SELECT 
  account_owner_id,
  date,
  total_cost,
  active_users,
  user_breakdown
FROM account_usage_summary
WHERE account_owner_id = 'auth0|123'
AND date = '2025-01-15';

-- Extract specific user's usage from breakdown
SELECT 
  date,
  user_breakdown->>'google-oauth2|789' as team_member_usage
FROM account_usage_summary
WHERE account_owner_id = 'auth0|123'
AND user_breakdown ? 'google-oauth2|789';
```

## Stored Functions

### increment_cluster_users

Safely increments the user count for a cluster.

```sql
CREATE OR REPLACE FUNCTION increment_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters
  SET current_users = current_users + 1,
      updated_at = NOW()
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;
```

### decrement_cluster_users

Safely decrements the user count for a cluster.

```sql
CREATE OR REPLACE FUNCTION decrement_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters
  SET current_users = GREATEST(current_users - 1, 0),
      updated_at = NOW()
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;
```

### update_updated_at_column

Trigger function to automatically update `updated_at` timestamps.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Applied to tables via triggers:**
```sql
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at 
BEFORE UPDATE ON user_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Useful Queries

### Account Overview
```sql
-- Complete account summary
WITH account_summary AS (
  SELECT 
    u.id,
    u.email,
    u.billing_mode,
    COUNT(DISTINCT tm.id) as team_size,
    uc.total_purchased - uc.total_used as credit_balance
  FROM users u
  LEFT JOIN users tm ON tm.account_owner_id = u.id
  LEFT JOIN user_credits uc ON uc.user_id = u.id
  WHERE u.account_owner_id IS NULL
  GROUP BY u.id, u.email, u.billing_mode, uc.total_purchased, uc.total_used
),
current_month_usage AS (
  SELECT 
    account_owner_id,
    SUM(total_cost) as month_cost
  FROM usage_daily
  WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY account_owner_id
)
SELECT 
  s.*,
  COALESCE(u.month_cost, 0) as current_month_cost
FROM account_summary s
LEFT JOIN current_month_usage u ON s.id = u.account_owner_id
ORDER BY s.team_size DESC;
```

### Daily Usage Report
```sql
-- Daily usage breakdown by account
SELECT 
  a.account_owner_id,
  u.email as owner_email,
  a.date,
  a.active_users,
  a.total_cpu_hours,
  a.total_storage_gb,
  a.total_cost
FROM account_usage_summary a
JOIN users u ON a.account_owner_id = u.id
WHERE a.date = CURRENT_DATE - 1
ORDER BY a.total_cost DESC;
```

### Team Activity
```sql
-- Active team members in last 7 days
SELECT 
  o.email as owner_email,
  tm.email as member_email,
  tm.last_login_at,
  COALESCE(SUM(ud.cpu_hours), 0) as cpu_used_7d
FROM users o
JOIN users tm ON tm.account_owner_id = o.id
LEFT JOIN usage_daily ud ON ud.user_id = tm.id 
  AND ud.date > CURRENT_DATE - 7
WHERE o.account_owner_id IS NULL
GROUP BY o.id, o.email, tm.id, tm.email, tm.last_login_at
HAVING tm.last_login_at > NOW() - INTERVAL '7 days'
ORDER BY o.email, cpu_used_7d DESC;
```