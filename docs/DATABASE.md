# Database CLI Access

## Quick Connect

```bash
# From .env.local
source .env.local && PGPASSWORD="$POSTGRES_PASSWORD" psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.pahfsiosiuxdkiebepav

# Direct (with password from env)
PGPASSWORD="$POSTGRES_PASSWORD" psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.pahfsiosiuxdkiebepav
```

## Common Commands

```bash
# List tables
\dt

# Show table structure  
\d usage_daily

# Quick query
-c "SELECT COUNT(*) FROM users;"
```

## Tables
- `users` - User accounts
- `usage_daily` - Daily costs (has `created_at` NOT `updated_at`)
- `user_projects` - Namespace mappings
- `user_hopsworks_assignments` - Cluster assignments
- `hopsworks_clusters` - Cluster configs
- `team_invites` - Pending invites
- `user_credits` - Prepaid credits
- `stripe_products` - Stripe mappings