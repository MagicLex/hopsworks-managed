# Hopsworks Managed - Billing System

## Overview

Resource-based billing where users pay for compute resources they personally launch.

## How Billing Works

### 1. Resource Ownership
- Every Kubernetes pod has an `owner: <username>` label
- The owner pays for that resource
- Shared project members can access resources without being charged

### 2. Metrics Collection
- **Frequency**: Every 15 minutes via Vercel cron
- **Scope**: All users across all clusters
- **Method**: Kubernetes metrics-server API queries

### 3. What We Track
```
Currently Billing:
- CPU cores (accumulated as core-hours)
- Storage GB (current snapshot)

Collected but Not Billed:
- Memory GB

Not Implemented:
- GPU usage
- API calls
- Network traffic
```

### 4. Cost Calculation
- **CPU**: Instance-based pricing × hours used
- **Storage**: Per GB pricing × current usage
- **Total**: Sum of all resources for the day

## Database Flow

```
Every 15 minutes:
Kubernetes → metrics-server → usage_daily (accumulates)
                                    ↓
Daily at 3 AM:
usage_daily → Stripe API (postpaid users)
     ↓
     └→ user_credits (prepaid users)
```

## Billing Modes

### Postpaid (Default)
- Monthly invoicing via Stripe
- Usage reported daily to Stripe
- Pay after usage

### Prepaid (Opt-in)
- Buy credits upfront
- Usage deducted immediately
- Low balance warnings

## Tables

### usage_daily
- Primary billing data
- Accumulates throughout the day
- One record per user per day

### Key Columns
- `cpu_hours`: Cumulative core-hours
- `storage_gb`: Current snapshot (not cumulative)
- `total_cost`: Accumulated daily cost
- `hopsworks_cluster_id`: Source cluster

## Shared Projects Example

```
Project: analytics-team
├── Alice's Jupyter → Billed to Alice
├── Bob's Training Job → Billed to Bob
└── Shared Feature Store → No compute cost
```

## Configuration

### Vercel Cron (vercel.json)
```json
{
  "crons": [{
    "path": "/api/usage/collect-k8s",
    "schedule": "*/15 * * * *"  // Every 15 minutes
  }]
}
```

### Environment Variables
- `CRON_SECRET`: Authenticates cron jobs
- `STRIPE_SECRET_KEY`: Stripe integration
- `SUPABASE_SERVICE_ROLE_KEY`: Database access

## Troubleshooting

### No Usage Data
1. Check `hopsworks_username` is set in users table
2. Verify kubeconfig uploaded for cluster
3. Ensure pods have `owner` label

### Incorrect Costs
- Check pricing configuration matches dashboard display
- Verify 15-minute accumulation is working
- Ensure no duplicate cron runs