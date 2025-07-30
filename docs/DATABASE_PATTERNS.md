# Database Patterns

## Key Patterns

1. **Auth0 ID as Primary Key**: Use Auth0 `sub` field directly
2. **Service Role for APIs**: Skip RLS, handle auth in application
3. **Hopsworks Username**: Store for K8s metrics mapping
4. **Usage Tracking**: Hourly snapshots → daily aggregation

## Main Tables

```sql
users                           -- Auth0 users
├── id (auth0_sub)
├── hopsworks_username          -- For K8s metrics
└── is_admin

hopsworks_clusters              -- Shared clusters
├── api_url, api_key
├── kubeconfig                  -- For K8s metrics
└── current_users/max_users

user_hopsworks_assignments      -- User → Cluster mapping
├── user_id
├── hopsworks_cluster_id
└── hopsworks_username

usage_hourly/usage_daily        -- Resource consumption
├── cpu_hours, memory_gb_hours
├── storage_gb
└── total_cost
```

## Common Queries

```typescript
// Get user with cluster
const { data } = await supabase
  .from('users')
  .select(`
    *,
    user_hopsworks_assignments (
      hopsworks_clusters (*)
    )
  `)
  .eq('id', userId)
  .single();

// Find available cluster
const { data: cluster } = await supabase
  .from('hopsworks_clusters')
  .select('*')
  .eq('status', 'active')
  .lt('current_users', supabase.raw('max_users'))
  .order('current_users')
  .limit(1)
  .single();
```