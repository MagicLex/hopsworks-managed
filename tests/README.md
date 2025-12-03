# Tests

## Quick Start

```bash
npm run test           # Run all tests
npm run test:watch     # Re-run on file changes
npm run test:coverage  # Run with V8 coverage report
```

## Structure

```
tests/
├── regression/                      # Unit tests (no DB needed)
│   ├── billing.test.ts              # Billing rate calculations
│   ├── usage-collection.test.ts     # Usage collection & attribution
│   ├── cluster-assignment.test.ts   # Cluster selection, payment gates
│   └── invite-validation.test.ts    # Invite request validation
│
└── integration/                     # Integration tests (needs local Supabase)
    ├── helpers/test-db.ts           # DB seeding utilities
    └── user-cascade.test.ts         # Owner suspend → team cascade
```

## What's tested

**Business logic that matters:**
- Cluster selection by capacity (if broken → users on full clusters)
- `maxNumProjects` calculation (if broken → billing issues)
- Payment gate for auto-assignment (if broken → free access)
- Invite validation (if broken → invalid invites created)
- Billing rates (if broken → wrong invoices)

**Not tested** (by design):
- Trivial one-liners (`email.trim()`, `=== null`)
- Constants

---

## Integration Tests

Tests real DB operations (suspend owner → team cascade, etc.)

### Setup

```bash
# 1. Start local Supabase
supabase start

# 2. Copy the service_role key from output to .env.test
cp .env.test.example .env.test
# Edit .env.test with your service_role key

# 3. Run integration tests
npm run test:integration
```

### What's tested

- `user-cascade.test.ts`: Suspend/reactivate owner cascades to team members

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
