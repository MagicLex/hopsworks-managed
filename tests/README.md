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
│   ├── billing.test.ts              # Billing calculations (credits, dollars)
│   ├── cluster-assignment.test.ts   # Cluster selection, payment gates
│   └── invite-validation.test.ts    # Invite request validation
│
└── integration/                     # Integration tests (needs local Supabase)
    ├── helpers/test-db.ts           # DB seeding utilities
    ├── user-cascade.test.ts         # Owner suspend → team cascade
    └── cluster-capacity.test.ts     # Cluster capacity tracking, assignments
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
- `cluster-capacity.test.ts`: RPC functions, cluster selection queries, assignment constraints

---

## Stripe Webhook Testing

We test webhooks with Stripe CLI, not mocks.

### Current State

**Production mode only** - The codebase uses `STRIPE_SECRET_KEY` (live) everywhere.

Test mode infrastructure exists (`stripe-config.ts` has `createStripeClient(isTestMode)`), but is not wired up. All API routes directly instantiate Stripe with the live key.

To test with 4242 card, you'd need to:
1. Temporarily swap `STRIPE_SECRET_KEY` to `STRIPE_TEST_SECRET_KEY` in `.env.local`
2. Also swap webhook secret and price IDs
3. Restart the server

For now, we test in production with real (small) transactions.

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

## E2E Manual Testing Checklist

Before major releases, manually test these critical flows:

### New User Onboarding
- [ ] Sign up via Auth0 → user created in Supabase
- [ ] Redirected to billing setup page
- [ ] Add payment method → cluster assigned
- [ ] Can access Hopsworks UI

### Team Management
- [ ] Owner invites team member (valid email)
- [ ] Invite email received
- [ ] Team member accepts invite → linked to owner
- [ ] Team member assigned to same cluster as owner
- [ ] Team member can access owner's projects

### Payment & Suspension
- [ ] Remove payment method → user suspended
- [ ] Owner suspended → all team members suspended
- [ ] Add payment method back → owner reactivated
- [ ] Team members also reactivated

### Edge Cases
- [ ] Invite expired user → shows error
- [ ] Invite already-registered user → shows error
- [ ] Try to access when suspended → blocked

### Stripe Webhooks (via CLI)
```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
stripe trigger payment_method.detached
```

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
