# Cluster Management Tables

## hopsworks_clusters

Manages available Hopsworks clusters that users can be assigned to.

### Schema
```sql
CREATE TABLE hopsworks_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                        -- Display name (e.g., 'us-east-1-prod')
  
  -- API Configuration
  api_url TEXT NOT NULL,                     -- Hopsworks API endpoint
  api_key TEXT NOT NULL,                     -- Admin API key for cluster
  
  -- Capacity Management  
  max_users INTEGER DEFAULT 100,             -- Maximum users allowed
  current_users INTEGER DEFAULT 0,           -- Current user count
  
  -- Status
  status TEXT DEFAULT 'active',              -- Cluster availability
  
  -- Kubernetes
  kubeconfig TEXT,                           -- K8s config for metrics collection
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,        -- Additional configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Status Values
- `active` - Available for new users
- `maintenance` - Temporary unavailable
- `full` - At capacity
- `inactive` - Decommissioned

### Indexes
- `hopsworks_clusters_pkey` - Primary key

### Business Rules
- Users assigned to clusters based on capacity
- `current_users` incremented via stored procedure
- API key used for creating Hopsworks users
- Kubeconfig used for collecting usage metrics

### Usage Examples
```sql
-- Find available clusters
SELECT * FROM hopsworks_clusters
WHERE status = 'active'
AND current_users < max_users
ORDER BY current_users ASC;

-- Get cluster load
SELECT 
  name,
  current_users,
  max_users,
  ROUND((current_users::numeric / max_users) * 100, 2) as capacity_percent
FROM hopsworks_clusters
WHERE status = 'active';

-- Update cluster status
UPDATE hopsworks_clusters
SET status = 'maintenance'
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
```

## user_hopsworks_assignments

Maps users to their assigned Hopsworks clusters.

### Schema
```sql
CREATE TABLE user_hopsworks_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  
  -- Assignment tracking
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,                          -- 'system', 'admin', 'team_member_auto'
  
  -- Hopsworks user details
  hopsworks_username TEXT,                   -- Username in Hopsworks
  
  PRIMARY KEY (user_id, hopsworks_cluster_id)
);
```

### Indexes
- `user_hopsworks_assignments_pkey` - Primary key
- Implicit indexes on foreign keys

### Assignment Types
- `system` - Automatic assignment for new users
- `admin` - Manual assignment by admin
- `team_member_auto` - Automatic for team members

### Business Rules
- One assignment per user (enforced by unique user_id)
- Team members assigned to same cluster as owner
- Assignment triggers Hopsworks user creation
- Cannot be deleted once created (audit trail)

### Usage Examples
```sql
-- Get user's cluster assignment
SELECT 
  u.email,
  c.name as cluster_name,
  a.assigned_at,
  a.hopsworks_username
FROM user_hopsworks_assignments a
JOIN users u ON a.user_id = u.id
JOIN hopsworks_clusters c ON a.hopsworks_cluster_id = c.id
WHERE u.id = 'auth0|123';

-- Find all users on a cluster
SELECT 
  u.email,
  u.name,
  a.assigned_at,
  CASE 
    WHEN u.account_owner_id IS NULL THEN 'owner'
    ELSE 'member'
  END as user_type
FROM user_hopsworks_assignments a
JOIN users u ON a.user_id = u.id
WHERE a.hopsworks_cluster_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY a.assigned_at DESC;

-- Check cluster assignment for team
SELECT 
  owner.email as owner_email,
  member.email as member_email,
  c.name as cluster_name
FROM users owner
JOIN users member ON member.account_owner_id = owner.id
JOIN user_hopsworks_assignments a ON member.id = a.user_id
JOIN hopsworks_clusters c ON a.hopsworks_cluster_id = c.id
WHERE owner.id = 'auth0|123';
```

## Cluster Assignment Workflow

### For Account Owners
1. User signs up via Auth0
2. Sets up Stripe payment method
3. System finds cluster with capacity
4. Creates assignment record
5. Creates Hopsworks user via API
6. Increments cluster user count

### For Team Members
1. Team member accepts invite
2. Signs up via Auth0 
3. System finds owner's cluster assignment
4. Assigns member to same cluster
5. Creates Hopsworks user
6. Increments cluster user count

### Stored Procedures

```sql
-- Increment cluster user count
CREATE OR REPLACE FUNCTION increment_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters
  SET current_users = current_users + 1
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;

-- Decrement cluster user count  
CREATE OR REPLACE FUNCTION decrement_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters
  SET current_users = GREATEST(current_users - 1, 0)
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;
```

## Monitoring Queries

```sql
-- Cluster health check
SELECT 
  c.name,
  c.status,
  c.current_users,
  c.max_users,
  COUNT(a.user_id) as actual_assignments,
  CASE 
    WHEN c.current_users != COUNT(a.user_id) 
    THEN 'MISMATCH' 
    ELSE 'OK' 
  END as count_status
FROM hopsworks_clusters c
LEFT JOIN user_hopsworks_assignments a ON c.id = a.hopsworks_cluster_id
GROUP BY c.id;

-- Recent assignments
SELECT 
  u.email,
  c.name as cluster,
  a.assigned_at,
  a.assigned_by
FROM user_hopsworks_assignments a
JOIN users u ON a.user_id = u.id
JOIN hopsworks_clusters c ON a.hopsworks_cluster_id = c.id
WHERE a.assigned_at > NOW() - INTERVAL '7 days'
ORDER BY a.assigned_at DESC;
```