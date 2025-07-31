# Billing Tables

## user_credits

Tracks credit balances for users in prepaid billing mode.

### Schema
```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) UNIQUE,  -- One record per user
  
  -- Credit balances
  total_purchased DECIMAL(10,2) DEFAULT 0,   -- Total credits ever purchased
  total_used DECIMAL(10,2) DEFAULT 0,        -- Total credits ever used
  free_credits_granted DECIMAL(10,2) DEFAULT 0,  -- Promotional credits given
  free_credits_used DECIMAL(10,2) DEFAULT 0,     -- Promotional credits used
  
  -- Usage breakdown
  cpu_hours_used DECIMAL(10,2) DEFAULT 0,    -- Total CPU hours consumed
  gpu_hours_used DECIMAL(10,2) DEFAULT 0,    -- Total GPU hours consumed
  storage_gb_months DECIMAL(10,2) DEFAULT 0, -- Total storage used
  
  -- Timestamps
  last_purchase_at TIMESTAMPTZ,              -- Last credit purchase
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `user_credits_pkey` - Primary key
- `user_credits_user_id_key` - Unique constraint on user_id

### Calculated Values
- **Available Balance**: `(total_purchased - total_used) + (free_credits_granted - free_credits_used)`
- **Paid Balance**: `total_purchased - total_used`
- **Free Balance**: `free_credits_granted - free_credits_used`

### Business Rules
- Only account owners have credit records
- Team members don't have their own credits
- Credits are deducted in real-time as usage occurs
- Negative balance prevented by application logic

### Usage Examples
```sql
-- Get user's current balance
SELECT 
  user_id,
  (total_purchased - total_used) as paid_balance,
  (free_credits_granted - free_credits_used) as free_balance,
  (total_purchased - total_used) + (free_credits_granted - free_credits_used) as total_balance
FROM user_credits
WHERE user_id = 'auth0|123';

-- Check if user has enough credits
SELECT 
  CASE 
    WHEN (total_purchased - total_used) + (free_credits_granted - free_credits_used) >= 10.50 
    THEN true 
    ELSE false 
  END as has_sufficient_credits
FROM user_credits
WHERE user_id = 'auth0|123';
```

## usage_daily

Stores daily usage metrics and costs for all users.

### Schema
```sql
CREATE TABLE usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),         -- Who generated the usage
  account_owner_id TEXT REFERENCES users(id), -- Who pays for it
  date DATE NOT NULL,                        -- Usage date
  
  -- Resource usage
  cpu_hours DECIMAL(10,2) DEFAULT 0,
  gpu_hours DECIMAL(10,2) DEFAULT 0,
  storage_gb DECIMAL(10,2) DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  feature_store_api_calls INTEGER DEFAULT 0,
  model_inference_calls INTEGER DEFAULT 0,
  
  -- Instance details
  instance_type TEXT,                        -- Type of compute instance
  instance_hours DECIMAL(10,2),              -- Hours instance was running
  
  -- Billing
  total_cost DECIMAL(10,2) DEFAULT 0,        -- Total cost for this day
  reported_to_stripe BOOLEAN DEFAULT false,  -- Sent to Stripe for postpaid
  
  -- Cluster tracking
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_usage_daily_user_date` - Composite on (user_id, date)
- `idx_usage_daily_account_owner` - For account-level aggregation
- `usage_daily_user_id_date_key` - Unique constraint on (user_id, date)

### Business Rules
- One record per user per day
- `account_owner_id` set to track who pays
- For account owners: `account_owner_id = user_id`
- For team members: `account_owner_id = their owner's ID`
- Costs calculated based on resource usage

### Pricing (from stripe_products table)
- CPU hours: $0.0001 per hour
- GPU hours: (not currently used)
- Storage: $0.10 per GB-month
- API calls: $0.0001 per call

### Usage Examples
```sql
-- Get current month usage for a user
SELECT 
  SUM(cpu_hours) as total_cpu,
  SUM(storage_gb) as max_storage,
  SUM(total_cost) as month_cost
FROM usage_daily
WHERE user_id = 'auth0|123'
AND date >= date_trunc('month', CURRENT_DATE);

-- Get account-level usage (owner + all team members)
SELECT 
  date,
  SUM(cpu_hours) as total_cpu,
  SUM(total_cost) as daily_cost,
  COUNT(DISTINCT user_id) as active_users
FROM usage_daily
WHERE account_owner_id = 'auth0|123'
GROUP BY date
ORDER BY date DESC;

-- Find unpaid usage for postpaid billing
SELECT * FROM usage_daily
WHERE reported_to_stripe = false
AND date < CURRENT_DATE
AND account_owner_id IN (
  SELECT id FROM users 
  WHERE billing_mode = 'postpaid'
);
```

## stripe_products (DEPRECATED)

Legacy table for product pricing. Prices are now hardcoded in application.

### Schema
```sql
CREATE TABLE stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT,                         -- 'cpu_hours', 'storage_gb', 'api_calls'
  stripe_product_id TEXT,                    -- Stripe product ID
  stripe_price_id TEXT,                      -- Stripe price ID
  unit_price DECIMAL(10,4),                  -- Price per unit
  unit_name TEXT,                            -- Unit description
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Current Data
| product_type | unit_price | unit_name |
|-------------|------------|-----------|
| cpu_hours   | 0.0001     | cent      |
| storage_gb  | 0.1000     | GB-month  |
| api_calls   | 0.0001     | call      |

### Migration Plan
This table should be removed and prices moved to application configuration.

## Billing Workflows

### Prepaid Flow
1. User purchases credits via Stripe
2. Credits added to `user_credits.total_purchased`
3. Daily usage deducted from credits
4. If balance low, auto-refill (if enabled)

### Postpaid Flow  
1. Usage accumulated in `usage_daily`
2. Monthly invoice generated
3. Stripe charges customer
4. `reported_to_stripe` flag updated

### Team Member Flow
1. Team member usage tracked with their `user_id`
2. `account_owner_id` set to the paying user
3. Owner sees aggregated usage
4. Owner pays for all team usage