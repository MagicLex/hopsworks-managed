# User Lifecycle Events

## Overview

This document describes all user status transitions in the system, what triggers them, and the cascade effects on related users (team members).

## User States

| State | Description | Can Login | Hopsworks Access |
|-------|-------------|-----------|------------------|
| `active` | Normal operating state | Yes | Yes |
| `suspended` | Temporarily blocked (billing issue) | Yes (sees suspension notice) | No (status=3) |
| `deleted` | Soft deleted | No (403) | No (status=3) |

## State Transitions

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌──────────┐    ┌────────┐    ┌───────────┐    ┌─────────┴─┐
│  signup  │───▶│ active │───▶│ suspended │───▶│  deleted  │
└──────────┘    └────────┘    └───────────┘    └───────────┘
                    ▲              │
                    │              │
                    └──────────────┘
                    (reactivation)
```

## Events Reference

### 1. Team Member Removal

**Trigger:** `DELETE /api/team/members?memberId=X`

**File:** `src/pages/api/team/members.ts`

**What happens:**
1. `account_owner_id` set to `null` (user becomes standalone)
2. `suspendUser()` called with reason `removed_from_team`
3. User status → `suspended` in Supabase
4. Hopsworks user status → `3` (DEACTIVATED_ACCOUNT)

**Cascade:** None (team members have no dependents)

**Recovery:** User must set up their own billing to get cluster access again.

---

### 2. Owner Suspension (Payment Issues)

**Triggers:**
- `payment_method.detached` webhook (last payment method removed)
- `customer.subscription.deleted` webhook (subscription cancelled)

**File:** `src/pages/api/webhooks/stripe.ts` → `src/lib/user-status.ts`

**What happens:**
1. Owner status → `suspended`
2. Owner Hopsworks status → `3` (DEACTIVATED_ACCOUNT)
3. **All team members** also suspended (cascade)
4. Each team member's Hopsworks status → `3`

**Cascade:** Yes - all users with `account_owner_id = owner.id` are suspended.

**Reason logged:** `owner_suspended:payment_method_removed` or `owner_suspended:subscription_deleted`

---

### 3. Owner Reactivation

**Triggers:**
- `payment_method.attached` webhook (new payment method added)
- `checkout.session.completed` webhook (payment setup completed)

**File:** `src/pages/api/webhooks/stripe.ts` → `src/lib/user-status.ts`

**What happens:**
1. Owner status → `active`
2. Owner Hopsworks status → `2` (ACTIVATED_ACCOUNT)
3. **All suspended team members** also reactivated (cascade)
4. Each team member's Hopsworks status → `2`

**Cascade:** Yes - only team members with `status = 'suspended'` are reactivated.

**Reason logged:** `owner_reactivated:payment_method_attached` or `owner_reactivated:payment_method_setup`

---

### 4. Account Deletion (Self-Service)

**Trigger:** `DELETE /api/account/delete`

**File:** `src/pages/api/account/delete.ts` → `src/lib/user-status.ts`

**Prerequisites:**
- User must be account owner (`account_owner_id = null`)
- Must have no team members

**What happens:**
1. `deactivateUser()` called
2. Status → `deleted`
3. `deleted_at` timestamp set
4. Hopsworks status → `3` (DEACTIVATED_ACCOUNT)
5. Login blocked in `sync-user.ts`

**Cascade:** None (blocked if team members exist)

---

### 5. Team Invite Acceptance

**Trigger:** `POST /api/team/join`

**File:** `src/pages/api/team/join.ts`

**What happens:**
1. User's `account_owner_id` set to owner's ID
2. Status → `active`
3. `assignUserToCluster()` called (same cluster as owner)
4. Hopsworks OAuth user created with `maxNumProjects: 0`
5. Auto-added to owner's projects if `autoAssignProjects: true`

**Cascade:** None

---

### 6. Payment Failed

**Trigger:** `invoice.payment_failed` webhook

**File:** `src/pages/api/webhooks/stripe.ts`

**What happens:**
- Currently: Logged only, no automatic suspension
- User remains active until subscription is actually cancelled by Stripe

**TODO:** Consider suspension after N failed payment attempts.

---

### 7. Subscription Cancelled

**Trigger:** `customer.subscription.deleted` webhook

**File:** `src/pages/api/webhooks/stripe.ts`

**What happens:**
1. `stripe_subscription_status` → `canceled`
2. `suspendUser()` called with reason `subscription_deleted`
3. Owner and all team members suspended (cascade)

---

## Suspension Reasons

Reasons are logged for traceability:

| Reason | Description |
|--------|-------------|
| `payment_method_removed` | Last payment method detached from Stripe |
| `subscription_deleted` | Stripe subscription cancelled |
| `removed_from_team` | Team member removed by owner |
| `owner_suspended:*` | Team member suspended because owner was suspended |

## Reactivation Reasons

| Reason | Description |
|--------|-------------|
| `payment_method_setup` | Payment method added via checkout session |
| `payment_method_attached` | Payment method directly attached to customer |
| `owner_reactivated:*` | Team member reactivated because owner was reactivated |

## Implementation Details

### suspendUser() - `src/lib/user-status.ts`

```typescript
// 1. Update user status in Supabase
UPDATE users SET status = 'suspended' WHERE id = userId

// 2. Deactivate in Hopsworks (status 3)
PUT /hopsworks-api/admin/users/{hopsworksUserId}
{ "status": 3 }

// 3. If user is account owner, cascade to team members
IF account_owner_id IS NULL:
  FOR EACH member WHERE account_owner_id = userId:
    suspendUser(member.id, 'owner_suspended:' + reason)
```

### reactivateUser() - `src/lib/user-status.ts`

```typescript
// 1. Update user status in Supabase
UPDATE users SET status = 'active' WHERE id = userId

// 2. Reactivate in Hopsworks (status 2)
PUT /hopsworks-api/admin/users/{hopsworksUserId}
{ "status": 2 }

// 3. If user is account owner, cascade to suspended team members
IF account_owner_id IS NULL:
  FOR EACH member WHERE account_owner_id = userId AND status = 'suspended':
    reactivateUser(member.id, 'owner_reactivated:' + reason)
```

## Hopsworks User Statuses

| Status | Value | Description |
|--------|-------|-------------|
| NEW_MOBILE_ACCOUNT | 0 | Initial state (unused in our flow) |
| VERIFIED_ACCOUNT | 1 | Email verified (unused in our flow) |
| ACTIVATED_ACCOUNT | 2 | Active, can use cluster |
| DEACTIVATED_ACCOUNT | 3 | Blocked, cannot use cluster |
| BLOCKED_ACCOUNT | 4 | Permanently blocked (unused) |
| LOST_MOBILE | 5 | Lost device (unused) |
| SPAM_ACCOUNT | 6 | Spam (unused) |

## Monitoring Queries

### Users by status
```sql
SELECT status, COUNT(*)
FROM users
WHERE deleted_at IS NULL
GROUP BY status;
```

### Suspended team members
```sql
SELECT
  u.email as member_email,
  owner.email as owner_email,
  u.status,
  u.updated_at
FROM users u
JOIN users owner ON owner.id = u.account_owner_id
WHERE u.status = 'suspended'
ORDER BY u.updated_at DESC;
```

### Recent status changes (from logs)
```bash
# In Vercel logs, search for:
[suspendUser]
[reactivateUser]
[deactivateUser]
```
