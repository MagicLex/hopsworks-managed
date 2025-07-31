# Stripe Test Mode Setup

## Overview
Admins can test Stripe integration using test mode without real charges.

## Setup Complete

### Test Credentials Configured
- Test Secret Key: `sk_test_...aK6G`
- Test Publishable Key: `pk_test_...lkbt`
- Test Webhook Secret: `whsec_...nGt6`
- Test Product ID: `prod_SlNvLSeuNU2pUj`

### Test Endpoints
- Webhook Endpoint: `https://hopsworks-managed.vercel.app/api/webhooks/stripe-test`
- Admin API: `/api/admin/billing-test`

### Admin Interface
Access test billing at: `/admin47392` → Test Billing tab

### Test Card Numbers
Use these Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

### Features
1. Create test purchases for any user
2. View test credits and subscriptions
3. Test webhook processing
4. No real charges occur

### Next Steps
1. Create price IDs in Stripe test mode for:
   - Unit consumption (linked to prod_SlNvLSeuNU2pUj)
2. Test the checkout flow
3. Verify webhook processing in logs