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
