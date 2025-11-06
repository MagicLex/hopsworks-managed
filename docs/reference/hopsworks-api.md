# Hopsworks Admin API Reference

Reference for Hopsworks Admin API endpoints used in the SaaS service.

## Authentication

All endpoints require an API key with admin privileges:

```bash
Authorization: ApiKey {API_KEY}
```

## Base URLs

- **Public API**: `{cluster_url}/hopsworks-api/api`
- **Admin API**: `{cluster_url}/hopsworks-api/api/admin`

---

## User Management

### Create OAuth2 User

**Endpoint**: `POST /admin/users`

**⚠️ Important**: Uses **query parameters**, NOT JSON body.

**Required Parameters**:
- `accountType=REMOTE_ACCOUNT_TYPE`
- `type=OAUTH2`
- `email` - User email address
- `givenName` - First name
- `surname` - Last name
- `maxNumProjects` - (Optional) Project limit (0-N, use 5 for account owners, 0 for team members). If omitted or negative, Hopsworks applies the default value from server config
- `subject` - Auth0 user ID (URL-encode `|` as `%7C`, e.g., `auth0%7C123456`)
- `clientId` - OAuth2 client ID from Hopsworks config

**Do NOT include**: `status` parameter (automatically set to ACTIVATED_ACCOUNT)

**Example**:
```bash
curl -X POST 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users?accountType=REMOTE_ACCOUNT_TYPE&email=user@example.com&givenName=John&surname=Doe&maxNumProjects=5&subject=auth0%7C123456&clientId=YOUR_CLIENT_ID&type=OAUTH2' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response** (201 Created):
```json
{
  "uuid": "clientId.auth0|123456",
  "givenName": "John",
  "surname": "Doe",
  "email": "user@example.com",
  "username": "john1234"
}
```

**⚠️ Critical**: The response does NOT include the numeric `id` field. You must query the user afterward to retrieve the ID for subsequent operations.

---

### Get User by ID

**Endpoint**: `GET /admin/users/{id}`

Returns complete user details including numeric ID.

**Example**:
```bash
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response** (200 OK):
```json
{
  "href": "http://cluster.hopsworks.ai/hopsworks-api/api/users/11209",
  "id": 11209,
  "firstname": "John",
  "lastname": "Doe",
  "email": "user@example.com",
  "username": "john1234",
  "accountType": "REMOTE_ACCOUNT_TYPE",
  "twoFactor": false,
  "toursState": 0,
  "status": 2,
  "maxNumProjects": 5,
  "numActiveProjects": 1,
  "activated": "2025-11-05T12:51:03.000Z",
  "role": [
    {
      "groupName": "HOPS_USER",
      "groupDesc": "Registered users in the system",
      "gid": 1006
    }
  ],
  "lastVisitedAt": "2025-11-05T12:51:03.000Z"
}
```

**Status values**:
- `0` - NEW_MOBILE_ACCOUNT (unverified)
- `1` - VERIFIED_ACCOUNT (email verified)
- `2` - ACTIVATED_ACCOUNT (active, can login)
- `3` - DEACTIVATED_ACCOUNT (blocked from login)
- `4` - BLOCKED_ACCOUNT (blocked for abuse)
- `5` - LOST_MOBILE (2FA reset required)
- `6` - SPAM_ACCOUNT (marked as spam)
- `7` - TEMP_PASSWORD (must change password)

---

### Get User by UUID

**Endpoint**: `GET /admin/user/{uuid}`

Lookup user by OAuth UUID (useful after user creation).

**UUID Format**: `{clientId}.{auth0_subject}` (URL-encode `|` as `%7C`)

**Example**:
```bash
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/user/clientId.auth0%7C123456' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response** (200 OK):
```json
{
  "uuid": "clientId.auth0|123456",
  "givenName": "John",
  "surname": "Doe",
  "email": "user@example.com"
}
```

**⚠️ Note**: This endpoint returns minimal user data (no numeric `id`).

---

### List Users

**Endpoint**: `GET /admin/users`

**Query Parameters**:
- `offset` - Pagination offset (default: 0)
- `limit` - Results per page (default: all)
- `filter_by` - Filter results (can use multiple times)
- `sort_by` - Sort results (format: `field:asc|desc`)

**Supported Filters** (`filter_by`):
- `type:REMOTE_ACCOUNT_TYPE` - OAuth2 users only
- `status:2` - Filter by account status (0-7)
- Can combine multiple filters

**Supported Sort Fields** (`sort_by`):
- `email:asc` or `email:desc`
- **NOT supported**: `id` (returns error)

**Example**:
```bash
# Get active OAuth2 users, sorted by email
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users?filter_by=type:REMOTE_ACCOUNT_TYPE&filter_by=status:2&sort_by=email:asc&limit=20' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response** (200 OK):
```json
{
  "href": "http://cluster.hopsworks.ai/hopsworks-api/api/admin/users",
  "items": [
    {
      "href": "http://cluster.hopsworks.ai/hopsworks-api/api/users/11210",
      "id": 11210,
      "firstname": "John",
      "lastname": "Doe",
      "email": "user@example.com",
      "username": "john1234",
      "accountType": "OAUTH2",
      "status": 2,
      "maxNumProjects": 5,
      "numActiveProjects": 1,
      "role": [
        {
          "groupName": "HOPS_USER",
          "groupDesc": "Registered users in the system",
          "gid": 1006
        }
      ]
    }
  ],
  "count": 1
}
```

**⚠️ Note**: Filter `type:REMOTE_ACCOUNT_TYPE` returns users with `accountType: "OAUTH2"` in response.

---

### Update User

**Endpoint**: `PUT /admin/users/{id}`

Update user properties (JSON body).

**Supported Fields**:
- `status` - Account status (0-7, see status values above)
- `maxNumProjects` - Project limit
- `bbcGroupCollection` - User groups/roles (advanced)

**Example - Update Project Limit**:
```bash
curl -X PUT 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxNumProjects": 10}'
```

**Example - Deactivate User**:
```bash
curl -X PUT 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": 3}'
```

**Response** (200 OK):
```json
{
  "id": 11209,
  "email": "user@example.com",
  "status": 3,
  "maxNumProjects": 10
}
```

**Common Status Changes**:
- `{"status": 2}` - Activate user (allow login)
- `{"status": 3}` - Deactivate user (block login)
- `{"status": 4}` - Block user (for abuse)
- `{"status": 6}` - Mark as spam

---

### Change User Role

**Endpoint**: `PUT /admin/users/{id}/role`

**⚠️ Important**: Uses **plain text** body, NOT JSON.

**Available Roles**:
- `HOPS_USER` (gid: 1006) - Standard user
- `HOPS_ADMIN` (gid: 1005) - System administrator

**Example**:
```bash
curl -X PUT 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209/role' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  -d 'HOPS_ADMIN'
```

**Response** (200 OK):
```json
{
  "id": 11209,
  "email": "user@example.com",
  "role": [
    {
      "groupName": "HOPS_ADMIN",
      "groupDesc": "System administrator",
      "gid": 1005
    }
  ]
}
```

---

### Get Available Roles

**Endpoint**: `GET /admin/users/groups`

Returns list of available user groups/roles.

**Example**:
```bash
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/groups' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response** (200 OK):
```json
{
  "href": "http://cluster.hopsworks.ai/hopsworks-api/api/admin/users/groups",
  "items": [
    {
      "groupName": "HOPS_ADMIN",
      "groupDesc": "System administrator",
      "gid": 1005
    },
    {
      "groupName": "HOPS_USER",
      "groupDesc": "Registered users in the system",
      "gid": 1006
    }
  ],
  "count": 2
}
```

---

### Delete User

**Endpoint**: `DELETE /admin/users/{id}`

Permanently delete a user account.

**⚠️ Warning**: Deletion fails if user owns active projects.

**Example**:
```bash
curl -X DELETE 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response** (204 No Content): Empty body on success.

**Error Response** (400 Bad Request):
```json
{
  "errorCode": 160054,
  "usrMsg": "Can not delete a user that owns a project…",
  "errorMsg": "ACCOUNT_DELETION_ERROR"
}
```

**Source**: `hopsworks-common/src/main/java/io/hops/hopsworks/common/user/UsersController.java:665`

---

## Project Management

### List Projects

**Endpoint**: `GET /admin/projects`

**⚠️ Critical**: Use `?expand=creator` to get owner details in-line. Without this, you only get an `href` and must make additional API calls per project.

**Query Parameters**:
- `expand=creator` - Include full creator details (HIGHLY RECOMMENDED)
- `offset` - Pagination offset
- `limit` - Results per page

**Example**:
```bash
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/projects?expand=creator&limit=20' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

**Response with `expand=creator`** (200 OK):
```json
{
  "href": "http://cluster.hopsworks.ai/hopsworks-api/api/admin/projects",
  "items": [
    {
      "href": "http://cluster.hopsworks.ai/hopsworks-api/api/admin/projects/120",
      "id": 120,
      "name": "my-project",
      "creator": {
        "href": "http://cluster.hopsworks.ai/hopsworks-api/api/users/10182",
        "firstname": "John",
        "lastname": "Doe",
        "email": "user@example.com",
        "username": "john1234"
      },
      "created": "2025-10-31T08:36:00Z",
      "paymentType": "PREPAID",
      "lastQuotaUpdate": "2025-10-31T08:36:03Z"
    }
  ],
  "count": 1
}
```

**Response without `expand=creator`** (requires N+1 queries):
```json
{
  "items": [
    {
      "id": 120,
      "name": "my-project",
      "creator": {
        "href": "http://cluster.hopsworks.ai/hopsworks-api/api/users/10182"
      }
    }
  ]
}
```

---

### Create Project

**Endpoint**: `POST /admin/projects/createas`

Create a project on behalf of a user (JSON body).

**Request Body**:
```json
{
  "owner": "username",
  "projectName": "project-name",
  "services": ["JOBS", "FEATURESTORE"]
}
```

**Available Services**:
- `JOBS` - Hopsworks Jobs
- `FEATURESTORE` - Feature Store
- `KAFKA` - Kafka topics
- `JUPYTER` - Jupyter notebooks
- `SERVING` - Model serving

**Example**:
```bash
curl -X POST 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/projects/createas' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "john1234",
    "projectName": "my-ml-project",
    "services": ["JOBS", "FEATURESTORE"]
  }'
```

**Response** (200 OK): Empty body (`Response.ok().build()`).

**Source**: `hopsworks-api/src/main/java/io/hops/hopsworks/api/admin/projects/ProjectsAdminResource.java:242`

**⚠️ Note**: No payload is returned. You must query `/admin/projects` to retrieve the created project details.

---

## Team Management

### Add Project Members

**Endpoint**: `POST /project/{projectId}/projectMembers`

Add one or more users to a project with specific roles (JSON body with MembersDTO).

**⚠️ Limitation**: This endpoint requires the API key to belong to a user who is already a member of the project. Admin API keys may fail with error `160000: "No valid role found for this user"`.

**Available Roles**:
- `Data owner` - Full project access
- `Data scientist` - Read/write access to datasets and jobs
- `Observer` - Read-only access

**Request Body (MembersDTO)**:
```json
{
  "projectTeam": [
    {
      "projectTeamPK": {
        "projectId": 120,
        "teamMember": "newuser@example.com"
      },
      "teamRole": "Data scientist"
    }
  ]
}
```

**Example**:
```bash
curl -X POST 'https://cluster.hopsworks.ai/hopsworks-api/api/project/120/projectMembers' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectTeam": [
      {
        "projectTeamPK": {
          "projectId": 120,
          "teamMember": "newuser@example.com"
        },
        "teamRole": "Data scientist"
      }
    ]
  }'
```

**Response** (200 OK):
```json
{
  "successMessage": "Members added successfully"
}
```

**Source**: `hopsworks-api/src/main/java/io/hops/hopsworks/api/project/ProjectMembersService.java:120`

---

### Update Project Member Role

**Endpoint**: `POST /project/{projectId}/projectMembers/{email}`

Update the role of an existing project member (form parameter, NOT JSON).

**Example**:
```bash
curl -X POST 'https://cluster.hopsworks.ai/hopsworks-api/api/project/120/projectMembers/user@example.com' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'role=Data owner'
```

**Response** (200 OK):
```json
{
  "email": "user@example.com",
  "role": "Data owner"
}
```

**Source**: `hopsworks-api/src/main/java/io/hops/hopsworks/api/project/ProjectMembersService.java:200`

---

### List Project Members

**Endpoint**: `GET /project/{projectId}/projectMembers`

**⚠️ Limitation**: Same as adding members - requires member API key, not admin.

**Alternative - Query via MySQL**:

For programmatic access when API restrictions apply, query the internal MySQL database directly:

```bash
# Get MySQL password
kubectl get secret -n hopsworks mysql-users-secrets -o jsonpath='{.data.hopsworksroot}' | base64 -d

# Query project team memberships
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

**⚠️ Warning**: Direct MySQL queries bypass Hopsworks audit trails. Use read-only for monitoring purposes only.

---

## System Information

### Get Software Versions

**Endpoint**: `GET /variables/versions`

Returns Hopsworks platform version information.

**Example**:
```bash
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/variables/versions' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

---

## Error Responses

All errors return JSON with the following structure:

```json
{
  "errorCode": 120004,
  "usrMsg": "HTTP 404 Not Found",
  "errorMsg": "Web application exception occurred"
}
```

**Common Error Codes**:
- `120004` - HTTP 404 Not Found / Invalid parameter
- `160000` - Authorization error (no valid role)
- `160002` - User not found
- `160054` - ACCOUNT_DELETION_ERROR (cannot delete user that owns projects)

---

## Quick Reference Examples

### Complete User Lifecycle

```bash
# 1. Create user
curl -X POST 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users?accountType=REMOTE_ACCOUNT_TYPE&email=user@example.com&givenName=John&surname=Doe&maxNumProjects=5&subject=auth0%7C123456&clientId=YOUR_CLIENT_ID&type=OAUTH2' \
  -H "Authorization: ApiKey YOUR_API_KEY"

# 2. Find user ID
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users?filter_by=type:REMOTE_ACCOUNT_TYPE' \
  -H "Authorization: ApiKey YOUR_API_KEY" | jq '.items[] | select(.email == "user@example.com")'

# 3. Update user
curl -X PUT 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxNumProjects": 10}'

# 4. Change role to admin
curl -X PUT 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209/role' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  -d 'HOPS_ADMIN'

# 5. Deactivate user
curl -X PUT 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": 3}'

# 6. Delete user
curl -X DELETE 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/users/11209' \
  -H "Authorization: ApiKey YOUR_API_KEY"
```

### Project Operations

```bash
# List all projects with owner details
curl -X GET 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/projects?expand=creator' \
  -H "Authorization: ApiKey YOUR_API_KEY"

# Create project
curl -X POST 'https://cluster.hopsworks.ai/hopsworks-api/api/admin/projects/createas' \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"owner": "john1234", "projectName": "ml-project", "services": ["JOBS", "FEATURESTORE"]}'
```
