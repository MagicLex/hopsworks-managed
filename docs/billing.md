# Billing System

## Overview

The billing system tracks resource usage across Hopsworks clusters and charges users through Stripe based on actual consumption. Team member usage is aggregated to the account owner for billing.

## Billing Model

### Resource-Based Billing
- **Account Owner Pays**: Account owners are billed for their own usage plus all team member usage
- **Team Members**: Cannot access billing, their usage is billed to account owner
- **Collection Interval**: Usage metrics collected every 15 minutes via Kubernetes

### Pricing Components
1. **CPU Hours**: $0.10 per CPU core hour
2. **Credits**: $1.00 per credit (prepaid option)

Note: GPU and storage billing are implemented in the system but not currently displayed in the UI.

### Billing Modes
- **Postpaid** (default): Monthly charges based on usage via Stripe subscription
  - Payment method required during registration
  - Monthly invoicing for actual usage
  - Cannot add payment methods after registration (contact support)
- **Prepaid** (feature flag required): Purchase credits upfront
  - Only available to users with `prepaid_enabled` feature flag
  - Minimum purchase: $25 credits
  - Valid amounts: $25, $50, $100, $500
- **Hybrid**: System supports users with different billing modes simultaneously

## Implementation

### 1. Kubernetes Metrics Collection

Metrics are collected directly from Kubernetes clusters every 15 minutes:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/usage/collect-k8s",
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
  account_owner_id TEXT REFERENCES users(id),
  date DATE,
  cpu_hours DECIMAL,
  gpu_hours DECIMAL,
  storage_gb DECIMAL,
  api_calls INTEGER,
  total_cost DECIMAL,
  hopsworks_cluster_id UUID
);

-- Credits tracking (with more fields)
CREATE TABLE user_credits (
  id UUID PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  total_purchased DECIMAL DEFAULT 0,
  total_used DECIMAL DEFAULT 0,
  free_credits_granted DECIMAL DEFAULT 0,
  free_credits_used DECIMAL DEFAULT 0,
  cpu_hours_used DECIMAL DEFAULT 0,
  gpu_hours_used DECIMAL DEFAULT 0,
  storage_gb_months DECIMAL DEFAULT 0
);
```

### 3. Stripe Integration

#### Payment Method Setup
- **Postpaid Users**: Payment method must be set up during initial registration
- **Adding Payment Methods**: Not supported post-registration (architectural limitation)
- **Prepaid Credits**: Available via `/api/billing/purchase-credits` endpoint

#### Products Setup
1. Create products in Stripe Dashboard:
   - CPU Hour
   - GPU Hour  
   - Storage GB-Month
   - API Calls
   - Credits

2. Configure webhook endpoints:
   ```
   Production: https://your-domain.vercel.app/api/webhooks/stripe
   Testing: https://your-domain.vercel.app/api/webhooks/stripe-test
   ```

3. Set environment variables (see [.env.example](../.env.example))

#### Daily Sync Process
A daily cron job at 3 AM syncs usage to Stripe:
```json
{
  "path": "/api/billing/sync-stripe",
  "schedule": "0 3 * * *"
}
```

This syncs postpaid usage to Stripe for monthly invoicing.

### 4. Admin Features

Access at `/admin47392`:
- View all users and their usage
- Test Kubernetes metrics collection
- Force usage collection
- Monitor billing status

## API Endpoints

### GET /api/billing
Returns current billing information:
```json
{
  "billingMode": "postpaid",
  "hasPaymentMethod": true,
  "paymentMethodDetails": {
    "type": "card",
    "card": {
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2025
    }
  },
  "subscriptionStatus": null,
  "prepaidEnabled": false,
  "currentUsage": {
    "cpuHours": "123.45",
    "storageGB": "50.00",
    "currentMonth": {
      "cpuCost": 12.35,
      "storageCost": 5.00,
      "total": 17.35
    }
  },
  "creditBalance": null,
  "invoices": []
}
```

### POST /api/billing/purchase-credits
Purchase prepaid credits (requires `prepaid_enabled` flag):
```json
{
  "amount": 50  // Must be 25, 50, 100, or 500
}
```

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
4. Check daily sync job is running

### "No Payment Method" Error
- For postpaid users: Payment method should have been added during registration
- This is a known limitation - users cannot add payment methods post-registration
- Contact support to resolve payment method issues

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

-- Check user billing mode and flags
SELECT 
  billing_mode,
  stripe_customer_id,
  feature_flags->>'prepaid_enabled' as prepaid_enabled
FROM users
WHERE id = 'USER_ID';
```

## Implementation Notes

### Dashboard Integration
- Billing tab shows payment method details (card brand, last 4 digits, expiry)
- "Manage Payment Methods" button opens Stripe portal for existing cards
- No "Add Card" functionality - payment methods set up during registration only
- Prepaid credit purchase only available to flagged users
- Team members cannot access billing information

## Related Documentation

- [API Documentation](api.md)
- [Deployment Guide](deployment.md)