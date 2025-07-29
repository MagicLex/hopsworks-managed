# Documentation

## Quick Links
- [Quick Start](QUICK_START.md) - Get running in 5 minutes
- [Architecture](ARCHITECTURE.md) - How it actually works
- [Database Patterns](DATABASE_PATTERNS.md) - Schema and queries

## Setup Guides
- [Stripe Setup](STRIPE_SETUP.md) - Payment configuration
- [Billing Implementation](BILLING_IMPLEMENTATION.md) - What's working vs needs config

## Key Facts
- Admin panel: `/admin47392`
- Database: Supabase with service role key
- Auth: Auth0 SDK v3 (NOT v4)
- Billing: Stripe with hybrid prepaid/postpaid
- Usage: Collected daily from Hopsworks API

## How It Works
1. User signs up → Auth0 → Webhook creates Stripe subscription
2. User assigned to Hopsworks cluster automatically
3. Daily cron pulls usage from Hopsworks API
4. Usage billed via Stripe (postpaid) or credits (prepaid)

## API Endpoints That Matter
- `/api/usage` - User's usage data
- `/api/billing` - Billing info and credit balance
- `/api/instance` - Get Hopsworks cluster URL
- `/api/usage/collect` - Cron job to collect usage
- `/api/admin/*` - Admin management

## Common Tasks
- Make user admin: `UPDATE users SET is_admin = true WHERE email = 'x@y.com'`
- Test Hopsworks API: Click "Test API" button in admin panel
- Enable prepaid: Use admin panel billing controls
- Add cluster: Use admin panel cluster management