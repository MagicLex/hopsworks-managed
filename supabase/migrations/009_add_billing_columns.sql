-- Add billing mode and feature flags to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'postpaid' CHECK (billing_mode IN ('prepaid', 'postpaid')),
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

-- Add credits tracking columns to user_credits table
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS free_credits_granted DECIMAL(10,2) DEFAULT 0;

-- Create credit transactions table for audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'grant', 'usage', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user pricing overrides table
CREATE TABLE IF NOT EXISTS user_pricing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  original_price DECIMAL(10,4) NOT NULL,
  override_price DECIMAL(10,4) NOT NULL,
  discount_percentage DECIMAL(5,2),
  valid_until TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  active BOOLEAN DEFAULT true
);

-- Indexes for new columns and tables
CREATE INDEX IF NOT EXISTS idx_users_billing_mode ON users(billing_mode);
CREATE INDEX IF NOT EXISTS idx_users_feature_flags ON users USING GIN(feature_flags);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pricing_overrides_user_id ON user_pricing_overrides(user_id) WHERE active = true;

-- RLS policies for new tables
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pricing_overrides ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access credit_transactions" ON credit_transactions FOR ALL USING (true);
CREATE POLICY "Service role full access user_pricing_overrides" ON user_pricing_overrides FOR ALL USING (true);

-- Function to deduct user credits (for prepaid mode)
CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id TEXT,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_total_purchased DECIMAL(10,2);
  v_total_used DECIMAL(10,2);
  v_free_credits DECIMAL(10,2);
BEGIN
  -- Get current balance
  SELECT 
    COALESCE(total_purchased, 0),
    COALESCE(total_used, 0),
    COALESCE(free_credits_granted, 0)
  INTO v_total_purchased, v_total_used, v_free_credits
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Calculate current available balance
  v_current_balance := v_total_purchased + v_free_credits - v_total_used;

  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required_amount', p_amount
    );
  END IF;

  -- Update total used
  v_new_balance := v_current_balance - p_amount;
  UPDATE user_credits
  SET total_used = v_total_used + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    p_user_id, 'usage', -p_amount, v_current_balance, v_new_balance, p_description
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance,
    'amount_deducted', p_amount
  );
END;
$$ LANGUAGE plpgsql;