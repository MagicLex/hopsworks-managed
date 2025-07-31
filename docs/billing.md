# Billing System

## Overview

The billing system tracks resource usage across Hopsworks clusters and charges users through Stripe based on actual consumption.

## Billing Model

### Resource-Based Billing
- **Owner Pays**: Project owners are billed for all resources used in their projects
- **Shared Projects**: Resources are billed to the project owner, not individual users
- **Collection Interval**: Usage metrics collected every 15 minutes via Kubernetes

### Pricing Components
1. **CPU Hours**: $0.10 per CPU core hour
2. **GPU Hours**: $2.00 per GPU hour  
3. **Storage**: $0.15 per GB-month
4. **API Calls**: $0.01 per 1000 calls
5. **Credits**: $1.00 per credit (prepaid option)

### Billing Modes
- **Postpaid** (default): Monthly charges based on usage
- **Prepaid** (opt-in): Purchase credits upfront, deduct as used

## Implementation

### 1. Kubernetes Metrics Collection

Metrics are collected directly from Kubernetes clusters every 15 minutes:

```yaml
# vercel.json
{
  "crons": [{
    "path": "/api/cron/collect-k8s-metrics",
    "schedule": "*/15 * * * *"
  }]
}
```

**Prerequisites:**
- Kubeconfig uploaded for each cluster
- Hopsworks username stored in database
- Pods labeled with: `hopsworks.user`, `hopsworks.project-id`, `hopsworks.project-name`

### 2. Database Schema

```sql
-- Daily usage aggregation
CREATE TABLE usage_daily (
  id UUID PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  date DATE,
  cpu_hours DECIMAL,
  gpu_hours DECIMAL,
  storage_gb_months DECIMAL,
  api_calls INTEGER,
  total_cost DECIMAL,
  hopsworks_cluster_id UUID
);

-- Credits tracking
CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY,
  total_purchased DECIMAL DEFAULT 0,
  total_used DECIMAL DEFAULT 0
);
```

### 3. Stripe Integration

#### Products Setup
1. Create products in Stripe Dashboard:
   - CPU Hour
   - GPU Hour
   - Storage GB-Month
   - API Calls
   - Credits

2. Configure webhook endpoint:
   ```
   https://your-domain.vercel.app/api/webhooks/stripe
   ```

3. Set environment variables (see [.env.example](../.env.example))

#### Monthly Billing Process
1. Aggregate usage from `usage_daily` table
2. Create Stripe invoice items for each resource type
3. Create and finalize invoice
4. Stripe handles payment collection

### 4. Admin Features

Access at `/admin47392`:
- View all users and their usage
- Test Kubernetes metrics collection
- Force usage collection
- Monitor billing status

## Troubleshooting

### No Metrics Collected
1. Check kubeconfig is uploaded for cluster
2. Verify pods have required labels
3. Check cron job logs in Vercel dashboard
4. Test with "Force Consumption Collection" button

### Billing Not Working
1. Verify Stripe webhook is configured
2. Check environment variables are set
3. Review Stripe dashboard for failed payments
4. Check `billing_history` table for records

### Common SQL Queries

```sql
-- User's current month usage
SELECT SUM(total_cost) as monthly_total
FROM usage_daily
WHERE user_id = 'USER_ID'
AND date >= date_trunc('month', CURRENT_DATE);

-- Credits balance
SELECT total_purchased - total_used as balance
FROM user_credits
WHERE user_id = 'USER_ID';
```

## Related Documentation

- [Kubernetes Metrics Details](kubernetes-metrics.md)
- [Stripe Setup Guide](stripe-setup.md)
- [Database Schema](database.md)