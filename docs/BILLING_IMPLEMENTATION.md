# Billing Implementation Status

## ✅ Completed

### Database Schema
- **Hybrid billing tables** - Support for both prepaid and postpaid modes
- **Credit tracking** - Full audit trail with `credit_transactions` table
- **Usage tracking** - Daily usage per user per cluster with cost calculation
- **Custom pricing** - Override pricing per user/resource type
- **Feature flags** - Prepaid mode behind feature flag

### API Endpoints
- `/api/billing` - Get billing info, usage, and credit balance
- `/api/billing/balance` - Check credit balance (prepaid users)
- `/api/billing/purchase-credits` - Create Stripe checkout for credits
- `/api/billing/sync-stripe` - Sync postpaid usage to Stripe (cron)
- `/api/usage/collect` - Collect daily usage from clusters (cron)
- `/api/admin/billing` - Admin controls for enabling prepaid
- `/api/webhooks/stripe` - Handle Stripe events
- `/api/webhooks/auth0` - Create Stripe customer/subscription on signup

### Frontend
- **Billing page** - Shows usage, costs, credit balance, and invoices
- **Credit purchase** - UI for prepaid users to buy credits
- **Billing mode awareness** - UI adapts based on user's billing mode

### Stripe Integration
- **Automatic subscription** - New users get Stripe subscription
- **Metered billing** - Daily usage reported to Stripe
- **Credit purchases** - One-time payments for prepaid users
- **Webhook handling** - Process payments and subscription changes

### Cron Jobs (vercel.json)
- **2 AM daily** - Collect usage from Hopsworks
- **3 AM daily** - Sync usage to Stripe

## ✅ Hopsworks Integration Implemented

Based on hopsworks-cloud patterns, we've implemented:

### 1. User Creation Flow (`/api/webhooks/auth0.ts`)
When a new user signs up:
1. Creates Stripe customer and subscription
2. Assigns user to Hopsworks cluster
3. Creates OAuth user in Hopsworks
4. Creates default project for the user

### 2. Usage Collection (`/api/usage/collect.ts`)
The usage collection now:
1. Looks up Hopsworks user by Auth0 ID
2. Gets all user's projects
3. Aggregates usage across projects
4. Calculates costs based on instance types

### 3. Hopsworks API Integration (`/lib/hopsworks-api.ts`)
Implemented these functions:
- `createHopsworksOAuthUser` - Creates OAuth user in Hopsworks
- `createHopsworksProject` - Creates project with standard services
- `getUserProjects` - Gets all projects for a user
- `getProjectUsage` - Gets daily usage for a project
- `getHopsworksUserByAuth0Id` - Maps Auth0 ID to Hopsworks user

## ❌ Still Needed from Hopsworks

### 1. Enable OAuth Integration
Hopsworks needs to accept OAuth users with:
- Client ID from Auth0
- Subject (user ID) as identifier

### 2. Usage API Endpoint
The endpoint `/hopsworks-api/api/admin/projects/{projectId}/usage` needs to return:
```json
{
  "date": "2024-01-15",
  "compute": {
    "instances": [{
      "type": "m5.xlarge",
      "hours": 24,
      "cpuHours": 96,
      "gpuHours": 0
    }]
  },
  "storage": {
    "featureStore": 50,
    "models": 20,
    "datasets": 30,
    "total": 100
  },
  "apiCalls": {
    "featureStore": 5000,
    "modelServing": 1000,
    "jobs": 200,
    "total": 6200
  }
}
```

### 3. User Search by OAuth Subject
Need ability to search users by OAuth subject:
```
GET /hopsworks-api/api/admin/users?filter=subject:{auth0_id}
```

## Environment Variables Configured

### In Production (Vercel)
- ✅ `STRIPE_SECRET_KEY` - Live Stripe secret key
- ✅ `STRIPE_PUBLISHABLE_KEY` - Live publishable key  
- ✅ `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- ✅ `CRON_SECRET` - Auth for cron endpoints

### Still Needed
- ❓ `HOPSWORKS_API_URL` - Not used yet
- ❓ `HOPSWORKS_API_KEY` - Not used yet

## Testing Checklist

- [ ] Create new user → Verify Stripe customer/subscription created
- [ ] Generate mock usage → Verify it appears in billing page
- [ ] Run usage collection cron → Verify usage recorded
- [ ] Run Stripe sync cron → Verify usage reported to Stripe
- [ ] Enable prepaid for user → Verify can purchase credits
- [ ] Purchase credits → Verify balance updated
- [ ] Generate usage as prepaid user → Verify credits deducted

## Next Steps

1. **Define Hopsworks API contract** - Agree on endpoints and data format
2. **Implement API integration** - Replace mock in collect.ts
3. **Add monitoring** - Track collection failures, usage anomalies
4. **Test with real data** - Verify calculations match expectations
5. **Add usage details page** - Show breakdown by day/resource