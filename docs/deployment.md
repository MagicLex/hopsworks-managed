# Deployment Guide

## Prerequisites

1. **Vercel Account** - For hosting
2. **Auth0 Application** - Must be Auth0 v3
3. **Supabase Project** - For database
4. **Stripe Account** - For billing
5. **Hopsworks Cluster** - With admin access

## Initial Setup

### 1. Auth0 Configuration

1. Create new Regular Web Application in Auth0
2. Configure URLs:
   ```
   Allowed Callback URLs: https://your-domain.vercel.app/api/auth/callback
   Allowed Logout URLs: https://your-domain.vercel.app/
   ```
3. Enable Google OAuth2 social connection
4. Note down credentials for environment variables

### 2. Hopsworks Identity Provider

Configure Hopsworks to accept Auth0 users:

1. Access Hopsworks admin panel
2. Navigate to Identity Providers
3. Add OpenID Connect provider:
   - **Client ID**: Your Auth0 Client ID
   - **Client Secret**: Your Auth0 Client Secret
   - **Discovery URL**: `https://[your-tenant].auth0.com/.well-known/openid-configuration`
   - **First Login Flow**: "Create User If Unique"
   - **Sync Mode**: "Force"

### 3. Database Setup

Run migrations in Supabase SQL Editor:

```sql
-- Create tables (see docs/database.md for full schema)
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Run all CREATE TABLE statements
-- Create indexes
-- Set up initial data
```

### 4. Stripe Configuration

1. Create products and prices:
   - CPU Hour ($0.10)
   - GPU Hour ($2.00)
   - Storage GB-Month ($0.15)
   - API Calls ($0.01 per 1000)
   - Credits ($1.00)

2. Set up webhook endpoint:
   - URL: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.payment_succeeded`

## Vercel Deployment

### 1. Environment Variables

Set all variables from [.env.example](../.env.example) in Vercel dashboard.

### 2. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 3. Configure Cron Jobs

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/collect-k8s-metrics",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/charge-users",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

## Post-Deployment

### 1. Upload Kubeconfig

For each Hopsworks cluster:
1. Access admin panel at `/admin47392`
2. Navigate to Clusters tab
3. Upload kubeconfig for metrics collection

### 2. Verify Webhooks

1. Test Auth0 webhook with a new user signup
2. Test Stripe webhook with a test purchase
3. Check cron jobs in Vercel dashboard

### 3. Configure Admin Access

Set `ADMIN_EMAILS` environment variable with comma-separated admin emails.

## Monitoring

### Application Logs
- Vercel Functions logs
- Supabase query logs
- Auth0 logs

### Metrics Collection
- Check cron job execution in Vercel
- Monitor `usage_daily` table for new records
- Verify Kubernetes metrics with admin panel

### Billing
- Monitor Stripe dashboard
- Check `billing_history` table
- Review failed payments

## Troubleshooting

### Build Failures
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Authentication Issues
- Verify Auth0 v3 is being used
- Check callback URLs match exactly
- Ensure Auth0 secret is set

### Metrics Not Collecting
- Verify kubeconfig is valid
- Check pod labels in Kubernetes
- Test with "Force Collection" button
- Review cron job logs

### Billing Not Working
- Verify Stripe webhook secret
- Check product/price IDs
- Monitor webhook events in Stripe

## Security Checklist

- [ ] All environment variables set
- [ ] HTTPS enforced
- [ ] Admin emails restricted
- [ ] Webhook endpoints secured
- [ ] API keys rotated regularly
- [ ] Database backups configured

## Related Documentation

- [Architecture Overview](architecture.md)
- [Known Issues](known-issues.md)
- [Stripe Setup](stripe-setup.md)