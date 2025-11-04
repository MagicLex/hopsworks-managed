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

`GET /admin/users/{username}/projects` - User's projects (owner or member)

`GET /admin/projects` - All projects

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

`GET /project/{projectId}/projectMembers` - List members

**Roles**: `Data owner`, `Data scientist`, `Observer`

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
