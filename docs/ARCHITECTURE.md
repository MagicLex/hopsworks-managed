# Architecture Overview

## Tech Stack
- **Frontend**: Next.js 15.4 (Pages Router), TypeScript
- **UI**: tailwind-quartz component library
- **Auth**: Auth0 SDK v3 (MUST use v3, not v4)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (live integration)
- **Hosting**: Vercel with cron jobs

## Key Flows

### User Signup
1. Auth0 authentication
2. Auth0 webhook → Creates Stripe customer & subscription
3. Auto-assigns user to available Hopsworks cluster
4. Creates OAuth user in Hopsworks (if configured)

### Daily Usage Collection (2 AM UTC)
1. Loops through all active clusters
2. For each user:
   - Fetches Hopsworks user by email (Hopsworks doesn't store Auth0 IDs)
   - Gets all user projects
   - Aggregates CPU/GPU hours, storage, API calls
3. Stores in `usage_daily` with calculated costs
4. Deducts credits for prepaid users

### Billing
- **Postpaid** (default): Usage synced to Stripe daily for monthly invoicing
- **Prepaid** (opt-in): Users buy credits, usage deducted immediately
- Hybrid model supports both simultaneously

## Database Schema
- **`users`** - Auth0 ID as primary key
- **`hopsworks_clusters`** - Shared cluster endpoints (NOT individual deployments)
- **`user_hopsworks_assignments`** - Maps users to clusters
- **`usage_daily`** - Daily usage records with costs
- **`user_credits`** - Prepaid credit tracking
- **`user_billing_subscriptions`** - Stripe subscription info

Note: The old `clusters` table was removed - we only use `hopsworks_clusters` now.

## Security
- All API routes protected by Auth0
- Admin routes check `is_admin` flag in DB
- Service role key for Supabase operations
- Cluster API keys stored encrypted in DB