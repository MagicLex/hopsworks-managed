# Kubernetes Metrics Integration

This document describes how to integrate Kubernetes metrics collection for tracking user resource consumption in Hopsworks Managed.

## Overview

Since the Hopsworks Admin API doesn't provide user consumption metrics, we've implemented a direct Kubernetes metrics collection system that:

1. Connects to the Kubernetes cluster using kubeconfig
2. Queries the metrics-server for real-time resource usage
3. Maps Kubernetes resources to Hopsworks users and projects
4. Aggregates metrics across all user projects

## Architecture

### Components

1. **KubernetesMetricsClient** (`src/lib/kubernetes-metrics.ts`)
   - Connects to K8s cluster using kubeconfig
   - Queries pods by user labels
   - Fetches metrics from metrics-server
   - Aggregates data by project and user

2. **Admin API Endpoints**
   - `/api/admin/test-hopsworks` - Tests connection and displays metrics
   - `/api/admin/clusters/update-kubeconfig` - Uploads kubeconfig to database
   - `/api/admin/usage/[userId]` - Gets user consumption metrics (to be implemented)

3. **Database Schema**
   - Added `kubeconfig` column to `hopsworks_clusters` table
   - Stores YAML configuration for each cluster

### User/Project Mapping

Hopsworks creates Kubernetes resources with specific labels:

- **Namespace**: `{project}-{username}` (e.g., `main-lex`)
- **Pod Labels**:
  - `owner`: The Hopsworks username (e.g., `lex00000`)
  - `user`: Same as owner
  - `project-id`: Hopsworks project ID
  - `compute-type`: Type of workload (notebook, job, serving, etc.)

## Setup Instructions

### 1. Add Kubeconfig to Database

Run the migration to add the kubeconfig column:

```sql
ALTER TABLE hopsworks_clusters 
ADD COLUMN IF NOT EXISTS kubeconfig TEXT;

COMMENT ON COLUMN hopsworks_clusters.kubeconfig IS 
'Kubernetes cluster config YAML for accessing metrics directly from K8s cluster';
```

### 2. Upload Kubeconfig

#### Via Admin UI:
1. Go to Admin Panel → Clusters tab
2. Click "Upload Kubeconfig" for your cluster
3. Paste the kubeconfig YAML content
4. Click Upload

#### Via Script:
```bash
node scripts/upload-kubeconfig.js <cluster-id> <path-to-kubeconfig.yml>
```

### 3. Test Connection

1. Go to Admin Panel → Users tab
2. Find a user and click "Test API"
3. Check the "Kubernetes Metrics" section in the results

## Metrics Collected

### Per Pod:
- CPU usage (millicores)
- Memory usage (bytes)
- Pod type (jupyter, job, serving, etc.)

### Per Project:
- Total CPU cores used
- Total memory GB used
- Number of running pods
- Storage usage (if available)

### Per User:
- Aggregated metrics across all projects
- Total resource consumption
- Active projects count

## API Usage

### Get User Metrics
```typescript
import { KubernetesMetricsClient } from '@/lib/kubernetes-metrics';

const k8sClient = new KubernetesMetricsClient(kubeconfigString, false);
const userMetrics = await k8sClient.getUserMetrics('lex00000');

// Result:
{
  userId: 'lex00000',
  projects: [
    {
      projectId: '119',
      projectName: 'main_lex',
      namespace: 'main-lex',
      resources: {
        cpuCores: 0.004,
        memoryGB: 0.446,
        storageGB: 0
      },
      pods: [...]
    }
  ],
  totals: {
    cpuCores: 0.004,
    memoryGB: 0.446,
    storageGB: 0
  },
  timestamp: '2025-07-29T...'
}
```

### Get Project Metrics
```typescript
const projectMetrics = await k8sClient.getProjectMetrics('main-lex');
```

## Billing Integration

To integrate with the billing system:

1. Create a scheduled job to collect metrics periodically
2. Store metrics in the usage tracking tables
3. Calculate costs based on resource consumption
4. Update user credits accordingly

## Security Considerations

1. **Kubeconfig Storage**: Stored encrypted in database
2. **Access Control**: Only admin users can upload/modify kubeconfig
3. **Network Access**: Ensure your middleware can reach the K8s API server
4. **RBAC**: The kubeconfig should have minimal required permissions:
   - List/Get pods across namespaces
   - Get metrics from metrics-server

## Troubleshooting

### "No kubeconfig found for this cluster"
- Upload kubeconfig via Admin UI or API

### "Failed to connect to Kubernetes"
- Verify kubeconfig is valid
- Check network connectivity to K8s API server
- Ensure certificates haven't expired

### "Metrics not available"
- Verify metrics-server is installed in the cluster
- Check if pods have been running long enough to generate metrics
- Ensure the user has active workloads

## Future Enhancements

1. **Prometheus Integration**: Query Prometheus for historical metrics
2. **Cost Calculation**: Automatic cost calculation based on resource prices
3. **Alerts**: Set up alerts for unusual consumption
4. **Historical Data**: Store metrics over time for trend analysis
5. **GPU Metrics**: Add GPU usage tracking for ML workloads