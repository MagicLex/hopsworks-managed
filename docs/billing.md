# Billing System

## Overview

The billing system tracks resource usage via OpenCost and applies our pricing model. We support both **prepaid** (enterprise/invoice) and **postpaid** (Stripe) billing modes.

## Architecture

```
OpenCost (usage units) → Our Pricing → Database → Stripe (postpaid) or Invoice (prepaid)
```

### Key Principles
- **OpenCost** collects raw usage metrics (CPU hours, GPU hours, RAM GB-hours)
- **We apply pricing** using our rate card
- **Stripe handles billing** for postpaid customers
- **Manual invoicing** for prepaid/enterprise customers

## Pricing Model

### Current Resource Rates
Rates live in `src/config/billing-rates.ts` and represent the single source of truth for both SaaS and prepaid customers.

| Resource                | Credits | USD Equivalent |
|-------------------------|---------|----------------|
| 1 vCPU hour             | 0.50    | $0.175         |
| 1 GPU hour              | 10.00   | $3.50          |
| 1 GB RAM hour           | 0.05    | $0.0175        |
| 1 GB-month online storage | 2.00  | $0.50          |
| 1 GB-month offline storage | 0.12 | $0.03          |
| 1 GB network egress     | 0.40    | $0.14          |

### Credits as an Internal Unit
- Credits keep pricing consistent between live Stripe billing and prepaid invoices.
- `calculateCreditsUsed()` converts OpenCost usage into credits; `calculateDollarAmount()` multiplies by `$0.35/credit`.
- Credits are **not** sold directly in the app; corporate customers settle invoices off-platform using the reported credit totals.

### Billing Modes

#### Prepaid (Corporate/Enterprise)
- **Registration**: Via special link with `?corporate_ref=deal_id`
- **Payment**: Invoice/wire transfer (handled outside platform)
- **Stripe**: Not required
- **Cluster access**: Immediate upon registration
- **Projects**: 5 projects immediately available
- **Usage tracking**: For reporting only, not billing
- **Database**: `billing_mode = 'prepaid'`

#### Postpaid (SaaS/Self-Service)
- **Registration**: Standard signup flow.
- **Payment**: Credit card via Stripe (required for cluster access).
- **First login flow**:
  - Auth0 webhook creates Stripe customer if missing.
  - User is redirected to Stripe Checkout when no payment method is present.
  - Stripe webhook provisions/updates the metered subscription once Checkout completes.
- **Cluster access**: Health checks assign a cluster only after billing is verified.
- **Projects**: 5 projects available immediately after assignment.
- **Usage tracking**: `/api/billing/sync-stripe` reports daily totals via Stripe Billing Meter Events:
  - `cpu_usage` uses the `usage_daily.total_cost` converted to cents.
  - `storage_usage` uses the average storage GB recorded for the day.
  - `api_calls` currently unused but available for custom metering.
- **Database flags**: `billing_mode = 'postpaid'` (or `NULL` during migration); `stripe_subscription_id` links to the live plan.

## Stripe Integration

### Products and Pricing
We use Stripe's metered billing with the following products:

| Product Type | Product ID | Price ID | Unit Price |
|--------------|------------|----------|------------|
| Compute Credits | prod_SyouWf2n0ZTrgl | price_1S2rGbBVhabmeSATRqsYZHUm | $0.35/credit |
| Online Storage | prod_SyowZZ5KSoxZZR | price_1S2rINBVhabmeSATVcqyroBz | $0.50/GB-month |
| Offline Storage | prod_SyoxUy6KrEirtL | price_1S2rJLBVhabmeSATjpqLQgIn | $0.03/GB-month |

### Webhook Configuration
- Endpoint: `https://run.hopsworks.ai/api/webhooks/stripe`
- Events monitored:
  - `checkout.session.completed`
  - `customer.subscription.created/updated/deleted`
  - `invoice.payment_succeeded/failed`

## Data Flow

### 1. Usage Collection (Hourly)
```typescript
import { calculateCreditsUsed, calculateDollarAmount } from '@/config/billing-rates';

// OpenCost provides usage metrics per namespace
const allocation = {
  namespace: 'mlproject',
  cpuCoreHours: 24.5,
  gpuHours: 0,
  ramByteHours: 137_438_953_472
};

// Convert RAM byte-hours to GB-hours
const ramGbHours = allocation.ramByteHours / (1024 ** 3);

// Convert usage into credits and then USD
const creditsUsed = calculateCreditsUsed({
  cpuHours: allocation.cpuCoreHours,
  gpuHours: allocation.gpuHours,
  ramGbHours
});

const hourlyTotalCost = calculateDollarAmount(creditsUsed); // -> $4.29
```

### 2. Cost Storage
```sql
-- usage_daily table stores both usage and calculated costs
opencost_cpu_hours: 24.5        -- Usage from OpenCost
opencost_gpu_hours: 0
opencost_ram_gb_hours: 128
 total_cost: 4.29                -- Our calculated cost
```

### 3. Billing

**Prepaid Users:**
- See costs in dashboard
- Receive monthly usage reports
- Pay via invoice

**Postpaid Users:**
- Usage reported to Stripe daily
- Stripe calculates final invoice
- Automatic payment processing

## Database Schema

### usage_daily
Stores daily usage and costs:
```sql
-- Usage metrics (from OpenCost)
opencost_cpu_hours DECIMAL(10,4)
opencost_gpu_hours DECIMAL(10,4)  
opencost_ram_gb_hours DECIMAL(10,4)

-- Storage metrics
online_storage_gb DECIMAL(10,4)
offline_storage_gb DECIMAL(10,4)

-- Calculated costs (our pricing)
total_cost DECIMAL(10,2)

-- Project breakdown
project_breakdown JSONB  -- Per-project usage details
```

### user_credits (Legacy Prepaid)
```sql
total_purchased DECIMAL(10,2)   -- Credits purchased
total_used DECIMAL(10,2)        -- Credits consumed
```

## API Endpoints

### User Facing
- `GET /api/billing` – Billing overview, Stripe invoices, rate card.
- `GET /api/usage` – Current-month usage totals and project breakdown.

### Internal / Cron
- `POST|GET /api/usage/collect-opencost` – Hourly OpenCost ingestion.
- `POST|GET /api/billing/sync-stripe` – Daily Stripe Meter Events sync.

### Admin
- `GET /api/admin/users` – Usage totals by user (with project breakdown).
- `GET /api/admin/usage/check-opencost` – Validate OpenCost connectivity.
- `GET /api/admin/usage/check-database` – Validate recent usage rows.
- `POST /api/admin/usage/collect` – Manual ingestion trigger.

## Stripe Integration (Postpaid Only)

### Setup
1. Create metered products in Stripe Dashboard
2. Set price IDs in environment variables
3. Configure webhook endpoint

### Daily Reporting
```javascript
// Report usage to Stripe for billing
await stripe.billing.meterEvents.create({
  event_name: 'cpu_usage',
  payload: {
    value: cpuHours,
    stripe_customer_id: customerId
  }
});
```

### Webhook Events
- `customer.subscription.created` - New subscription
- `invoice.payment_succeeded` - Payment received
- `invoice.payment_failed` - Payment failed

## Implementation Files

### Core Files
- `src/config/billing-rates.ts` - Pricing configuration
- `src/pages/api/usage/collect-opencost.ts` - Usage collection
- `src/pages/api/billing/sync-stripe.ts` - Stripe usage reporting
- `src/pages/api/billing.ts` - User billing API
- `src/pages/api/pricing.ts` - Public pricing snapshot used on marketing pages

### Admin Files
- `src/pages/admin47392.tsx` - Admin dashboard
- `src/pages/api/admin/users.ts` - User management
- `src/pages/api/admin/usage/*` - Usage health checks and manual triggers

## Cron Jobs

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/usage/collect-opencost",
      "schedule": "0 * * * *"  // Every hour
    },
    {
      "path": "/api/billing/sync-stripe",
      "schedule": "0 3 * * *"   // Daily at 3 AM
    }
  ]
}
```

## Environment Variables

```bash
# Stripe (postpaid only)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CPU_HOURS=price_...
STRIPE_PRICE_GPU_HOURS=price_...
STRIPE_PRICE_RAM_GB_HOURS=price_...
STRIPE_PRICE_STORAGE_ONLINE=price_...
STRIPE_PRICE_STORAGE_OFFLINE=price_...
STRIPE_PRICE_NETWORK_EGRESS=price_...

# Auth0 webhook secret (verifies Auth0 Action calls)
AUTH0_WEBHOOK_SECRET=super-secure-string

# Corporate onboarding (HubSpot)
HUBSPOT_API_KEY=pat-...

# Team invites (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=no-reply@example.com

# Cron authentication
CRON_SECRET=...
```

## Admin Features

Access at `/admin47392`:

### Billing Overview
- View all users with total PAYG amounts
- Today's costs per user
- Expandable project breakdown
- Shows usage (CPU/GPU/RAM hours) and costs

### Manual Actions
- "Update Usage Data" - Trigger collection manually
- View collection results and errors

## SQL Queries

```sql
-- User's current month cost
SELECT 
  SUM(total_cost) as month_total
FROM usage_daily
WHERE user_id = 'auth0|123'
AND date >= date_trunc('month', CURRENT_DATE);

-- Project breakdown for today
SELECT 
  project_breakdown
FROM usage_daily
WHERE user_id = 'auth0|123'
AND date = CURRENT_DATE;

-- Prepaid balance
SELECT 
  total_purchased - total_used as balance
FROM user_credits
WHERE user_id = 'auth0|123';
```

## Testing

### Test Prepaid Billing
1. Set user to `billing_mode: 'prepaid'`
2. Run usage collection
3. Verify costs appear but no Stripe activity

### Test Postpaid Billing
1. Set user to `billing_mode: 'postpaid'`
2. Ensure Stripe subscription exists
3. Run usage collection
4. Run Stripe reporting
5. Check Stripe dashboard for usage records

## Migration Notes

### From Old System
- Legacy fields removed from `usage_daily`
- OpenCost no longer stores costs, only usage
- Pricing now in `billing-rates.ts`
- Views updated to use new fields

### Backward Compatibility
- `total_cost` field maintained for display
- Old data remains readable
- Gradual migration possible
