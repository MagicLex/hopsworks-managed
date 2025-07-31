# Stripe Setup Guide

## Quick Setup

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
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
3. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### 3. Set Environment Variables

Add to Vercel:
```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_PRICE_ID_CPU_HOUR=price_...
STRIPE_PRICE_ID_GPU_HOUR=price_...
STRIPE_PRICE_ID_STORAGE_GB_MONTH=price_...
STRIPE_PRICE_ID_API_CALLS=price_...
STRIPE_PRICE_ID_CREDIT=price_...
```

## Testing

1. Use Stripe test mode
2. Test webhook with Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. Make test purchase through `/account` page

## Monthly Billing Process

Automated via cron job on 1st of each month:
1. Aggregates usage from database
2. Creates invoice items for each user
3. Stripe finalizes and charges invoices

## Related Documentation

- [Billing System Overview](billing.md)
- [Environment Variables](.env.example)