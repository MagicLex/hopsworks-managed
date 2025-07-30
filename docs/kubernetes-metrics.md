# Kubernetes Metrics Integration

Collects resource usage directly from Kubernetes for billing.

## How It Works

1. Connects to K8s cluster using kubeconfig
2. Maps pods to users via Hopsworks username labels
3. Aggregates CPU, memory, and storage usage
4. Stores in `usage_hourly` table for billing

## Setup

### 1. Upload Kubeconfig

```bash
# Via Admin UI: /admin47392 → Clusters → Upload Kubeconfig
# Or use the API endpoint
```

### 2. Username Mapping

Users need `hopsworks_username` stored in database:
- New users: Set automatically via Auth0 webhook
- Existing users: Synced on next login from Hopsworks API

### 3. Cron Job

Add to Vercel cron config:
```json
{
  "crons": [{
    "path": "/api/usage/collect-k8s",
    "schedule": "0 * * * *"  // Every hour
  }]
}
```

## Metrics Collected

- **CPU**: cores used per hour
- **Memory**: GB used per hour  
- **Storage**: Current GB usage
- **Projects**: Active project count

## Troubleshooting

### No Metrics Found
1. Check user has `hopsworks_username` in database
2. Verify kubeconfig is uploaded for cluster
3. Ensure user has running pods in K8s

### Username Not Syncing
- Force sync: Log out and log back in
- Check Auth0 webhook logs in Vercel