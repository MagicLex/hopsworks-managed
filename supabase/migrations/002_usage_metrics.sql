-- Usage metrics table to track actual resource consumption
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  metric_date DATE NOT NULL,
  cpu_hours DECIMAL(10,2) DEFAULT 0,
  gpu_hours DECIMAL(10,2) DEFAULT 0,
  storage_gb DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, metric_date)
);

-- Feature groups table
CREATE TABLE feature_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Model deployments table
CREATE TABLE model_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'deployed',
  endpoint TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own usage metrics" ON usage_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feature groups" ON feature_groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own model deployments" ON model_deployments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_usage_metrics_user_date ON usage_metrics(user_id, metric_date);
CREATE INDEX idx_feature_groups_user ON feature_groups(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_model_deployments_user ON model_deployments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_user ON invoices(user_id);