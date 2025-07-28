-- Insert the demo.hops.works cluster
INSERT INTO clusters (name, api_url, api_key, max_users, status)
VALUES (
  'demo.hops.works',
  'https://demo.hops.works',
  '', -- API key should be set via environment or admin UI
  100, -- Default max users
  'active'
) ON CONFLICT (name) DO NOTHING;