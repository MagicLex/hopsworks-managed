# OpenCost Usage Collection

## Overview

The OpenCost collection job runs **every hour** to gather compute and storage metrics from all active Hopsworks clusters. It maps Kubernetes namespaces to users, calculates costs, and stores the data for billing.

**Primary**: Windmill schedule → `f/opencost/collect_usage` → Docker sidecar (`http://172.18.0.1:8787/collect`)
**Fallback**: Vercel cron `/api/usage/collect-opencost` (still active during migration)
**Schedule**: `0 * * * *` (hourly, on the hour)

The Windmill path was introduced because collection runs take ~110-160s, which exceeds Vercel's serverless timeout on larger clusters.

## Architecture

### Multi-Cluster Support

The job processes **all active clusters** in parallel:

```
Windmill (hourly) → Docker sidecar on VM
  ↓
Get all active clusters from DB
  ↓
For each cluster:
  ├─ Connect via kubeconfig
  ├─ Query OpenCost API (kubectl exec)
  ├─ Query HDFS for offline storage
  ├─ Query NDB for online storage
  ├─ Map namespaces → users
  └─ Store usage in usage_daily
```

**Key principle**: Each cluster is processed independently. If one cluster fails, the others continue.

## Data Flow

### 1. Cluster Discovery

```sql
SELECT * FROM hopsworks_clusters WHERE status = 'active'
```

Returns all clusters with:
- `kubeconfig` - For kubectl access
- `api_url`, `api_key` - For Hopsworks API calls
- `mysql_password` - For NDB storage queries

### 2. Metrics Collection (Per Cluster)

For each cluster, the job collects:

**Compute (via OpenCost API)**:
```bash
kubectl exec -n opencost opencost-pod -- \
  curl http://localhost:9003/allocation/compute?window=1h&aggregate=namespace
```

Returns per namespace:
- CPU core-hours
- GPU hours
- RAM byte-hours
- Efficiency metrics

**Storage (batch queries - all projects)**:
```bash
# Offline (HDFS) - all projects in one query
kubectl exec namenode-pod -- hdfs dfs -du /Projects

# Online (NDB) - all projects in one query
mysql> SELECT database_name, SUM(in_memory_bytes + disk_memory_bytes)
       FROM ndbinfo.table_memory_usage
       GROUP BY database_name
```

**Two-pass collection strategy**:
1. **First pass**: Process namespaces with compute activity (from OpenCost allocations)
   - Collect compute metrics (CPU, RAM, GPU)
   - Collect storage metrics for these projects
2. **Second pass**: Process projects with storage but no compute activity
   - Iterate through all projects in storage batch results
   - Skip projects already processed in first pass
   - Create/update usage records with storage-only metrics (compute = 0)

This ensures storage is billed even when no pods are running.

### 3. Namespace to User Mapping

**Critical**: The job must verify that the namespace owner is on the **current cluster** being processed.

```typescript
// 1. Check cache first
const project = await supabase
  .from('user_projects')
  .select('user_id, project_name')
  .eq('namespace', namespace)
  .single();

if (project) {
  // 2. Verify user is on THIS cluster
  const assignment = await supabase
    .from('user_hopsworks_assignments')
    .select('hopsworks_cluster_id')
    .eq('user_id', project.user_id)
    .single();

  if (assignment.hopsworks_cluster_id === cluster.id) {
    // Valid - user is on this cluster
    userId = project.user_id;
  } else {
    // Invalid - user is on different cluster, re-resolve
  }
}

// 3. If not in cache or wrong cluster, query Hopsworks API
const hopsworksProjects = await getAllProjects(cluster);
const hopsworksProject = hopsworksProjects.find(p => p.name === namespace);

if (hopsworksProject) {
  // Find user by username AND verify cluster assignment
  const user = await supabase
    .from('users')
    .select('id, user_hopsworks_assignments!inner(hopsworks_cluster_id)')
    .eq('hopsworks_username', hopsworksProject.owner)
    .eq('user_hopsworks_assignments.hopsworks_cluster_id', cluster.id)
    .single();
}
```

**Why cluster verification is critical**:
- User A on Cluster 1 has project "test" → namespace "test"
- User B on Cluster 2 has project "test" → namespace "test"
- Without verification, Cluster 2 metrics would bill User A incorrectly

### 4. Cost Calculation

```typescript
import { calculateCreditsUsed, calculateDollarAmount } from '@/config/billing-rates';

// Convert usage to cost
const creditsUsed = calculateCreditsUsed({
  cpuHours: allocation.cpuCoreHours,
  gpuHours: allocation.gpuHours,
  ramGbHours: allocation.ramByteHours / (1024**3),
  onlineStorageGb: onlineStorageGB / 720,  // Pro-rated hourly
  offlineStorageGb: offlineStorageGB / 720
});

const hourlyTotalCost = calculateDollarAmount(creditsUsed); // $0.35 per credit
```

Rates from `src/config/billing-rates.ts`:
- CPU: $0.175/core-hour
- GPU: $3.50/hour
- RAM: $0.0175/GB-hour
- Online storage: $0.50/GB-month
- Offline storage: $0.03/GB-month

Each usage row records both `user_id` and `account_owner_id`, so owner-level aggregation works immediately for dashboards and billing queries.

### 5. Database Storage

**Accumulation logic**:
- Compute metrics: **ACCUMULATED** (add hourly values)
- Storage metrics: **SNAPSHOT** (latest value, not accumulated)

```sql
-- If record exists for today
UPDATE usage_daily SET
  opencost_cpu_hours = opencost_cpu_hours + new_cpu_hours,     -- ADD
  opencost_gpu_hours = opencost_gpu_hours + new_gpu_hours,     -- ADD
  opencost_ram_gb_hours = opencost_ram_gb_hours + new_ram,     -- ADD
  online_storage_gb = new_online_storage,                      -- REPLACE
      offline_storage_gb = new_offline_storage,                    -- REPLACE
      total_cost = total_cost + new_hourly_cost,                   -- ADD
      project_breakdown = updated_breakdown                         -- MERGE
WHERE user_id = ? AND date = CURRENT_DATE;

-- If no record for today
INSERT INTO usage_daily (
  user_id,
  date,
  opencost_cpu_hours,
  opencost_gpu_hours,
  opencost_ram_gb_hours,
  online_storage_gb,
  offline_storage_gb,
  total_cost,
  project_breakdown,
  hopsworks_cluster_id
) VALUES (...);
```

When the cron job reruns within the same UTC hour, it replaces the previous contribution for that namespace instead of double-counting. The latest per-project snapshots are summed to populate `online_storage_gb` and `offline_storage_gb`, so the totals always reflect the current state observed in RonDB/HDFS.

## Cluster Results Aggregation

After processing all clusters, the job returns:

```json
{
  "message": "OpenCost metrics collection completed for all clusters",
  "timestamp": "2025-02-07",
  "hour": 15,
  "clustersProcessed": 3,
  "results": {
    "successful": 42,
    "failed": 2,
    "errors": [
      "Namespace foo: No user mapping found",
      "Cluster bar: Connection timeout"
    ],
    "clusters": [
      {
        "clusterId": "uuid-1",
        "clusterName": "prod-us-east",
        "successful": 20,
        "failed": 0,
        "namespaceCount": 20
      },
      {
        "clusterId": "uuid-2",
        "clusterName": "prod-eu-west",
        "successful": 22,
        "failed": 2,
        "namespaceCount": 24
      }
    ]
  }
}
```

## Error Handling

### Namespace Without User Mapping

**Symptom**: `No user found for namespace X`

**Causes**:
1. Orphaned namespace (project deleted in Hopsworks, namespace still exists in K8s)
2. Cache stale (`user_projects` not synced with Hopsworks)
3. System namespace (hopsworks, kube-system, etc.)

**Resolution**:
- System namespaces are skipped automatically
- Run `/api/cron/sync-projects` to refresh cache
- Check namespace manually: `kubectl get ns <namespace>`

### Cluster Connection Failure

**Symptom**: `Failed to collect metrics for cluster X`

**Causes**:
1. Invalid kubeconfig
2. OpenCost pod not running
3. Network timeout

**Resolution**:
```bash
# Verify kubeconfig
export KUBECONFIG=/path/to/kubeconfig
kubectl get pods -n opencost

# Check OpenCost health
kubectl logs -n opencost -l app.kubernetes.io/name=opencost

# Test OpenCost API
kubectl exec -n opencost opencost-xxx -- \
  curl http://localhost:9003/allocation/compute?window=1h
```

### User on Wrong Cluster

**Symptom**: `Namespace X mapped to user on different cluster`

**Cause**: Cache (`user_projects`) has stale cluster assignment

**Resolution**: Job will re-resolve via Hopsworks API automatically

## Monitoring

### Windmill (Primary)

The collection runs via Windmill on `https://auto.hops.io` (workspace: `hopsworks`).

**Viewer access**: `WINDMILL_VIEWER_EMAIL` / `WINDMILL_VIEWER_PASSWORD` in `.env.local`

**Check recent runs**:
```bash
# Authenticate (token is ephemeral, ~15 min)
TOKEN=$(curl -s -X POST https://auto.hops.io/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"'$WINDMILL_VIEWER_EMAIL'","password":"'$WINDMILL_VIEWER_PASSWORD'"}')

# Or use the persistent token directly
TOKEN=$WINDMILL_VIEWER_TOKEN

# Last 10 completed runs
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://auto.hops.io/api/w/hopsworks/jobs/completed/list?per_page=10&order_desc=true&script_path_start=f/opencost" \
  | jq '.[] | {created_at, success, duration_ms}'

# Check if a job is stuck in queue
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://auto.hops.io/api/w/hopsworks/jobs/queue/list?per_page=5&order_desc=true&script_path_start=f/opencost" \
  | jq '.[] | {created_at, running, scheduled_for}'

# Get full result + logs for a specific run
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://auto.hops.io/api/w/hopsworks/jobs_u/completed/get/<JOB_ID>" \
  | jq '{result: .result, logs: .logs}'
```

**Typical healthy run**: ~2-3 minutes, `success=true`, ~50 namespaces processed.

**What to look for**:
- `running=false` in queue for >5 min → worker is stuck or down
- `success=false` → check logs for Docker sidecar connectivity (`http://172.18.0.1:8787/collect`)
- Duration spike >5 min → cluster or storage query slowdown

### Vercel (Fallback)

Still active during migration. Check Vercel project → Cron Jobs tab.

### Database Queries

```sql
-- Check latest collection
SELECT
  date,
  COUNT(*) as users,
  SUM(opencost_cpu_hours) as total_cpu,
  SUM(total_cost) as total_cost
FROM usage_daily
WHERE date = CURRENT_DATE
GROUP BY date;

-- Check unmapped namespaces (potential issues)
SELECT * FROM user_projects
WHERE status = 'active'
  AND last_seen_at < NOW() - INTERVAL '2 hours';

-- Check clusters being processed
SELECT
  hc.name,
  COUNT(DISTINCT ud.user_id) as users,
  SUM(ud.total_cost) as cost_today
FROM hopsworks_clusters hc
LEFT JOIN usage_daily ud ON ud.hopsworks_cluster_id = hc.id
  AND ud.date = CURRENT_DATE
WHERE hc.status = 'active'
GROUP BY hc.id, hc.name;
```

### Admin Panel

Navigate to `/admin47392`:
- "Check OpenCost" button tests connectivity
- "Update Usage Data" triggers manual collection
- View per-user breakdown with project details

## Manual Triggering

```bash
# Via Windmill (preferred — no timeout)
# Trigger from Windmill UI: https://auto.hops.io → f/opencost/collect_usage → Run

# Via Vercel API (fallback, 300s timeout)
curl -X POST https://run.hopsworks.ai/api/usage/collect-opencost \
  -H "Authorization: Bearer $CRON_SECRET"

# Via admin panel
# Go to /admin47392 → Click "Update Usage Data"
```

## Performance Considerations

### Current Performance (Windmill + Docker sidecar)

- Single cluster (eu-west, ~50 namespaces): **~2-3 minutes**
- Storage queries: ~3-5 seconds (batch mode)
- Per namespace processing: ~100-200ms
- HDFS `du` command: 70-90 seconds on clusters with many projects

### Scale Limits

**Current**: 1 cluster, ~50 namespaces, ~42 billable users
**Expected**: 10 clusters, ~500 namespaces total

The Docker sidecar has no serverless timeout — it runs until completion.
Vercel fallback has a 300s limit and will timeout on larger workloads.

## Namespace Uniqueness

**Constraint**: Kubernetes enforces namespace uniqueness **per cluster**.

**Database constraint**:
```sql
-- Unique constraint on namespace
user_projects_namespace_key UNIQUE (namespace)
```

**Implication**: Two users on **different clusters** can have the same namespace name (e.g., both have "test"). The job handles this by verifying cluster assignment during user lookup.

**Same cluster**: Two users CANNOT have the same namespace on the same cluster (K8s prevents this).

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Overall system design
- [Billing System](../features/billing.md) - How costs are calculated and billed
- [Metering Queries](../reference/metering-queries.md) - Manual query examples
- [Database Schema](../reference/database/03-billing-tables.md) - Table structures
- [Cluster Setup](./cluster-setup.md) - Adding new clusters

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No data for last hour | Windmill job failed or stuck | Check queue (see Monitoring above), then Vercel fallback logs |
| Job stuck `running=false` in queue | Windmill worker down | Ask admin to check worker health on the VM |
| `success=false` with 0ms duration | Docker sidecar unreachable | Check `http://172.18.0.1:8787` on the VM |
| Missing namespaces | Cache stale | Run `/api/cron/sync-projects` |
| Wrong user billed | Cross-cluster mapping bug | Code verifies cluster now (fixed) |
| Storage metrics zero | MySQL password missing or pods not running | Update `hopsworks_clusters.mysql_password`. Storage is now collected even without active pods. |
| OpenCost connection error | Pod not running | `kubectl get pods -n opencost` |
| Duration spike >5 min | HDFS du slow or cluster overloaded | Check namenode pod health |
