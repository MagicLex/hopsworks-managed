-- Table to track health check failures for debugging and monitoring
CREATE TABLE IF NOT EXISTS health_check_failures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  check_type TEXT NOT NULL, -- e.g., 'stripe_customer_creation', 'cluster_assignment', 'hopsworks_user_creation'
  error_message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Index for querying by user
CREATE INDEX idx_health_check_failures_user_id ON health_check_failures(user_id);
CREATE INDEX idx_health_check_failures_email ON health_check_failures(email);
CREATE INDEX idx_health_check_failures_created_at ON health_check_failures(created_at DESC);
CREATE INDEX idx_health_check_failures_unresolved ON health_check_failures(resolved_at) WHERE resolved_at IS NULL;

-- RLS policies
ALTER TABLE health_check_failures ENABLE ROW LEVEL SECURITY;

-- Admin can see all failures
CREATE POLICY "Admins can view all health check failures" ON health_check_failures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_admin = true
    )
  );

-- Admin can update failures (to mark as resolved)
CREATE POLICY "Admins can update health check failures" ON health_check_failures
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_admin = true
    )
  );

-- Service role can insert failures
CREATE POLICY "Service role can insert health check failures" ON health_check_failures
  FOR INSERT
  WITH CHECK (true);