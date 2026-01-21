# Marketing Automation Integration

## Overview

The marketing automation stack handles CRM, email sequences, and workflow orchestration for user lifecycle events. All downstream services are triggered via Windmill webhooks.

## Infrastructure

| Service    | URL                  | Purpose                   |
|------------|----------------------|---------------------------|
| Twenty CRM | https://crm.hops.io  | Contact & deal management |
| Mautic     | https://mkt.hops.io  | Email sequences           |
| Windmill   | https://auto.hops.io | Workflow orchestration    |

## Environment Variables

| Name                   | Purpose                              |
|------------------------|--------------------------------------|
| `WINDMILL_WEBHOOK_URL` | Webhook endpoint for user events     |
| `WINDMILL_API_TOKEN`   | Bearer token for Windmill API        |

## Architecture

```
User registers on SaaS
        |
        v
POST to Windmill webhook (fire-and-forget)
        |
        v
Windmill orchestrates:
  -> Creates contact in Twenty CRM
  -> Adds contact to Mautic segment
  -> Triggers email sequence
  -> Notifies Slack (conditional)
```

The SaaS platform sends a single webhook to Windmill. Windmill handles all downstream orchestration. This keeps the SaaS codebase decoupled from marketing tools.

## Events

| Event             | Trigger Location           | Payload                                      |
|-------------------|----------------------------|----------------------------------------------|
| `user.registered` | `sync-user.ts` (new user)  | email, name, plan, source, marketingConsent  |
| `user.upgraded`   | Stripe webhook (future)    | email, previousPlan, newPlan                 |
| `user.churned`    | Account deletion (future)  | email, reason                                |

## Implementation

### Webhook Call (sync-user.ts)

The webhook fires after successful user creation in Supabase, inside the `if (!existingUser)` block:

```typescript
// Fire-and-forget to Windmill - don't block registration
if (process.env.WINDMILL_WEBHOOK_URL) {
  fetch(process.env.WINDMILL_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WINDMILL_API_TOKEN}`
    },
    body: JSON.stringify({
      event: 'user.registered',
      email,
      name: name || null,
      plan: billingMode || 'postpaid',
      source: registrationSource,
      marketingConsent: marketingConsent || false,
      timestamp: new Date().toISOString()
    })
  }).catch(err => console.error('[Marketing] Webhook failed:', err.message));
}
```

### Windmill Endpoint Format

```
POST https://auto.hops.io/api/w/{workspace}/jobs/run/p/{script_path}
Authorization: Bearer {windmill_token}
Content-Type: application/json

{
  "event": "user.registered",
  "email": "user@example.com",
  "name": "John Doe",
  "plan": "postpaid",
  "source": "organic",
  "marketingConsent": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Direct API Access (Reference)

If direct access to CRM/Mautic is needed:

### Twenty CRM
```bash
POST https://crm.hops.io/rest/people
Authorization: Bearer {twenty_api_key}
```

### Mautic
```bash
POST https://mkt.hops.io/api/contacts/new
Authorization: Basic {base64_credentials}
```

## API Keys

1. **Twenty** -> Settings -> API Keys
2. **Mautic** -> Settings -> API Credentials (OAuth2 or Basic Auth)
3. **Windmill** -> User Settings -> Tokens

## Failure Handling

- Webhook failures are logged but don't block user registration
- Windmill should implement retry logic for downstream failures
- Missing env vars skip the webhook silently (logs warning in dev)

## Operations

- Rotate `WINDMILL_API_TOKEN` via Windmill User Settings and update Vercel secrets
- Monitor webhook delivery in Windmill job history
- For manual contact creation, use Twenty/Mautic admin interfaces directly
