# API Reference

## Authentication

### User Authentication (Auth0)
All user endpoints require Auth0 authentication:
```typescript
import { withApiAuthRequired } from '@auth0/nextjs-auth0';

export default withApiAuthRequired(async function handler(req, res) {
  // Handler code
});
```

### Admin Authentication
Admin endpoints require additional checks:
```typescript
import { requireAdmin } from '@/middleware/adminAuth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, async (req, res) => {
    // Admin-only handler code
  });
}
```

## User Endpoints

### GET /api/user/hopsworks-info
Get current user's Hopsworks information.

**Response:**
```json
{
  "hasCluster": true,
  "clusterName": "cluster1",
  "hasHopsworksUser": true,
  "hopsworksUser": {
    "username": "user123",
    "email": "user@example.com",
    "accountType": "MEMBER_ACCOUNT",
    "status": 2,
    "maxNumProjects": 20,
    "numActiveProjects": 2
  },
  "projects": [{
    "id": 123,
    "name": "MyProject",
    "owner": "user123",
    "created": "2024-01-01T00:00:00.000Z"
  }]
}
```

### GET /api/usage
Get user's current usage from OpenCost.

**Response:**
```json
{
  "currentMonth": {
    "opencostTotalCost": 45.67,
    "opencostCpuCost": 30.45,
    "opencostRamCost": 12.22,
    "opencostStorageCost": 3.00,
    "projects": [
      {
        "namespace": "mlproject",
        "name": "ML Training",
        "totalCost": 25.50,
        "cpuHours": 120.5,
        "ramGBHours": 2048.0
      }
    ]
  },
  "dailyCosts": [
    {
      "date": "2024-01-08",
      "opencost_total_cost": 1.78,
      "project_breakdown": {
        "mlproject": {
          "totalCost": 1.78
        }
      }
    }
  ]
}
```

### GET /api/billing
Get billing information (account owners only).

**Response:**
```json
{
  "billingMode": "postpaid",
  "hasPaymentMethod": true,
  "paymentMethodDetails": {
    "type": "card",
    "card": {
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2025
    }
  },
  "subscriptionStatus": null,
  "prepaidEnabled": false,
  "currentUsage": {
    "cpuHours": "120.50",
    "storageGB": "0.00",
    "currentMonth": {
      "cpuCost": 12.05,
      "storageCost": 0,
      "total": 12.05
    }
  },
  "creditBalance": null,
  "invoices": []
}
```

### POST /api/billing/purchase-credits
Purchase credits (redirects to Stripe).

**Request:**
```json
{
  "amount": 100
}
```

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

## Team Management Endpoints

### GET /api/team/members
Get team members.

**Response:**
```json
{
  "account_owner": {
    "id": "auth0|...",
    "email": "owner@example.com",
    "name": "Owner Name"
  },
  "team_members": [{
    "id": "auth0|...",
    "email": "member@example.com",
    "name": "Member Name",
    "created_at": "2024-01-01T00:00:00.000Z",
    "hopsworks_username": "member123"
  }],
  "is_owner": true
}
```

### POST /api/team/invite
Invite a team member.

**Request:**
```json
{
  "email": "newmember@example.com"
}
```

**Response:**
```json
{
  "message": "Invite sent successfully",
  "invite": {
    "id": "uuid",
    "email": "newmember@example.com",
    "expires_at": "2024-01-08T00:00:00.000Z",
    "invite_url": "https://your-domain/team/accept-invite?token=..."
  }
}
```

### GET /api/team/accept-invite
Get invite details by token.

**Query Parameters:**
- `token` - Invite token

**Response:**
```json
{
  "email": "invited@example.com",
  "invitedBy": "owner@example.com",
  "expiresAt": "2024-01-08T00:00:00.000Z",
  "loginUrl": "/api/auth/login?returnTo=..."
}
```

## Admin Endpoints

### GET /api/admin/users
Get all users with their assignments and usage.

### GET /api/admin/clusters
Get all Hopsworks clusters.

### POST /api/admin/clusters
Create a new cluster.

**Request:**
```json
{
  "name": "New Cluster",
  "api_url": "https://hopsworks.example.com:28181",
  "api_key": "api-key-here",
  "max_users": 100
}
```

### PUT /api/admin/clusters/update-kubeconfig
Update cluster's kubeconfig.

**Request:**
```json
{
  "clusterId": "uuid",
  "kubeconfig": "base64-encoded-kubeconfig"
}
```

### POST /api/admin/test-hopsworks
Test Hopsworks connection and get user info.

**Request:**
```json
{
  "userId": "auth0|...",
  "clusterId": "uuid"
}
```


**Response:**
```json
{
  "message": "OpenCost metrics collection completed",
  "timestamp": "2024-01-08",
  "hour": 14,
  "results": {
    "successful": 10,
    "failed": 0,
    "totalCost": 123.45,
    "namespaces": [
      {
        "namespace": "mlproject",
        "projectName": "ML Training",
        "userId": "auth0|123",
        "cost": 45.67
      }
    ]
  }
}
```

### GET /api/admin/usage/[userId]
Get detailed usage metrics for a specific user.

### POST /api/admin/sync-username
Sync Hopsworks username for a user.

**Request:**
```json
{
  "userId": "auth0|..."
}
```

## Webhook Endpoints

### POST /api/webhooks/auth0
Handles Auth0 post-login actions:
- Creates user in database if not exists
- Updates login count and last login time
- Creates Stripe subscription for new account owners (team members excluded)
- Requires `x-auth0-secret` header matching `AUTH0_WEBHOOK_SECRET`

### POST /api/webhooks/stripe
Handles Stripe webhook events:
- `checkout.session.completed`: Credit purchases
- `invoice.payment_succeeded`: Usage charges
- `customer.subscription.created`: Subscription creation
- `customer.subscription.updated`: Subscription updates

## Cron Endpoints

### GET /api/usage/collect-opencost
Collects cost data from OpenCost for all clusters.
- Runs every hour (`:00`)
- Requires `CRON_SECRET` header in production
- Uses Kubernetes API proxy to query OpenCost securely
- Updates `usage_daily` with accumulated costs
- Maps namespaces to users via `user_projects` table

### GET /api/billing/sync-stripe
Syncs OpenCost usage data to Stripe for billing.
- Runs daily at 3 AM
- Uses `opencost_total_cost` from `usage_daily`
- Creates usage records in Stripe for postpaid customers
- Marks records as `reported_to_stripe = true`

## Error Handling

All endpoints return consistent error responses:
```json
{
  "error": "Error message",
  "details": "Additional context (in development)"
}
```

Common status codes:
- `400`: Bad request
- `401`: Unauthorized
- `403`: Forbidden (not admin or team member accessing billing)
- `404`: Not found
- `500`: Server error

## Rate Limiting

Currently no rate limiting implemented. In production, consider:
- Auth0 rate limits
- Stripe API limits
- Kubernetes API limits

## Related Documentation

- [Architecture Overview](architecture.md)
- [Database Documentation](database/)
- [Billing System](billing.md)