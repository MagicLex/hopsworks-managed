# Slack Integration

## Overview

Slack receives real-time notifications when API errors occur in production. Errors are sent via incoming webhook - fire-and-forget, non-blocking.

## Environment Variables

| Name                 | Purpose                              |
|----------------------|--------------------------------------|
| `SLACK_WEBHOOK_URL`  | Incoming webhook URL from Slack app  |

## Monitored Endpoints

| Endpoint                  | Triggers                                      |
|---------------------------|-----------------------------------------------|
| `/api/auth/sync-user`     | Signup, login, health check failures          |
| `/api/team/join`          | Team member join errors                       |
| `/api/team/invite`        | Invite creation/listing/deletion errors       |
| `/api/webhooks/stripe`    | Stripe event processing failures              |
| `/api/admin/clusters`     | Cluster management errors                     |

## Message Format

```
:rotating_light: *API Error* in `POST /api/auth/sync-user`
```error message + stack trace (truncated to 2000 chars)```
```

## Setup

1. Create a Slack app at https://api.slack.com/apps
2. Enable **Incoming Webhooks**
3. Add webhook to desired channel
4. Copy webhook URL to Vercel env vars as `SLACK_WEBHOOK_URL`

## Implementation

Errors are captured via `handleApiError()` in `src/lib/error-handler.ts`. The function:

- Logs to console (all environments)
- Sends to Slack (production only)
- Returns appropriate HTTP status to client

## Operations

- Webhook URL is the secret - treat it like a password
- Rotate by creating new webhook in Slack and updating Vercel env var
- If webhook is compromised, delete it in Slack immediately
