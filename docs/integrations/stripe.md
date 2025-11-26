# Stripe Integration

## Live Mode Setup

### 1. Create Products

In Stripe Dashboard, create these products with prices:

| Product | Price | Type |
|---------|-------|------|
| CPU Hour | $0.10 | Usage-based |
| GPU Hour | $2.00 | Usage-based |
| Storage GB-Month | $0.15 | Usage-based |
| API Calls | $0.01 per 1000 | Usage-based |
| Credits | $1.00 | One-time |

### 2. Configure Webhook

1. Add endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
2. Select events:
   - `checkout.session.completed` - payment setup complete, creates subscription
   - `customer.subscription.created` - subscription created (syncs to DB, assigns cluster)
   - `customer.subscription.updated` - subscription status changes
   - `customer.subscription.deleted` - subscription canceled, suspends user
   - `invoice.payment_succeeded` - invoice paid
   - `invoice.payment_failed` - payment failed
   - `payment_method.attached` - new payment method added (reactivates suspended users)
   - `payment_method.detached` - payment method removed (may suspend user)
3. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Subscription Flow

**IMPORTANT**: Subscriptions are created ONLY in `checkout.session.completed` handler to prevent race conditions.

1. User completes Stripe Checkout (payment method setup)
2. `checkout.session.completed` webhook fires
3. Handler creates metered subscription with all products from `stripe_products` table
4. Updates user's `stripe_subscription_id` in DB
5. `customer.subscription.created` webhook fires
6. Handler verifies subscription in DB, assigns cluster if needed

The `payment_method.attached` handler does NOT create subscriptions - it only syncs existing ones and reactivates suspended users.

### 3. Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID_CPU_HOUR=price_...
STRIPE_PRICE_ID_GPU_HOUR=price_...
STRIPE_PRICE_ID_STORAGE_GB_MONTH=price_...
STRIPE_PRICE_ID_API_CALLS=price_...
STRIPE_PRICE_ID_CREDIT=price_...
```

## Test Mode Setup

### Test Credentials

```bash
STRIPE_TEST_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_PRODUCT_ID=prod_...
```

### Test Endpoints

- Webhook: `https://your-domain.vercel.app/api/webhooks/stripe-test`
- Admin API: `/api/admin/billing-test`

### Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

### Admin Testing

Access test billing at `/admin47392` → Test Billing tab

Features:
- Create test purchases for any user
- View test credits and subscriptions
- Test webhook processing
- No real charges occur

## Testing Locally

```bash
# Listen to webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Make test purchase through /account page
```

## Monthly Billing Process

Automated via cron job on 1st of each month:
1. Aggregates usage from database
2. Creates invoice items for each user
3. Stripe finalizes and charges invoices

## Related

- [Billing System](../features/billing.md)
- [Environment Variables](../.env.example)
