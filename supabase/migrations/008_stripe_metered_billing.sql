-- Migration: Add Stripe metered billing support
-- This migration adds tables and columns to support usage-based billing with Stripe

-- Add Hopsworks project ID to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS hopsworks_project_id TEXT;

-- Enhanced usage tracking with project and instance details
ALTER TABLE usage_daily 
ADD COLUMN IF NOT EXISTS project_id TEXT,
ADD COLUMN IF NOT EXISTS instance_type TEXT,
ADD COLUMN IF NOT EXISTS instance_hours DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS api_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reported_to_stripe BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_usage_record_id TEXT;

-- Create index for unreported usage
CREATE INDEX IF NOT EXISTS idx_usage_daily_unreported 
ON usage_daily(date, reported_to_stripe) 
WHERE reported_to_stripe = FALSE;

-- Stripe metered products mapping
CREATE TABLE IF NOT EXISTS stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL CHECK (product_type IN ('cpu_hours', 'api_calls', 'storage_gb', 'gpu_hours')),
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  unit_price DECIMAL(10,4) NOT NULL,
  unit_name TEXT NOT NULL, -- 'hour', 'call', 'gb-month'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_type, active) -- Only one active price per product type
);

-- Usage aggregation for Stripe reporting
CREATE TABLE IF NOT EXISTS stripe_usage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  usage_type TEXT NOT NULL,
  quantity DECIMAL(10,4) NOT NULL,
  unit_price DECIMAL(10,4),
  total_amount DECIMAL(10,2),
  stripe_subscription_item_id TEXT,
  stripe_usage_record_id TEXT,
  reported_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reported', 'failed')),
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date, usage_type)
);

-- Instance type pricing configuration
CREATE TABLE IF NOT EXISTS instance_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_type TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp')),
  hourly_rate DECIMAL(10,4) NOT NULL,
  cpu_count INTEGER NOT NULL,
  memory_gb INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common instance types and their pricing
INSERT INTO instance_pricing (instance_type, provider, hourly_rate, cpu_count, memory_gb) VALUES
-- AWS instances
('t3.medium', 'aws', 0.10, 2, 4),
('t3.large', 'aws', 0.19, 2, 8),
('t3.xlarge', 'aws', 0.38, 4, 16),
('m5.xlarge', 'aws', 0.50, 4, 16),
('m5.2xlarge', 'aws', 1.00, 8, 32),
('m5.4xlarge', 'aws', 2.00, 16, 64),
('m5.8xlarge', 'aws', 4.00, 32, 128),
('r5.xlarge', 'aws', 0.60, 4, 32),
('r5.2xlarge', 'aws', 1.30, 8, 64),
('r5.4xlarge', 'aws', 2.60, 16, 128),
('c5.xlarge', 'aws', 0.44, 4, 8),
('c5.2xlarge', 'aws', 0.88, 8, 16),
('c5.4xlarge', 'aws', 1.76, 16, 32)
ON CONFLICT (instance_type) DO NOTHING;

-- Add Stripe subscription info to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_usage_reports_user_date 
ON stripe_usage_reports(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_usage_reports_pending 
ON stripe_usage_reports(status) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer 
ON users(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- RLS policies
ALTER TABLE stripe_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_usage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_pricing ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON stripe_products FOR ALL USING (true);
CREATE POLICY "Service role full access" ON stripe_usage_reports FOR ALL USING (true);
CREATE POLICY "Service role full access" ON instance_pricing FOR ALL USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_stripe_products_updated_at BEFORE UPDATE ON stripe_products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instance_pricing_updated_at BEFORE UPDATE ON instance_pricing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();