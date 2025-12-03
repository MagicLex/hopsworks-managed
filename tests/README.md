# Tests

## Quick Start

```bash
npm run test          # Run all tests
npm run test:watch    # Re-run on file changes
```

## Structure

```
tests/
└── regression/
    └── billing.test.ts   # Billing calculations (if wrong = wrong invoices)
```

---

## Stripe Webhook Testing

We test webhooks with Stripe CLI, not mocks.

### Setup (once)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login (opens browser)
stripe login
```

### Testing webhooks

```bash
# Terminal 1 - Start the server
npm run dev

# Terminal 2 - Forward Stripe webhooks to localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Note: copy the webhook signing secret shown (whsec_xxx)
# Add to .env.local: STRIPE_WEBHOOK_SECRET=whsec_xxx

# Terminal 3 - Trigger events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger customer.subscription.deleted
stripe trigger payment_method.attached
stripe trigger payment_method.detached
stripe trigger invoice.payment_failed
```

### Verify it works

1. Check logs in Terminal 1 (the server)
2. Check the DB to see if user state changed:

```bash
# Example: verify a user was suspended
psql $DATABASE_URL -c "SELECT id, email, status FROM users WHERE email = 'test@example.com'"
```

### Critical events to test

| Event | Expected behavior |
|-------|-------------------|
| `checkout.session.completed` | Reactivate if suspended, create subscription, assign cluster |
| `customer.subscription.deleted` | Suspend user (postpaid only) |
| `payment_method.detached` | Suspend if no payment methods left (postpaid only) |

---

## Adding regression tests

When you fix a bug:

1. Write a test that reproduces the bug
2. Fix the bug
3. Test now passes
4. Bug can never come back

```typescript
// Example: bug where empty usage returned NaN
it('returns 0 for empty usage, not NaN', () => {
  expect(calculateCreditsUsed({})).toBe(0)
})
```
