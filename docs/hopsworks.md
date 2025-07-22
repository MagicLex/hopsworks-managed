# Hopsworks Integration

## Architecture
Hopsworks-managed acts as a control plane for provisioning and managing access to Hopsworks clusters.

## Integration Points

### 1. User Provisioning (Future)
- Configure Hopsworks to accept Auth0 as OAuth2 provider
- Users auto-created on first SSO login
- Role mapping: all users get HOPS_USER role initially

### 2. Project Creation
When user joins a cluster:
1. Create project in Hopsworks via API (if available)
2. Or use pre-created shared projects with isolated namespaces
3. Store project mapping in our database

### 3. Access Management
- API keys generated per user/project
- Stored securely in our database
- Provided to users through dashboard

## Environment Variables
```
HOPSWORKS_API_URL=https://your-hopsworks-instance.com
HOPSWORKS_API_KEY=admin_api_key
```

## API Endpoints (TBD)
- POST /api/hopsworks/projects - Create project
- POST /api/hopsworks/users - Provision user
- GET /api/hopsworks/status - Check cluster health