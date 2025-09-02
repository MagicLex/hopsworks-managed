# Deployment Guide

## Prerequisites

1. **Vercel Account** - For hosting
2. **Auth0 Application** - Must be Auth0 v3
3. **Supabase Project** - For database
4. **Stripe Account** - For billing
5. **Hopsworks Cluster** - With admin access
6. **OpenCost** - Installed in Kubernetes cluster

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
5. **CRITICAL**: Set up Post Login Action:
   - Go to Auth0 Dashboard > Actions > Flows > Login
   - Create new Action with this code:
   ```javascript
   exports.onExecutePostLogin = async (event, api) => {
     const axios = require('axios');
     
     await axios.post('https://your-domain.vercel.app/api/webhooks/auth0', {
       user_id: event.user.user_id,
       email: event.user.email,
       name: event.user.name,
       ip: event.request.ip,
       created_at: event.user.created_at,
       logins_count: event.stats.logins_count
     }, {
       headers: {
         'x-auth0-secret': event.secrets.WEBHOOK_SECRET
       }
     });
   };
   ```
   - Add secret `WEBHOOK_SECRET` with the value from `AUTH0_WEBHOOK_SECRET`
   - Deploy the Action and add it to the Login flow

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
-- 1. Run the base schema from sql/current_schema.sql
-- 2. Run OpenCost migration from sql/migrations/001_opencost_integration.sql
```

Key tables for billing:
- `user_projects` - Maps namespaces to users
- `usage_daily` - Stores OpenCost metrics
- `user_credits` - Prepaid credit balances

See [Database Documentation](database/) for complete schema details.

### 4. Stripe Configuration

1. Products are created automatically based on OpenCost costs
2. Credits product for prepaid users ($1.00 per credit)

2. Set up webhook endpoint:
   - URL: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Events: 
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.created`
     - `customer.subscription.updated`

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

The cron jobs are already configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/usage/collect-opencost",
      "schedule": "0 * * * *"  // Every hour
    },
    {
      "path": "/api/billing/sync-stripe",
      "schedule": "0 3 * * *"  // Daily at 3 AM
    }
  ]
}
```

## Post-Deployment

### 1. Install OpenCost

After Hopsworks installation, configure OpenCost to use Hopsworks' Prometheus:

```yaml
# opencost-values.yaml
opencost:
  prometheus:
    internal:
      enabled: true
      serviceName: hopsworks-release-prometheus-server
      namespaceName: hopsworks
      port: 80
```

```bash
helm repo add opencost https://opencost.github.io/opencost-helm-chart
helm install opencost opencost/opencost \
  --namespace opencost --create-namespace \
  --values opencost-values.yaml

# Verify pods are running (2/2 READY)
kubectl get pods -n opencost
```

### 2. Upload Kubeconfig

For each Hopsworks cluster:
1. Access admin panel at `/admin47392`
2. Navigate to Clusters tab
3. Upload kubeconfig
4. Verify OpenCost shows "Active" status

### 3. Verify System

1. Test Auth0 webhook with a new user signup
2. Test Stripe webhook with a test purchase
3. Verify OpenCost connection in admin panel
4. Check cron jobs in Vercel dashboard
5. Monitor `usage_daily` for OpenCost data

### 3. Configure Admin Access

Set `ADMIN_EMAILS` environment variable with comma-separated admin emails.

## Monitoring

### Application Logs
- Vercel Functions logs
- Supabase query logs
- Auth0 logs

### Metrics Collection
- Check hourly OpenCost collection in Vercel logs
- Monitor `usage_daily` table for `opencost_*` columns
- Verify namespace mapping in `user_projects` table
- Verify OpenCost integration status in admin panel

### Billing
- Monitor Stripe dashboard
- Check `usage_daily` table for usage records
- Review failed payments in Stripe
- Verify daily sync job is running

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
- Review cron job logs in Vercel dashboard

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