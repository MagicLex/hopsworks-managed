-- Users table (synced from Auth0)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Auth0 sub
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  registration_source TEXT,
  registration_ip INET,
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- User credits tracking
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  total_purchased DECIMAL(10,2) DEFAULT 0,
  total_used DECIMAL(10,2) DEFAULT 0,
  cpu_hours_used DECIMAL(10,2) DEFAULT 0,
  gpu_hours_used DECIMAL(10,2) DEFAULT 0,
  storage_gb_months DECIMAL(10,2) DEFAULT 0,
  last_purchase_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Daily usage tracking
CREATE TABLE IF NOT EXISTS usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cpu_hours DECIMAL(10,2) DEFAULT 0,
  gpu_hours DECIMAL(10,2) DEFAULT 0,
  storage_gb DECIMAL(10,2) DEFAULT 0,
  feature_store_api_calls INTEGER DEFAULT 0,
  model_inference_calls INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Billing history
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  description TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Hopsworks instances
CREATE TABLE IF NOT EXISTS instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  hopsworks_url TEXT,
  status TEXT DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'stopped', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id) -- One instance per user for MVP
);

-- Feature groups and model deployments (for tracking)
CREATE TABLE IF NOT EXISTS feature_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS model_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint TEXT,
  status TEXT DEFAULT 'deployed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_usage_daily_user_date ON usage_daily(user_id, date);
CREATE INDEX idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX idx_instances_user_id ON instances(user_id);
CREATE INDEX idx_feature_groups_user_id ON feature_groups(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_model_deployments_user_id ON model_deployments(user_id) WHERE deleted_at IS NULL;

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_deployments ENABLE ROW LEVEL SECURITY;

-- Policies (users can only see their own data)
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view own credits" ON user_credits FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view own usage" ON usage_daily FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view own billing" ON billing_history FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view own instances" ON instances FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view own feature groups" ON feature_groups FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view own models" ON model_deployments FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();