# Admin API Documentation

The admin API provides endpoints for Hopsworks integration and system management. All endpoints require admin authentication.

## Authentication

All admin endpoints check for `is_admin = true` on the user record. Access is restricted via the `requireAdmin` middleware.

## Endpoints

### 1. User Search
Search users by various criteria.

```
GET /api/admin/users/search?oauth_subject={auth0_id}
GET /api/admin/users/search?email={email}
GET /api/admin/users/search?project_id={hopsworks_username}
```

**Response:**
```json
{
  "users": [{
    "id": "auth0|123",
    "email": "user@example.com",
    "name": "John Doe",
    "hopsworksUsername": "john_doe_hopsworks",
    "cluster": {
      "id": "uuid",
      "name": "demo.hops.works",
      "api_url": "https://demo.hops.works"
    },
    "billingMode": "postpaid",
    "creditBalance": 50.00,
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-15T10:30:00Z"
  }],
  "count": 1
}
```

### 2. User Usage Data
Get usage data for a specific user.

```
GET /api/admin/usage/{userId}?date={YYYY-MM-DD}
GET /api/admin/usage/{userId}  # Monthly summary
```

**Daily Usage Response:**
```json
{
  "usage": {
    "date": "2024-01-15",
    "compute": {
      "instances": [{
        "type": "m5.xlarge",
        "hours": 24,
        "cpuHours": 96,
        "gpuHours": 0
      }]
    },
    "storage": {
      "featureStore": 0,
      "models": 0,
      "datasets": 0,
      "total": 100
    },
    "apiCalls": {
      "featureStore": 5000,
      "modelServing": 1000,
      "jobs": 0,
      "total": 6000
    }
  }
}
```

**Monthly Summary Response:**
```json
{
  "userId": "auth0|123",
  "month": "2024-01",
  "usage": {
    "cpuHours": 2400,
    "gpuHours": 0,
    "storageGB": 100,
    "apiCalls": 180000,
    "featureStoreCalls": 150000,
    "inferenceCalls": 30000,
    "totalCost": 250.00
  },
  "dailyUsage": [...]
}
```

### 3. Billing Management
Manage user billing settings.

```
POST /api/admin/billing
```

**Enable Prepaid:**
```json
{
  "action": "enable_prepaid",
  "userId": "auth0|123"
}
```

**Grant Credits:**
```json
{
  "action": "grant_credits",
  "userId": "auth0|123",
  "data": {
    "amount": 100.00,
    "reason": "Special promotion"
  }
}
```

**Set Custom Pricing:**
```json
{
  "action": "set_pricing_override",
  "userId": "auth0|123",
  "data": {
    "resourceType": "cpu_hours",
    "overridePrice": 0.05,
    "discountPercentage": 50,
    "validUntil": "2024-12-31",
    "reason": "Enterprise agreement"
  }
}
```

### 4. Cluster Management
Manage Hopsworks clusters.

```
GET /api/admin/clusters
POST /api/admin/clusters
PUT /api/admin/clusters/{id}
DELETE /api/admin/clusters/{id}
```

### 5. User Management
Manage users and cluster assignments.

```
GET /api/admin/users
POST /api/admin/users  # Assign user to cluster
DELETE /api/admin/users  # Remove user from cluster
```

## Usage for Hopsworks Integration

Hopsworks can use these endpoints to:

1. **Find users by OAuth subject**: 
   ```
   GET /api/admin/users/search?oauth_subject=auth0|123
   ```

2. **Get daily usage for billing**:
   ```
   GET /api/admin/usage/auth0|123?date=2024-01-15
   ```

3. **Push usage data** (alternative approach):
   Instead of Hopsworks calling our admin API, we pull from Hopsworks during the cron job.

## Security

- All endpoints require admin authentication
- Rate limiting should be implemented for production
- Consider IP whitelisting for Hopsworks servers
- Use API keys for service-to-service communication