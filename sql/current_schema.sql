-- Current Production Schema
-- Date: 2025-01-31
-- This represents the complete current state after all migrations

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table with team support
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  
  -- Account ownership
  account_owner_id TEXT REFERENCES users(id),
  
  -- Billing
  billing_mode TEXT DEFAULT 'postpaid' CHECK (billing_mode IN ('prepaid', 'postpaid')),
  stripe_customer_id TEXT,
  stripe_test_customer_id TEXT,
  
  -- Features
  is_admin BOOLEAN DEFAULT false,
  auto_refill_enabled BOOLEAN DEFAULT false,
  auto_refill_amount DECIMAL(10,2) DEFAULT 50.00,
  auto_refill_threshold DECIMAL(10,2) DEFAULT 10.00,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  
  -- Hopsworks
  hopsworks_username TEXT,
  hopsworks_project_id INTEGER,
  
  -- Metadata
  registration_source TEXT,
  registration_ip INET,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Team invites
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_owner_id TEXT REFERENCES users(id) NOT NULL,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BILLING TABLES
-- =====================================================

-- User credits for prepaid billing
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) UNIQUE,
  total_purchased DECIMAL(10,2) DEFAULT 0,
  total_used DECIMAL(10,2) DEFAULT 0,
  free_credits_granted DECIMAL(10,2) DEFAULT 0,
  free_credits_used DECIMAL(10,2) DEFAULT 0,
  cpu_hours_used DECIMAL(10,2) DEFAULT 0,
  gpu_hours_used DECIMAL(10,2) DEFAULT 0,
  storage_gb_months DECIMAL(10,2) DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily usage tracking
CREATE TABLE IF NOT EXISTS usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  account_owner_id TEXT REFERENCES users(id),
  date DATE NOT NULL,
  cpu_hours DECIMAL(10,2) DEFAULT 0,
  gpu_hours DECIMAL(10,2) DEFAULT 0,
  storage_gb DECIMAL(10,2) DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  feature_store_api_calls INTEGER DEFAULT 0,
  model_inference_calls INTEGER DEFAULT 0,
  instance_type TEXT,
  instance_hours DECIMAL(10,2),
  total_cost DECIMAL(10,2) DEFAULT 0,
  reported_to_stripe BOOLEAN DEFAULT false,
  hopsworks_cluster_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- =====================================================
-- CLUSTER MANAGEMENT
-- =====================================================

-- Hopsworks clusters
CREATE TABLE IF NOT EXISTS hopsworks_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  max_users INTEGER DEFAULT 100,
  current_users INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  kubeconfig TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User cluster assignments
CREATE TABLE IF NOT EXISTS user_hopsworks_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) UNIQUE,
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  hopsworks_username TEXT
);

-- =====================================================
-- DEPRECATED (TO BE REMOVED)
-- =====================================================

-- Stripe products (prices now in app config)
CREATE TABLE IF NOT EXISTS stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  unit_price DECIMAL(10,4),
  unit_name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_account_owner ON users(account_owner_id) WHERE account_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_invites_owner ON team_invites(account_owner_id);

CREATE INDEX IF NOT EXISTS idx_usage_daily_user_date ON usage_daily(user_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_daily_account_owner ON usage_daily(account_owner_id, date) WHERE account_owner_id IS NOT NULL;

-- =====================================================
-- VIEWS
-- =====================================================

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

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION increment_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters
  SET current_users = current_users + 1,
      updated_at = NOW()
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters
  SET current_users = GREATEST(current_users - 1, 0),
      updated_at = NOW()
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at 
BEFORE UPDATE ON user_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES (Currently disabled)
-- =====================================================

-- Uncomment to enable RLS in production
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
-- etc...