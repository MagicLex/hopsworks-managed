# Database Schema

## Supabase Tables

### users (managed by Supabase Auth)
- id: uuid (primary key)
- email: string
- created_at: timestamp

### user_profiles
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  organization TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### clusters
```sql
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  deployment_type TEXT NOT NULL, -- 'small', 'medium', 'large'
  zone TEXT NOT NULL, -- 'us-east-1', 'eu-west-1', 'ap-southeast-1'
  status TEXT DEFAULT 'provisioning',
  hopsworks_project_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  cluster_id UUID REFERENCES clusters(id),
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```