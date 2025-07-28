-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Clusters table for managing Hopsworks clusters
CREATE TABLE IF NOT EXISTS clusters (
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

-- User-cluster assignments
CREATE TABLE IF NOT EXISTS user_cluster_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, cluster_id)
);

-- Indexes
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_clusters_status ON clusters(status);
CREATE INDEX idx_user_cluster_assignments_user ON user_cluster_assignments(user_id);
CREATE INDEX idx_user_cluster_assignments_cluster ON user_cluster_assignments(cluster_id);

-- RLS for new tables
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cluster_assignments ENABLE ROW LEVEL SECURITY;

-- Admin policies (service role has full access)
CREATE POLICY "Service role full access clusters" ON clusters FOR ALL USING (true);
CREATE POLICY "Service role full access assignments" ON user_cluster_assignments FOR ALL USING (true);

-- Trigger for clusters updated_at
CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();