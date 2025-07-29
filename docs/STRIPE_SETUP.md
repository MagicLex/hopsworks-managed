# Stripe Setup Guide

This guide walks through setting up Stripe for the Hopsworks Managed billing system.

## Prerequisites

1. Stripe account with access to create products and webhooks
2. Test mode enabled for initial setup

## Step 1: Create Products in Stripe Dashboard

### For Postpaid (Pay-as-you-go) Users

1. **Create a Subscription Product**
   - Name: "Hopsworks Usage"
   - Description: "Pay-as-you-go billing for Hopsworks resources"

2. **Add Metered Prices to the Subscription**

   a. **Compute Usage**
   - Name: "Compute Hours"
   - Pricing model: Usage-based (metered)
   - Usage type: Licensed
   - Aggregation: Sum of usage values during period
   - Price: $0.0001 per unit (we'll send cents as units)
   - Billing period: Monthly

   b. **Storage Usage** (Optional - can be combined with compute)
   - Name: "Storage GB-Month"
   - Pricing model: Usage-based (metered)
   - Usage type: Licensed
   - Aggregation: Maximum usage during period
   - Price: $0.10 per GB
   - Billing period: Monthly

   c. **API Calls** (Optional)
   - Name: "API Calls"
   - Pricing model: Usage-based (metered)
   - Usage type: Licensed
   - Aggregation: Sum of usage values during period
   - Price: $0.00005 per call (or $0.05 per 1000)
   - Billing period: Monthly

### For Prepaid Users

1. **Create One-time Products**
   - Product: "Hopsworks Credits"
   - Prices:
     - $25 credits
     - $50 credits
     - $100 credits
     - $500 credits

## Step 2: Configure Webhooks

1. Go to Developers → Webhooks in Stripe Dashboard
2. Add endpoint:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`

3. Copy the webhook signing secret

## Step 3: Set Environment Variables

Add to your `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron job secret for usage collection
CRON_SECRET=<generate-random-secret>
```

## Step 4: Database Setup

Run these SQL commands in order:

```sql
-- 1. Run the hybrid billing migration
-- Copy contents of: sql/migrations/003_hybrid_billing_system.sql

-- 2. Create stripe_products table (if not exists)
CREATE TABLE IF NOT EXISTS stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL CHECK (product_type IN ('cpu_hours', 'api_calls', 'storage_gb')),
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  unit_price DECIMAL(10,4) NOT NULL,
  unit_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_type, active)
);

-- 3. Insert placeholder products
INSERT INTO stripe_products (product_type, stripe_product_id, stripe_price_id, unit_price, unit_name)
VALUES 
  ('cpu_hours', 'prod_PENDING', 'price_PENDING', 0.0001, 'cent'),
  ('storage_gb', 'prod_PENDING', 'price_PENDING', 0.10, 'GB-month'),
  ('api_calls', 'prod_PENDING', 'price_PENDING', 0.00005, 'call')
ON CONFLICT DO NOTHING;

-- 4. After creating Stripe products, update with real IDs:
UPDATE stripe_products SET 
  stripe_product_id = 'prod_YOUR_PRODUCT_ID',
  stripe_price_id = 'price_YOUR_PRICE_ID'
WHERE product_type = 'cpu_hours';
```

## Step 5: Cron Jobs Setup

Set up these cron jobs (using Vercel Cron, GitHub Actions, or external service):

1. **Usage Collection** (Daily at 2 AM)
   ```bash
   curl -X POST https://your-domain.com/api/usage/collect-k8s \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Stripe Sync** (Daily at 3 AM)
   ```bash
   curl -X POST https://your-domain.com/api/billing/sync-stripe \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

## Step 6: Testing

### Test Postpaid Flow

1. Create a test user
2. User should be auto-subscribed to usage plan
3. Generate test usage data
4. Run usage collection endpoint
5. Run Stripe sync endpoint
6. Check Stripe Dashboard for usage records

### Test Prepaid Flow

1. Enable prepaid for a test user via admin API:
```bash
curl -X POST https://your-domain.com/api/admin/billing \
  -H "Cookie: appSession=..." \
  -d '{
    "action": "enable_prepaid",
    "userId": "auth0|xxx"
  }'
```

2. Purchase credits through checkout
3. Verify credits appear in balance
4. Generate usage and verify deduction

## Step 7: Discounts and Custom Pricing

### Option 1: Stripe Coupons
1. Create coupon in Stripe Dashboard
2. Apply to customer or subscription

### Option 2: Database Overrides
```bash
curl -X POST https://your-domain.com/api/admin/billing \
  -H "Cookie: appSession=..." \
  -d '{
    "action": "set_pricing_override",
    "userId": "auth0|xxx",
    "data": {
      "resourceType": "cpu_hours",
      "overridePrice": 0.05,
      "discountPercentage": 50,
      "reason": "Enterprise agreement"
    }
  }'
```

## Monitoring

### Key Metrics to Track

1. **Daily Usage Collection**
   - Success/failure rate
   - Users without usage data
   - Anomalous usage patterns

2. **Stripe Sync**
   - Records synced successfully
   - Failed syncs
   - Stripe API errors

3. **Credit Balance**
   - Users with low balance
   - Failed auto-refills
   - Credit purchase trends

### Useful Queries

```sql
-- Users by billing mode
SELECT billing_mode, COUNT(*) 
FROM users 
GROUP BY billing_mode;

-- Daily revenue
SELECT date, SUM(total_cost) as revenue
FROM usage_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date;

-- Users with low credit balance
SELECT u.email, uc.balance
FROM users u
JOIN user_credits uc ON u.id = uc.user_id
WHERE u.billing_mode = 'prepaid'
  AND uc.balance < 10;
```

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Ensure webhook secret is correct
   - Check that raw request body is used

2. **Usage not reporting to Stripe**
   - Verify subscription has correct price IDs
   - Check that usage_daily has data
   - Ensure cron jobs are running

3. **Credits not appearing**
   - Check webhook logs for checkout.session.completed
   - Verify credit_transactions table

### Debug Mode

Enable detailed logging:
```typescript
// In your API endpoints
console.log('Stripe sync:', {
  date: reportDate,
  usersProcessed: unreportedUsage.length,
  errors: results.errors
});
```