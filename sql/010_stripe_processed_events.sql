-- Track processed Stripe webhook events for idempotence
-- Prevents double-processing if Stripe retries a webhook

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup events older than 7 days (Stripe retries within 72h max)
CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_processed_at
  ON stripe_processed_events(processed_at);

-- Optional: Add a cron job or trigger to clean old events
-- DELETE FROM stripe_processed_events WHERE processed_at < NOW() - INTERVAL '7 days';
