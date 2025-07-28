-- Migration: Implement hybrid billing system (prepaid credits + pay-as-you-go)
-- Date: 2025-07-28
-- Purpose: Support both prepaid credits and postpaid billing modes

-- 1. Add billing mode and credit management to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'postpaid' CHECK (billing_mode IN ('prepaid', 'postpaid')),
ADD COLUMN IF NOT EXISTS auto_refill_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_refill_amount DECIMAL(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS auto_refill_threshold DECIMAL(10,2) DEFAULT 10.00;

-- 2. Enhance user_credits table for better tracking
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) GENERATED ALWAYS AS (total_purchased - total_used) STORED,
ADD COLUMN IF NOT EXISTS free_credits_granted DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_credits_used DECIMAL(10,2) DEFAULT 0;

-- 3. Add cluster tracking to usage_daily
ALTER TABLE usage_daily
ADD COLUMN IF NOT EXISTS hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_deducted DECIMAL(10,2) DEFAULT 0;

-- 4. Create credit transactions table for audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'grant', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  stripe_payment_intent_id TEXT,
  usage_daily_id UUID REFERENCES usage_daily(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 5. Create pricing overrides table for special customer pricing
CREATE TABLE IF NOT EXISTS user_pricing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('cpu_hours', 'gpu_hours', 'storage_gb', 'api_calls')),
  override_price DECIMAL(10,4) NOT NULL,
  original_price DECIMAL(10,4) NOT NULL,
  discount_percentage DECIMAL(5,2),
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  reason TEXT,
  UNIQUE(user_id, resource_type)
);

-- 6. Add indexes for performance
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type, created_at DESC);
CREATE INDEX idx_usage_daily_cluster ON usage_daily(hopsworks_cluster_id, date DESC);
CREATE INDEX idx_user_pricing_overrides_user ON user_pricing_overrides(user_id);

-- 7. Create function to deduct credits
CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id TEXT,
  p_amount DECIMAL(10,2),
  p_description TEXT,
  p_usage_daily_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_free_balance DECIMAL(10,2);
  v_free_deduction DECIMAL(10,2) := 0;
  v_paid_deduction DECIMAL(10,2) := 0;
BEGIN
  -- Get current balance with lock
  SELECT 
    total_purchased - total_used,
    free_credits_granted - free_credits_used
  INTO v_current_balance, v_free_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user has enough credits
  IF v_current_balance < p_amount AND v_free_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct from free credits first
  IF v_free_balance > 0 THEN
    v_free_deduction := LEAST(p_amount, v_free_balance);
    v_paid_deduction := p_amount - v_free_deduction;
  ELSE
    v_paid_deduction := p_amount;
  END IF;

  -- Update credits
  UPDATE user_credits
  SET 
    total_used = total_used + v_paid_deduction,
    free_credits_used = free_credits_used + v_free_deduction,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  v_new_balance := v_current_balance - v_paid_deduction;
  
  INSERT INTO credit_transactions (
    user_id, type, amount, balance_before, balance_after, 
    description, usage_daily_id
  ) VALUES (
    p_user_id, 'usage', -p_amount, v_current_balance, v_new_balance,
    p_description, p_usage_daily_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to grant free trial credits
CREATE OR REPLACE FUNCTION grant_trial_credits(p_user_id TEXT) RETURNS VOID AS $$
BEGIN
  -- Check if user already has credits record
  INSERT INTO user_credits (user_id, free_credits_granted)
  VALUES (p_user_id, 10.00)
  ON CONFLICT (user_id) DO UPDATE
  SET free_credits_granted = user_credits.free_credits_granted + 10.00;

  -- Record the grant
  INSERT INTO credit_transactions (
    user_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    p_user_id, 'grant', 10.00, 0, 10.00, 'Free trial credits'
  );
END;
$$ LANGUAGE plpgsql;

-- 9. Add RLS policies
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pricing_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions" ON credit_transactions 
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view own pricing" ON user_pricing_overrides 
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

-- 10. Skip free trial credits for existing users (they're already using the system)
-- New users will get trial credits via the Auth0 webhook

-- 11. Add feature flags support
ALTER TABLE users
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

-- Set default feature flags
UPDATE users 
SET feature_flags = jsonb_build_object(
  'prepaid_enabled', false,
  'custom_pricing_enabled', false
)
WHERE feature_flags = '{}'::jsonb;