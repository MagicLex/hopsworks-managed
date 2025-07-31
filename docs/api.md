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

### GET /api/user
Get current user information including Hopsworks details.

**Response:**
```json
{
  "user": {
    "id": "auth0|...",
    "email": "user@example.com",
    "hopsworks_username": "user123",
    "hopsworks_cluster": {
      "name": "cluster1",
      "api_url": "https://..."
    }
  }
}
```

### GET /api/usage
Get user's current usage and billing information.

**Response:**
```json
{
  "currentUsage": {
    "cpuHours": 120.5,
    "gpuHours": 0,
    "storageGB": 50.2,
    "totalCost": 25.50
  },
  "credits": {
    "balance": 100.00,
    "total_purchased": 150.00,
    "total_used": 50.00
  },
  "billingMode": "postpaid"
}
```

### POST /api/credits/purchase
Purchase credits (redirects to Stripe).

**Request:**
```json
{
  "amount": 100
}
```

## Admin Endpoints

### GET /api/admin/users
Get all users with their assignments and usage.

**Response:**
```json
{
  "users": [{
    "id": "auth0|...",
    "email": "user@example.com",
    "is_admin": false,
    "user_credits": {
      "total_purchased": 100,
      "total_used": 25
    },
    "user_hopsworks_assignments": [{
      "hopsworks_cluster_id": "uuid",
      "hopsworks_username": "user123"
    }]
  }]
}
```

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

### POST /api/admin/test-hopsworks
Test Hopsworks connection and get Kubernetes metrics.

**Request:**
```json
{
  "userId": "auth0|...",
  "clusterId": "uuid"
}
```

### POST /api/admin/usage/collect
Manually trigger usage collection for all users.

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
- Creates user in database
- Assigns to Hopsworks cluster
- Creates Hopsworks user and project

### POST /api/webhooks/stripe
Handles Stripe webhook events:
- `checkout.session.completed`: Credit purchases
- `invoice.payment_succeeded`: Usage charges

## Cron Endpoints

### GET /api/cron/collect-k8s-metrics
Collects Kubernetes metrics for all clusters.
- Runs every 15 minutes
- Requires `CRON_SECRET` header

### GET /api/cron/charge-users
Processes monthly billing for postpaid users.
- Runs on 1st of each month
- Creates Stripe invoices

## Hopsworks Integration

The API integrates with Hopsworks through these functions:

```typescript
// Create OAuth user in Hopsworks
createHopsworksOAuthUser(credentials, auth0Id, email)

// Create project for user
createHopsworksProject(credentials, auth0Id, projectName)

// Get user's projects
getUserProjects(credentials, auth0Id)

// Get project usage (not fully implemented by Hopsworks)
getProjectUsage(credentials, projectId, date)
```

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
- `403`: Forbidden (not admin)
- `404`: Not found
- `500`: Server error

## Rate Limiting

Currently no rate limiting implemented. In production, consider:
- Auth0 rate limits
- Stripe API limits
- Kubernetes API limits

## Related Documentation

- [Architecture Overview](architecture.md)
- [Database Patterns](database.md)
- [Billing System](billing.md)