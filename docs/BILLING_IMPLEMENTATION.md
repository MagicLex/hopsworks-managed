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

### 2. Usage Collection (`/api/usage/collect-k8s.ts`)
FULLY IMPLEMENTED - Collects real usage data from Kubernetes every 15 minutes:
1. Runs via Vercel cron job every 15 minutes (requires Pro plan)
2. For ALL users across ALL clusters:
   - Finds pods labeled with owner = hopsworks_username
   - Gets current CPU and memory usage from metrics-server
   - Groups by project namespace
3. Accumulates in `usage_daily` table:
   - Adds 0.25 hours of usage per interval (15 min = 0.25 hr)
   - CPU hours accumulate throughout the day
   - Storage is always current snapshot (not cumulative)
4. Calculates costs based on instance type and usage
5. Deducts credits for prepaid users (if implemented)

**Important**: Billing is per-resource ownership. Each Kubernetes pod has an `owner` label, and only the owner is billed for that pod. Project collaborators can access shared resources without being charged.

### 3. Kubernetes Metrics Integration (`/lib/kubernetes-metrics.ts`)
Implemented to replace broken Hopsworks API:
- `getUserMetrics` - Gets all metrics for a user across projects
- `getProjectMetrics` - Gets metrics for a specific namespace
- Maps pods to users via labels (owner, user, project-id)
- Aggregates CPU cores, memory GB, and pod counts

### 4. Hopsworks API Integration (`/lib/hopsworks-api.ts`)
Still used for user/project management:
- `createHopsworksOAuthUser` - Creates OAuth user in Hopsworks
- `createHopsworksProject` - Creates project with standard services  
- `getUserProjects` - Gets all projects for a user
- `getHopsworksUserByAuth0Id` - Maps Auth0 ID to Hopsworks user

## ❌ Still Needed from Hopsworks

### 1. Enable OAuth Integration
Hopsworks needs to accept OAuth users with:
- Client ID from Auth0
- Subject (user ID) as identifier

### 2. Usage Tracking via Kubernetes
Need direct access to Kubernetes cluster to query:
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
- ❓ Each cluster needs API credentials in `hopsworks_clusters` table
- ❓ Admin credentials or API key for each cluster to fetch usage data

## Admin Features

### Test Hopsworks Connection
- Admin panel has "Test API" button for each user
- Shows raw API response to debug connectivity
- Located at `/admin47392`

## What's Actually Working

1. **User signup** → Creates Stripe subscription + assigns to cluster
2. **Daily usage collection** → Framework in place but no real data from Hopsworks
3. **Billing page** → Shows UI but usage always 0
4. **Credit system** → Prepaid users can buy/use credits
5. **Stripe sync** → Reports postpaid usage (but always 0)

## What Needs Configuration

1. **Cluster API credentials** - Set `api_key` in each cluster record (✅ Done)
2. **Hopsworks OAuth** - Enable OAuth users with Auth0 client ID
3. **Usage tracking** - Direct Kubernetes cluster access for metrics