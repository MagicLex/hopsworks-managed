# Metering Queries Quick Reference

Quick reference for querying compute and storage metrics for billing purposes.

## Prerequisites

```bash
# Set kubeconfig path
export KUBECONFIG=/path/to/kubeconfig.yml

# Get MySQL password
export MYSQL_PASS=$(kubectl get secret -n hopsworks mysql-users-secrets -o jsonpath='{.data.hopsworksroot}' | base64 -d)

# Get namenode pod name
export NAMENODE_POD=$(kubectl get pods -n hopsworks -l app=namenode -o jsonpath='{.items[0].metadata.name}')
```

## Compute (CPU/RAM/GPU)

### Via OpenCost API (Last Hour)

```bash
kubectl get --raw "/api/v1/namespaces/opencost/services/opencost:9003/proxy/allocation/compute?window=1h&aggregate=namespace" | jq '.data[0]'
```

### Parse for Specific Project

```bash
kubectl get --raw "/api/v1/namespaces/opencost/services/opencost:9003/proxy/allocation/compute?window=24h&aggregate=namespace" | \
python3 -c "
import json, sys
data = json.load(sys.stdin)
project = data['data'][0].get('testme', {})
if project:
    print(f\"CPU Hours: {project.get('cpuCoreHours', 0):.2f}h\")
    print(f\"RAM GB-Hours: {project.get('ramByteHours', 0) / (1024**3):.2f}\")
    print(f\"GPU Hours: {project.get('gpuHours', 0):.2f}h\")
    print(f\"OpenCost Total Cost: \${project.get('totalCost', 0):.4f}\")
"
```

### From Supabase (Historical Data)

```bash
# Get current month usage
psql "$POSTGRES_URL" -c "
SELECT
  date,
  opencost_cpu_hours,
  opencost_gpu_hours,
  opencost_ram_gb_hours,
  total_cost
FROM usage_daily
WHERE user_id = 'google-oauth2|YOUR_USER_ID'
  AND date >= date_trunc('month', CURRENT_DATE)
ORDER BY date DESC;
"
```

## Storage

### Offline Storage (HDFS)

**Single Project:**
```bash
kubectl exec -n hopsworks $NAMENODE_POD -- \
  /srv/hops/hadoop/bin/hdfs dfs -du -s /Projects/testme 2>&1 | \
  grep -v "WARNING\|SLF4J" | \
  awk '{printf "Bytes: %d (%.2f MB)\n", $1, $1/1024/1024}'
```

**All Projects:**
```bash
kubectl exec -n hopsworks $NAMENODE_POD -- \
  /srv/hops/hadoop/bin/hdfs dfs -ls /Projects 2>&1 | \
  grep -v "WARNING\|SLF4J" | \
  awk '/^d/ {print $8}' | \
  while read project; do
    size=$(kubectl exec -n hopsworks $NAMENODE_POD -- \
      /srv/hops/hadoop/bin/hdfs dfs -du -s $project 2>&1 | \
      grep -v "WARNING\|SLF4J" | awk '{print $1}')
    mb=$(echo "scale=2; $size / 1024 / 1024" | bc)
    echo "$(basename $project): ${mb} MB"
  done
```

### Online Storage (RonDB/NDB Cluster)

**Single Project:**
```bash
kubectl exec -n hopsworks mysqlds-0 -- mysql -u hopsworksroot -p${MYSQL_PASS} -e "
SELECT
  SUBSTRING_INDEX(parent_fq_name, '/', 1) AS project,
  ROUND(SUM(fixed_elem_alloc_bytes + var_elem_alloc_bytes)/1024/1024, 2) AS size_mb
FROM ndbinfo.memory_per_fragment
WHERE parent_fq_name LIKE 'testme/%'
GROUP BY project;
" 2>&1 | grep -v "Warning\|Defaulted"
```

**All Projects with NDB Tables:**
```bash
kubectl exec -n hopsworks mysqlds-0 -- mysql -u hopsworksroot -p${MYSQL_PASS} -e "
SELECT
  SUBSTRING_INDEX(parent_fq_name, '/', 1) AS project,
  ROUND(SUM(fixed_elem_alloc_bytes + var_elem_alloc_bytes)/1024/1024, 2) AS size_mb
FROM ndbinfo.memory_per_fragment
GROUP BY SUBSTRING_INDEX(parent_fq_name, '/', 1)
HAVING size_mb > 0
ORDER BY size_mb DESC;
" 2>&1 | grep -v "Warning\|Defaulted"
```

**⚠️ Note:** NDB metrics may include metadata/overhead. Validate against actual feature group sizes.

## Combined Query (All Metrics for Project)

```bash
#!/bin/bash
PROJECT="testme"

echo "=== Metering Report for $PROJECT ==="
echo ""

# Compute (last 24h)
echo "## Compute (Last 24h)"
kubectl get --raw "/api/v1/namespaces/opencost/services/opencost:9003/proxy/allocation/compute?window=24h&aggregate=namespace" | \
python3 -c "
import json, sys
data = json.load(sys.stdin)
project = data['data'][0].get('$PROJECT', {})
if project:
    print(f\"  CPU Hours: {project.get('cpuCoreHours', 0):.2f}h\")
    print(f\"  RAM GB-Hours: {project.get('ramByteHours', 0) / (1024**3):.2f}\")
    print(f\"  GPU Hours: {project.get('gpuHours', 0):.2f}h\")
else:
    print('  No data')
"
echo ""

# Offline Storage
echo "## Offline Storage (HDFS)"
kubectl exec -n hopsworks $NAMENODE_POD -- \
  /srv/hops/hadoop/bin/hdfs dfs -du -s /Projects/$PROJECT 2>&1 | \
  grep -v "WARNING\|SLF4J" | \
  awk '{printf "  Size: %d bytes (%.2f MB)\n", $1, $1/1024/1024}'
echo ""

# Online Storage
echo "## Online Storage (NDB)"
kubectl exec -n hopsworks mysqlds-0 -- mysql -u hopsworksroot -p${MYSQL_PASS} -e "
SELECT ROUND(SUM(fixed_elem_alloc_bytes + var_elem_alloc_bytes)/1024/1024, 2) AS size_mb
FROM ndbinfo.memory_per_fragment
WHERE parent_fq_name LIKE '$PROJECT/%';
" 2>&1 | grep -v "Warning\|Defaulted\|size_mb" | awk '{print "  Size: " $1 " MB"}'
```

## Supabase Historical Queries

### Monthly Usage by Project

```sql
SELECT
  date,
  SUM(opencost_cpu_hours) AS cpu_hours,
  SUM(opencost_ram_gb_hours) AS ram_gb_hours,
  SUM(total_cost) AS cost_usd
FROM usage_daily
WHERE user_id = 'google-oauth2|YOUR_USER_ID'
  AND date >= date_trunc('month', CURRENT_DATE)
GROUP BY date
ORDER BY date DESC;
```

### Project Breakdown (from JSONB)

```sql
SELECT
  date,
  projects.key AS project_name,
  (projects.value->>'cpuHours')::decimal AS cpu_hours,
  (projects.value->>'ramGBHours')::decimal AS ram_gb_hours,
  projects.value->>'lastUpdated' AS last_updated
FROM usage_daily
CROSS JOIN LATERAL jsonb_each(project_breakdown) AS projects(key, value)
WHERE user_id = 'google-oauth2|YOUR_USER_ID'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, project_name;
```

### Total Spend Current Month

```sql
SELECT
  SUM(total_cost) AS total_spend_usd,
  COUNT(DISTINCT date) AS days_with_usage
FROM usage_daily
WHERE user_id = 'google-oauth2|YOUR_USER_ID'
  AND date >= date_trunc('month', CURRENT_DATE);
```

## Pricing Calculation

See `src/config/billing-rates.ts` for current rates.

Example calculation:
```javascript
const creditsUsed = calculateCreditsUsed({
  cpuHours: 24.5,
  gpuHours: 0,
  ramGbHours: 128
});
const cost = calculateDollarAmount(creditsUsed); // $0.35 per credit
```

## Troubleshooting

**OpenCost returns empty data:**
- Check if pods are running in target namespace
- Verify time window (use 24h for better data)
- System namespaces are skipped (hopsworks, kube-system, etc.)

**HDFS command hangs:**
- Namenode may be busy
- Check namenode logs: `kubectl logs -n hopsworks $NAMENODE_POD`

**NDB metrics show 0 despite having data:**
- NDB stats update periodically
- Query actual row counts: `SELECT COUNT(*) FROM {project}.{table}`
- May be rounding to 0.00 MB for small datasets
