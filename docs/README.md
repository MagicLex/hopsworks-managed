# Documentation

## Start Here
- [Billing System](BILLING_SYSTEM.md) - **MAIN DOC** - How billing and usage tracking works
- [Architecture](ARCHITECTURE.md) - System overview and tech stack
- [Quick Start](QUICK_START.md) - Get running in 5 minutes

## Implementation Details
- [Database Patterns](DATABASE_PATTERNS.md) - Schema and queries
- [Kubernetes Metrics](kubernetes-metrics.md) - K8s metrics collection details
- [Billing Implementation](BILLING_IMPLEMENTATION.md) - Technical implementation status
- [Stripe Setup](STRIPE_SETUP.md) - Payment configuration

## Key Facts
- Admin panel: `/admin47392`
- Database: Supabase with service role key
- Auth: Auth0 SDK v3 (NOT v4)
- Billing: Stripe with hybrid prepaid/postpaid
- Usage: Collected daily from Kubernetes cluster metrics

## How Billing Works (TL;DR)
1. User launches pod → Pod labeled with `owner: username`
2. Every 15 minutes → Collect CPU/storage usage from all clusters
3. Accumulate in `usage_daily` table (adds 0.25 hours per run)
4. Daily at 3 AM → Report to Stripe or deduct credits

## API Endpoints That Matter
- `/api/usage` - User's usage data
- `/api/billing` - Billing info and credit balance
- `/api/instance` - Get Hopsworks cluster URL
- `/api/usage/collect-k8s` - Cron job to collect usage from Kubernetes
- `/api/admin/*` - Admin management

## Common Tasks
- Make user admin: `UPDATE users SET is_admin = true WHERE email = 'x@y.com'`
- Test K8s metrics: Click "Test API" button in admin panel (see Kubernetes Metrics section)
- Upload kubeconfig: Admin panel → Clusters tab → Upload Kubeconfig
- Enable prepaid: Use admin panel billing controls
- Add cluster: Use admin panel cluster management