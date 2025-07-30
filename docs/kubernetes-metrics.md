# Kubernetes Metrics Integration

Collects resource usage directly from Kubernetes for billing.

## How It Works

1. Connects to K8s cluster using kubeconfig
2. Finds ALL pods with `owner: <username>` label across ALL namespaces
3. Groups metrics by project (namespace)
4. Aggregates total CPU, memory across all user's projects
5. Accumulates usage in `usage_daily` table every 15 minutes

**Collection interval**: Runs every 15 minutes via Vercel cron job. Each run adds 0.25 hours of usage based on current resource consumption.

**Multi-project**: Automatically tracks all projects for a user. Each Hopsworks project creates pods labeled with the username, so metrics collection finds them all.

**Billing model**: Resource-based ownership
- Each pod is labeled with `owner: <username>` 
- The owner pays for the pod, regardless of who has project access
- Project collaborators can use shared resources but don't get billed
- If collaborators create their own pods, they pay for those pods

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

Configured in vercel.json:
```json
{
  "crons": [{
    "path": "/api/usage/collect-k8s",
    "schedule": "*/15 * * * *"  // Every 15 minutes
  }]
}
```

**Note**: Requires Vercel Pro or higher for frequent cron execution.

## Metrics Collected

### Actual Metrics from Kubernetes
- **CPU**: Current cores in use (accumulated as core-hours)
- **Memory**: Current GB in use (tracked but not billed yet)
- **Pod count**: Number of running pods per user
- **Instance type**: Detected from pod names (jupyter/job/serving)

### Billing Calculation
- **CPU hours**: Current cores × 0.25 hours (per 15-min interval)
- **Storage**: Current GB snapshot (not cumulative)
- **Total cost**: CPU cost + storage cost per interval

### Not Yet Implemented
- **GPU usage**: Currently hardcoded to 0
- **API calls**: Feature store, model serving calls
- **Network traffic**: Data transfer metrics
- **Actual storage**: PersistentVolume usage

## Shared Projects & Billing

### How it Works
When multiple users collaborate on a project:
- Each compute resource (Jupyter, Jobs, Model Serving) has an `owner` label
- Only the resource owner gets billed for that specific resource
- Shared data, feature stores, and models don't incur compute charges

### Example Scenario
```
Project: team-analytics
Members: Alice (owner), Bob (member), Charlie (member)

Resources:
- Alice's Jupyter notebook → Billed to Alice
- Bob's training job → Billed to Bob  
- Charlie's model deployment → Billed to Charlie
- Shared feature store → No compute cost (just storage)
```

### Best Practices
- Communicate with team members about resource usage
- Stop unused notebooks/deployments to avoid charges
- Project owners can see all resources but only pay for their own

## Troubleshooting

### No Metrics Found
1. Check user has `hopsworks_username` in database
2. Verify kubeconfig is uploaded for cluster
3. Ensure user has running pods in K8s

### Username Not Syncing
- Force sync: Log out and log back in
- Check Auth0 webhook logs in Vercel