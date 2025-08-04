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
2. Auth0 webhook → Creates user in database and Stripe subscription for account owners
3. User must add payment method before cluster assignment
4. After payment method added → Auto-assigns to available Hopsworks cluster
5. Creates OAuth user in Hopsworks & stores username

### Team Management
1. Account owners can invite team members via email
2. Team members join through invitation links
3. Team member usage is billed to account owner
4. Account owners manage team through dashboard

### Usage Collection (Every 15 minutes)
1. Single cron job loops through ALL active clusters with kubeconfig
2. For each cluster, gets ALL users assigned to it
3. For each user:
   - Queries Kubernetes for pods labeled with user's hopsworks_username
   - Gets current CPU/memory usage from metrics-server
   - Aggregates by project namespace
4. Accumulates in `usage_daily` table (adds 0.25 hours per run)
5. Deducts credits for prepaid users

### Billing
- **Postpaid** (default): Usage synced to Stripe daily for monthly invoicing
- **Prepaid** (opt-in): Users buy credits, usage deducted immediately
- Hybrid model supports both simultaneously
- Team member usage aggregated to account owner

## Database Schema
- **`users`** - Auth0 ID as primary key, includes hopsworks_username, team support via account_owner_id
- **`team_invites`** - Pending team invitations
- **`hopsworks_clusters`** - Shared cluster endpoints with kubeconfig for metrics
- **`user_hopsworks_assignments`** - Maps users to clusters
- **`usage_daily`** - Daily aggregated usage for billing
- **`user_credits`** - Prepaid credit tracking
- **`stripe_products`** - Stripe product/price mappings (deprecated)

## Security
- All API routes protected by Auth0
- Admin routes check `is_admin` flag in DB
- Service role key for Supabase operations
- Cluster API keys stored encrypted in DB
- Team members cannot access billing information