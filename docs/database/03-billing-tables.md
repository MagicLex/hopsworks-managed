# Billing Tables

## user_projects

Maps Hopsworks projects/namespaces to users for billing purposes.

### Schema
```sql
CREATE TABLE user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  namespace TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);
```

### Indexes
- `idx_user_projects_namespace` - On namespace for quick lookups from OpenCost data
- `idx_user_projects_user_id` - For finding all projects owned by a user
- `idx_user_projects_last_seen` - For identifying inactive projects

### Purpose
Maps Kubernetes namespaces (from OpenCost) to user accounts for cost allocation.

### Key Fields
- `namespace`: Kubernetes namespace name (matches OpenCost data)
- `project_id`: Hopsworks project ID
- `status`: Active projects have costs, inactive are ignored
- `last_seen_at`: Updated when costs are found for this namespace

### Business Rules
- One user can own multiple projects
- Each project maps to exactly one namespace
- Projects marked inactive after 30 days without costs
- Automatically populated from Hopsworks API when new namespaces appear

## user_credits

Tracks credit balances for users in prepaid billing mode.

### Schema
```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) UNIQUE,
  
  -- Credit balances
  total_purchased DECIMAL(10,2) DEFAULT 0,
  total_used DECIMAL(10,2) DEFAULT 0,
  free_credits_granted DECIMAL(10,2) DEFAULT 0,
  free_credits_used DECIMAL(10,2) DEFAULT 0,
  
  -- Usage breakdown
  cpu_hours_used DECIMAL(10,2) DEFAULT 0,
  gpu_hours_used DECIMAL(10,2) DEFAULT 0,
  storage_gb_months DECIMAL(10,2) DEFAULT 0,
  
  -- Timestamps
  last_purchase_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Calculated Values
- **Available Balance**: `(total_purchased - total_used) + (free_credits_granted - free_credits_used)`
- **Paid Balance**: `total_purchased - total_used`
- **Free Balance**: `free_credits_granted - free_credits_used`

## usage_daily

Stores daily usage metrics and costs from OpenCost.

### Schema
```sql
CREATE TABLE usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  account_owner_id TEXT REFERENCES users(id),
  date DATE NOT NULL,
  
  -- Legacy fields (being phased out)
  cpu_hours DECIMAL(10,2) DEFAULT 0,
  gpu_hours DECIMAL(10,2) DEFAULT 0,
  storage_gb DECIMAL(10,2) DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  feature_store_api_calls INTEGER DEFAULT 0,
  model_inference_calls INTEGER DEFAULT 0,
  instance_type TEXT,
  instance_hours DECIMAL(10,2),
  
  -- OpenCost fields (source of truth)
  opencost_cpu_cost DECIMAL(10,4) DEFAULT 0,
  opencost_ram_cost DECIMAL(10,4) DEFAULT 0,
  opencost_storage_cost DECIMAL(10,4) DEFAULT 0,
  opencost_total_cost DECIMAL(10,4) DEFAULT 0,
  opencost_cpu_hours DECIMAL(10,4) DEFAULT 0,
  opencost_ram_gb_hours DECIMAL(10,4) DEFAULT 0,
  project_breakdown JSONB,  -- Per-project cost details
  
  total_cost DECIMAL(10,2) DEFAULT 0,  -- Daily total from OpenCost
  reported_to_stripe BOOLEAN DEFAULT false,
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
```

### Indexes
- `idx_usage_daily_user_date` - Composite on (user_id, date)
- `idx_usage_daily_account_owner` - For account-level aggregation

### Data Collection
- **Source**: OpenCost running in Kubernetes cluster
- **Method**: `kubectl exec` to query OpenCost API directly (no external exposure)
- **Frequency**: Hourly via Vercel cron job
- **Endpoint**: `/api/usage/collect-opencost`
- **Accumulation**: Each hour adds to the daily total

### Key Fields
- `opencost_*_cost`: Actual costs from OpenCost (USD)
- `opencost_*_hours`: Resource consumption in hours
- `project_breakdown`: JSONB with per-namespace breakdown:
  ```json
  {
    "project1": {
      "name": "ML Training",
      "cpuCost": 1.23,
      "ramCost": 0.45,
      "storageCost": 0.10,
      "totalCost": 1.78,
      "cpuHours": 24.5,
      "ramGBHours": 128.0,
      "cpuEfficiency": 0.65,
      "ramEfficiency": 0.80,
      "lastUpdated": "2024-01-08T10:00:00Z"
    }
  }
  ```

### Business Rules
- One record per user per day
- Costs accumulate throughout the day (24 hourly updates)
- All project costs for a user are aggregated into one daily record
- `total_cost` = sum of all project costs for that user

### Usage Examples
```sql
-- Get current month costs from OpenCost
SELECT 
  date,
  opencost_total_cost as daily_cost,
  opencost_cpu_hours as cpu_hours,
  opencost_ram_gb_hours as ram_gb_hours
FROM usage_daily
WHERE user_id = 'auth0|123'
AND date >= date_trunc('month', CURRENT_DATE)
ORDER BY date DESC;

-- Get project-level breakdown for a user
SELECT 
  date,
  project_breakdown->>'project1' as project1_details,
  (project_breakdown->'project1'->>'totalCost')::decimal as project1_cost
FROM usage_daily
WHERE user_id = 'auth0|123'
AND project_breakdown ? 'project1';

-- Find total costs across all users for billing
SELECT 
  account_owner_id,
  SUM(opencost_total_cost) as month_total
FROM usage_daily
WHERE date >= date_trunc('month', CURRENT_DATE)
GROUP BY account_owner_id;
```

## Billing Workflows

### OpenCost Collection Flow
1. Hourly cron job triggers `/api/usage/collect-opencost`
2. Uses `kubectl exec` to query OpenCost inside cluster
3. Gets costs per namespace for last hour
4. Maps namespaces to users via `user_projects` table
5. Accumulates hourly costs into `usage_daily` records
6. Updates `project_breakdown` JSONB with details

### Prepaid Flow
1. User purchases credits via Stripe
2. Credits added to `user_credits.total_purchased`
3. Daily OpenCost totals deducted from credits
4. If balance low, auto-refill (if enabled)

### Postpaid Flow  
1. OpenCost costs accumulated in `usage_daily`
2. Monthly invoice generated from `opencost_total_cost`
3. Stripe charges customer
4. `reported_to_stripe` flag updated

### Team Member Flow
1. Team member's projects tracked via `user_projects`
2. Costs aggregated to `account_owner_id`
3. Owner sees total costs across all team projects
4. Owner pays for all team usage