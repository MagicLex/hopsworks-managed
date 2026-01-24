# Slack Integration

## Overview

Slack receives real-time notifications when API errors occur in production. Errors are sent via incoming webhook - fire-and-forget, non-blocking.

## Environment Variables

| Name                 | Purpose                              |
|----------------------|--------------------------------------|
| `SLACK_WEBHOOK_URL`  | Incoming webhook URL from Slack app  |

## Monitored Endpoints

| Endpoint                        | Triggers                                      |
|---------------------------------|-----------------------------------------------|
| `/api/auth/sync-user`           | Signup, login, health check failures          |
| `/api/team/join`                | Team member join errors                       |
| `/api/team/invite`              | Invite creation/listing/deletion errors       |
| `/api/webhooks/stripe`          | Stripe event processing failures              |
| `/api/admin/clusters`           | Cluster management errors                     |
| `/api/billing/sync-stripe`      | Usage sync failures                           |
| `/api/cron/check-data-integrity`| Daily digest + data integrity alerts          |

## Message Types

### API Errors
```
:rotating_light: *API Error* in `POST /api/auth/sync-user`
```error message + stack trace (truncated to 2000 chars)```
```

### Billing Failures
```
:credit_card: :x: *Billing Failure*
• *Action:* `create_subscription`
• *User:* user@example.com
• *Error:* Stripe error message
```

### Data Integrity Alerts
```
:warning: *Data Integrity Alert*
0 critical, 1 high severity issues found
• *HIGH* `subscription_desync`: 2 affected
  user1@example.com, user2@example.com
```

### Daily Digest
```
:chart_with_upwards_trend: *Daily SaaS Report* - 2026-01-24
*Users* Total: 173 (91 active)
*Growth* New today: 2
*Health* :white_check_mark: All systems healthy
```

## Setup

1. Create a Slack app at https://api.slack.com/apps
2. Enable **Incoming Webhooks**
3. Add webhook to desired channel
4. Copy webhook URL to Vercel env vars as `SLACK_WEBHOOK_URL`

## Implementation

### API Errors
`handleApiError()` in `src/lib/error-handler.ts`:
- Logs to console (all environments)
- Sends to Slack (production only)
- Returns appropriate HTTP status to client

### Billing Failures
`alertBillingFailure()` in `src/lib/error-handler.ts`:
- Sends Slack alert for billing-specific failures
- Includes action, user email, error message, and optional details
- Used in Stripe webhooks and sync crons

### Data Integrity
`check-data-integrity.ts` cron:
- Runs daily at 6:00 UTC
- Sends daily digest with user stats and health status
- Alerts immediately for critical/high severity issues

## Operations

- Webhook URL is the secret - treat it like a password
- Rotate by creating new webhook in Slack and updating Vercel env var
- If webhook is compromised, delete it in Slack immediately
