# Billing System

## Overview

The billing system uses **OpenCost** to track actual Kubernetes resource costs and bills users based on their project usage. All costs are sourced directly from OpenCost, ensuring accurate billing based on real cloud infrastructure costs.

## Architecture

### Cost Collection Pipeline

```
OpenCost (in cluster) → kubectl exec → Vercel API → Database → Stripe Billing
```

1. **OpenCost** runs in the Kubernetes cluster and tracks costs per namespace
2. **Hourly Collection** via Vercel cron job (`/api/usage/collect-opencost`)
3. **Direct Query** using `kubectl exec` - no external exposure needed
4. **Cost Aggregation** per user across all their projects
5. **Stripe Integration** for payment processing

## Key Components

### OpenCost Integration

OpenCost provides real-time cost data for Kubernetes workloads:
- CPU costs per hour
- RAM costs per hour  
- Storage (PV) costs
- Network costs (if configured)
- Load balancer costs (if applicable)

### Data Flow

1. **Namespace → User Mapping**
   - Each Hopsworks project runs in its own Kubernetes namespace
   - `user_projects` table maps namespaces to user accounts
   - Users can own multiple projects/namespaces

2. **Hourly Cost Collection**
   ```
   Every hour:
   - Query OpenCost for last hour's costs per namespace
   - Map each namespace to its owner via user_projects
   - Accumulate costs in usage_daily table
   - Update project_breakdown JSONB with details
   ```

3. **Daily Aggregation**
   - One `usage_daily` record per user per day
   - Costs accumulate throughout the day (24 updates)
   - Total cost = sum of all user's projects

## Database Schema

### user_projects
Maps Kubernetes namespaces to users for billing:
```sql
- user_id: Owner of the project
- project_id: Hopsworks project ID
- namespace: Kubernetes namespace name
- status: active/inactive
- last_seen_at: Last time costs were recorded
```

### usage_daily
Stores daily costs from OpenCost:
```sql
- opencost_cpu_cost: CPU costs in USD
- opencost_ram_cost: RAM costs in USD  
- opencost_storage_cost: Storage costs in USD
- opencost_total_cost: Total daily cost
- project_breakdown: JSONB with per-project details
```

## Billing Modes

### Prepaid
- Users purchase credits upfront
- Daily costs deducted from balance
- Auto-refill available when balance is low
- Credits tracked in `user_credits` table

### Postpaid
- Usage accumulated throughout the month
- Monthly invoice generated from OpenCost totals
- Stripe charges at end of billing period
- No upfront payment required

## Cost Calculation

All costs come directly from OpenCost based on actual resource usage:

```javascript
// Example OpenCost response for a namespace
{
  "namespace": "mlproject",
  "cpuCoreHours": 24.5,
  "cpuCost": 1.23,
  "ramByteHours": 137438953472,
  "ramCost": 0.45,
  "pvByteHours": 10737418240,
  "pvCost": 0.10,
  "totalCost": 1.78
}
```

## API Endpoints

### Cost Collection
- `POST /api/usage/collect-opencost` - Hourly cron job
- Collects costs from OpenCost
- Updates usage_daily records
- Maps namespaces to users

### Billing Management
- `GET /api/billing` - Get user's billing info
- `GET /api/billing/balance` - Get credit balance
- `POST /api/billing/purchase-credits` - Buy credits
- `POST /api/billing/sync-stripe` - Sync with Stripe

### Admin Endpoints
- `GET /api/admin/billing` - View all user billing

## Cron Jobs

### Hourly Cost Collection
```json
{
  "path": "/api/usage/collect-opencost",
  "schedule": "0 * * * *"  // Every hour
}
```

### Daily Stripe Sync
```json
{
  "path": "/api/billing/sync-stripe",
  "schedule": "0 3 * * *"  // 3 AM daily
}
```

## Team Billing

For team accounts:
1. Each team member can create projects
2. All project costs aggregate to the account owner
3. Owner sees breakdown by team member and project
4. Single invoice for the entire team

## Setup Requirements

### 1. OpenCost Installation
OpenCost must be installed in your Kubernetes cluster:

```bash
# Install OpenCost using Helm
helm repo add opencost https://opencost.github.io/opencost-helm-chart
helm install opencost opencost/opencost \
  --namespace opencost --create-namespace
```

### 2. Kubeconfig Setup
1. Upload kubeconfig in Admin UI (`/admin47392`)
2. Test connection with "Test OpenCost" button
3. Verify you see namespace costs

### 3. Database Migration
Run the migration to add OpenCost tables and columns:

```sql
-- Run sql/migrations/001_opencost_integration.sql in Supabase
```

### 4. Environment Variables
```env
# Existing variables remain unchanged
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
```

## Stripe Integration

### Products Setup
Products are automatically created based on OpenCost costs. No manual product creation needed.

### Webhook Configuration
```
Production: https://your-domain.vercel.app/api/webhooks/stripe
```

### Payment Flow
1. **Prepaid**: Purchase credits → Deduct daily from balance
2. **Postpaid**: Accumulate monthly → Charge via Stripe invoice

## Admin Features

Access at `/admin47392`:

### Cluster Management
- View all Hopsworks clusters
- Upload/update kubeconfig
- Test OpenCost connection
- Monitor connection status

### Cost Monitoring
- View real-time costs per namespace
- Check user-project mappings
- Force collection manually
- Review billing history

## Troubleshooting

### No Costs Showing
1. **Check OpenCost is running:**
   ```bash
   kubectl get pods -n opencost
   ```

2. **Test connection in Admin UI:**
   - Go to `/admin47392` → Clusters tab
   - Click "Test OpenCost" for your cluster
   - Should show connected + namespace count

3. **Verify namespace mapping:**
   ```sql
   SELECT * FROM user_projects WHERE user_id = 'YOUR_USER_ID';
   ```

### Collection Failures
1. **Check cron logs in Vercel dashboard**
2. **Verify kubeconfig is valid:**
   ```bash
   kubectl --kubeconfig=your-kubeconfig.yml get nodes
   ```
3. **Check OpenCost API directly:**
   ```bash
   kubectl exec -n opencost deploy/opencost -- \
     curl -s "http://localhost:9003/allocation/compute?window=1h&aggregate=namespace"
   ```

### Unmapped Namespaces
- Namespaces without owners won't be billed
- Check Hopsworks API for project ownership
- Ensure users have `hopsworks_username` set

## Common SQL Queries

```sql
-- Current month OpenCost totals
SELECT 
  date,
  opencost_total_cost,
  project_breakdown
FROM usage_daily
WHERE user_id = 'USER_ID'
AND date >= date_trunc('month', CURRENT_DATE)
ORDER BY date DESC;

-- All projects for a user
SELECT * FROM user_projects 
WHERE user_id = 'USER_ID' 
AND status = 'active';

-- Credits balance (prepaid users)
SELECT 
  total_purchased - total_used as balance
FROM user_credits
WHERE user_id = 'USER_ID';

-- Daily cost breakdown by project
SELECT 
  date,
  jsonb_each_text(project_breakdown) as project_costs
FROM usage_daily
WHERE user_id = 'USER_ID'
AND date = CURRENT_DATE;
```

## Security

- **No External Exposure**: OpenCost not exposed outside cluster
- **Secure Access**: Uses kubeconfig with kubectl exec
- **Read-Only**: Only queries costs, no modifications
- **Encrypted Storage**: Kubeconfig stored encrypted in database

## Migration from Legacy System

The system previously used hardcoded pricing. To migrate:

1. **Keep legacy fields** for historical data
2. **Use OpenCost fields** going forward:
   - `opencost_total_cost` instead of calculated `total_cost`
   - `opencost_cpu_cost` instead of `cpu_hours * rate`
3. **Gradual transition** - both systems can run in parallel

## Related Documentation

- [Database Schema](database/03-billing-tables.md)
- [API Documentation](api.md)
- [Deployment Guide](deployment.md)
- [Architecture Overview](architecture.md)