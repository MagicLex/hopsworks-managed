-- Create table for managing Hopsworks cluster endpoints (e.g., demo.hops.works)
CREATE TABLE IF NOT EXISTS hopsworks_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  api_url TEXT NOT NULL,
  api_key TEXT,
  max_users INTEGER DEFAULT 100,
  current_users INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'full', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- User assignments to Hopsworks clusters
CREATE TABLE IF NOT EXISTS user_hopsworks_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  hopsworks_cluster_id UUID REFERENCES hopsworks_clusters(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, hopsworks_cluster_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hopsworks_clusters_status ON hopsworks_clusters(status);
CREATE INDEX IF NOT EXISTS idx_user_hopsworks_assignments_user ON user_hopsworks_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hopsworks_assignments_cluster ON user_hopsworks_assignments(hopsworks_cluster_id);

-- RLS
ALTER TABLE hopsworks_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_hopsworks_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role full access hopsworks_clusters" ON hopsworks_clusters FOR ALL USING (true);
CREATE POLICY "Service role full access hopsworks_assignments" ON user_hopsworks_assignments FOR ALL USING (true);

-- Insert the demo.hops.works cluster
INSERT INTO hopsworks_clusters (name, api_url, api_key, max_users, status)
VALUES (
  'demo.hops.works',
  'https://demo.hops.works',
  '', -- API key should be set via environment or admin UI
  100, -- Default max users
  'active'
) ON CONFLICT (name) DO NOTHING;