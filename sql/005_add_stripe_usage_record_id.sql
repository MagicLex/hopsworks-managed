-- Add stripe_usage_record_id to usage_daily for audit trail
-- This field stores the Stripe meter event identifier returned when reporting usage to Stripe
-- Required for reconciliation and billing dispute resolution

ALTER TABLE usage_daily
ADD COLUMN IF NOT EXISTS stripe_usage_record_id TEXT;

-- Add index for faster lookups when reconciling with Stripe
CREATE INDEX IF NOT EXISTS idx_usage_daily_stripe_record
ON usage_daily(stripe_usage_record_id)
WHERE stripe_usage_record_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN usage_daily.stripe_usage_record_id IS 'Stripe meter event identifier from billing.meterEvents.create() - used for audit and reconciliation';
