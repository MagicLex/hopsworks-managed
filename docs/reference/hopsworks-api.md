# Hopsworks API Reference

Quick reference for Hopsworks API endpoints used in the SaaS service.

## Authentication

```bash
Authorization: ApiKey {API_KEY}
```

## Base URLs

- API: `{cluster_url}/hopsworks-api/api`
- Admin: `{cluster_url}/hopsworks-api/api/admin`

## User Management

### Create OAuth2 User

`POST /admin/users` - Query params only (NOT JSON body)

**Required Params**:
- `accountType=REMOTE_ACCOUNT_TYPE`
- `email`, `givenName`, `surname`
- `maxNumProjects` (0-N)
- `subject` (Auth0 ID, URL-encode `|` as `%7C`)
- `clientId` (Auth0 client ID)
- `type=OAUTH2`

**Do NOT include** `status` parameter.

**Response** (201):
```json
{
  "uuid": "clientId.subject",
  "givenName": "John",
  "surname": "Doe",
  "email": "user@example.com",
  "username": "john1234"
}
```

### Get User

`GET /admin/users/{username}` - Returns user details

`GET /admin/users` - List all users (supports `offset`, `limit`, `sort_by`, `filter_by`)

### Update User

`PUT /admin/users/{userId}` - JSON body: `{"maxNumProjects": 10}`

## Project Management

### Get Projects

`GET /admin/projects` - All projects

**Important**: Use `?expand=creator` to get owner details:
```bash
GET /admin/projects?expand=creator
```

**Response structure**:
```json
{
  "items": [
    {
      "id": 120,
      "name": "testme",
      "creator": {
        "href": "http://cluster.hopsworks.ai/hopsworks-api/api/users/10182",
        "firstname": "John",
        "lastname": "Doe",
        "email": "user@example.com",
        "username": "user10182"
      },
      "created": "2024-10-31T08:36:00Z",
      "paymentType": "PREPAID"
    }
  ]
}
```

Without `expand=creator`, the `creator` field only contains `href` and you must make additional API calls per project.

**Note**: `GET /admin/users/{username}/projects` endpoint does NOT exist in this Hopsworks version (returns 404)

### Create Project

`POST /admin/projects/createas` - JSON body:
```json
{
  "owner": "username",
  "projectName": "project-name",
  "services": ["JOBS", "FEATURESTORE"]
}
```

## Team Management

### Manage Project Members

`POST /project/{projectId}/projectMembers/{email}` - JSON body: `{"projectTeam": "Data scientist"}`

**Roles**: `Data owner`, `Data scientist`, `Observer`

`GET /project/{projectId}/projectMembers` - List members

**⚠️ Important limitations:**
- This endpoint requires the API key to belong to a user who is a member of the project
- Admin API keys may return error: `"No valid role found for this user"` (errorCode: 160000)
- For programmatic access to project memberships, use MySQL direct query (see below)

### Alternative: Query Project Members via MySQL

For reliable access to project team memberships when API key restrictions apply:

```bash
# Get MySQL password
kubectl get secret -n hopsworks mysql-users-secrets -o jsonpath='{.data.hopsworksroot}' | base64 -d

# Query project_team table
kubectl exec -n hopsworks mysqlds-0 -- mysql -u hopsworksroot -p<PASSWORD> -e "
SELECT
  pt.project_id,
  p.projectname,
  pt.team_member,
  pt.team_role
FROM hopsworks.project_team pt
JOIN hopsworks.project p ON pt.project_id = p.id
WHERE pt.team_member = 'user@example.com'
ORDER BY p.created DESC;
"
```

**Note**: Direct MySQL queries bypass Hopsworks audit trails and should only be used for read-only operations when API access is not feasible. Prefer using Hopsworks UI for project member management.

## System

`GET /variables/versions` - Software versions

## Error Format

```json
{
  "errorCode": 120004,
  "usrMsg": "HTTP 404 Not Found",
  "errorMsg": "Web application exception occurred"
}
```
