# Hopsworks Database Access

## DBeaver Connection

- **Host**: `51.161.82.224` (LoadBalancer)
- **Port**: `3306`
- **Database**: `hopsworks`
- **Username**: `hopsworksroot`
- **Password**: `kubectl get secret -n hopsworks mysql-users-secrets -o jsonpath='{.data.hopsworksroot}' | base64 -d`

## CLI Access

```bash
kubectl exec -n hopsworks mysqlds-0 -- mysql -u hopsworksroot -p<PASSWORD> -e "QUERY"
```

## Useful Queries

### List All Users
```sql
SELECT uid, email, username, CONCAT(fname, ' ', lname) as full_name,
       max_num_projects, status, num_active_projects
FROM hopsworks.users
WHERE uid >= 10000
ORDER BY uid;
```

### List Projects
```sql
SELECT id, projectname, username as owner, created
FROM hopsworks.project
ORDER BY created DESC;
```

### Project Team Memberships
```sql
SELECT pt.project_id, p.projectname, u.username, u.email, pt.team_role, u.max_num_projects
FROM hopsworks.project_team pt
JOIN hopsworks.project p ON pt.project_id = p.id
JOIN hopsworks.users u ON pt.team_member = u.email
ORDER BY pt.project_id, pt.team_role;
```

### User's Projects
```sql
SELECT p.projectname, pt.team_role, p.created
FROM hopsworks.project_team pt
JOIN hopsworks.project p ON pt.project_id = p.id
WHERE pt.team_member = 'user@example.com'
ORDER BY p.created DESC;
```

## Key Tables

- `users` - Hopsworks users (uid >= 10000)
- `project` - Projects and owners
- `project_team` - Memberships and roles
- `oauth_client` - OAuth configs
- `oauth_login_state` - Active sessions

## User Types

- `max_num_projects = 5`: Account owners
- `max_num_projects = 0`: Team members

## Storage Queries

### Offline Storage (HDFS)

Datasets, training data, model artifacts stored in HDFS.

```bash
# Via namenode pod
kubectl exec -n hopsworks namenode-pod-name -- \
  /srv/hops/hadoop/bin/hdfs dfs -du -s /Projects/testme

# Output: bytes_used  bytes_with_replication  path
# Example: 600855341  600855341  /Projects/testme (573 MB)
```

**Baseline:** Empty projects = ~4.5 KB (Hopsworks metadata)

**List All Projects:**
```bash
kubectl exec -n hopsworks namenode-pod-name -- \
  /srv/hops/hadoop/bin/hdfs dfs -ls /Projects

# Example output:
# dr-xr-xr-x   - testme__aavstrei  testme  0 2025-10-31 08:36 /Projects/testme
```

**Convert to GB:**
```bash
kubectl exec -n hopsworks namenode-pod-name -- \
  /srv/hops/hadoop/bin/hdfs dfs -du -s /Projects/testme | \
  awk '{printf "%.2f GB\n", $1/1024/1024/1024}'
```

**Note:** HDFS replication factor is typically 1 in Hopsworks single-node deployments, so bytes_used = bytes_with_replication.

### Online Storage (RonDB/NDB Cluster) *

Online feature store data stored in NDB Cluster (in-memory distributed database).

```sql
-- Get online storage per project
SELECT
  SUBSTRING_INDEX(parent_fq_name, '/', 1) AS project,
  ROUND(SUM(fixed_elem_alloc_bytes + var_elem_alloc_bytes)/1024/1024, 2) AS online_storage_mb
FROM ndbinfo.memory_per_fragment
WHERE parent_fq_name LIKE 'testme/%'
GROUP BY project;

-- Example output:
-- project  online_storage_mb
-- testme   0.63
```

**Via kubectl:**
```bash
kubectl exec -n hopsworks mysqlds-0 -- mysql -u hopsworksroot -p<PASSWORD> -e "
SELECT
  SUBSTRING_INDEX(parent_fq_name, '/', 1) AS project,
  ROUND(SUM(fixed_elem_alloc_bytes + var_elem_alloc_bytes)/1024/1024, 2) AS size_mb
FROM ndbinfo.memory_per_fragment
WHERE parent_fq_name LIKE 'testme/%';
"
```

**\* Important Note:** The reported size may include NDB internal metadata/overhead and not just user data. For example, a project with 1000 rows across 2 feature groups reported 0.63 MB, which seems low for actual data. Further investigation needed to determine if this accurately reflects billable storage or if additional queries are required for precise user data sizing.
