# API Patterns

## Overview

This document describes the API patterns used in the Hopsworks Managed platform for integrating with Hopsworks clusters.

## Authentication

All API routes are protected by Auth0. Admin routes additionally check the `is_admin` flag in the database.

```typescript
// Regular user endpoints
const session = await getSession(req, res);
if (!session?.user) {
  return res.status(401).json({ error: 'Not authenticated' });
}

// Admin endpoints
import { requireAdmin } from '../../../middleware/adminAuth';
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, actualHandler);
}
```

## Hopsworks Integration

### Key Concepts

1. **No Auth0 ID Storage**: Hopsworks doesn't store Auth0 IDs. Users are matched by email address.
2. **API Key Authentication**: Each cluster has an API key stored in our database for authenticating with Hopsworks.
3. **User Mapping**: Users are mapped to clusters via the `user_hopsworks_assignments` table.

### API Endpoints

#### User Information (`/api/user/hopsworks-info`)

Fetches real-time Hopsworks data for the logged-in user:

```typescript
// Response structure
{
  hasCluster: boolean,
  clusterName?: string,
  hasHopsworksUser?: boolean,
  hopsworksUser?: {
    username: string,
    email: string,
    accountType: string,
    status: number,
    maxNumProjects: number,
    numActiveProjects: number,
    activated: string
  },
  projects?: Array<{
    id: number,
    name: string,
    owner: string,
    created: string
  }>
}
```

#### Usage Data (`/api/usage`)

Combines local usage tracking with real Hopsworks data:

```typescript
// Fetches from local database
- CPU/GPU hours
- Storage usage
- API calls

// Fetches from Hopsworks
- Active projects count (real-time)
- User status
```

#### Admin Test Connection (`/api/admin/test-hopsworks`)

Tests connectivity and fetches user data from Hopsworks:

```typescript
// Request
{
  userId: string,  // Auth0 ID
  clusterId: string
}

// Response includes
- Cluster info
- Hopsworks user data
- Projects list
- Cluster statistics
```

## Hopsworks API Client

Located in `src/lib/hopsworks-api.ts`:

### Key Functions

#### `getHopsworksUserByAuth0Id`
```typescript
// Note: Despite the name, matches by email not Auth0 ID
export async function getHopsworksUserByAuth0Id(
  credentials: HopsworksCredentials,
  auth0Id: string,
  userEmail?: string
): Promise<HopsworksUser | null>
```

#### `getUserProjects`
```typescript
export async function getUserProjects(
  credentials: HopsworksCredentials,
  username: string
): Promise<HopsworksProject[]>
```

#### `createHopsworksOAuthUser`
```typescript
// Creates OAuth user in Hopsworks
export async function createHopsworksOAuthUser(
  credentials: HopsworksCredentials,
  email: string,
  firstName: string,
  lastName: string,
  auth0Id: string
): Promise<string>
```

## Data Flow

1. **User Login** → Auth0 authentication
2. **Dashboard Load** → Fetch user's cluster assignment from Supabase
3. **Hopsworks Query** → Use cluster's API key to fetch real-time data
4. **Display** → Show only real data, no placeholders

## Error Handling

- Always gracefully handle Hopsworks API failures
- Fall back to cached/database values when appropriate
- Log errors for debugging but don't expose internal details to users

## Recent Updates

### Dashboard Integration (July 2024)
- Removed all placeholder/mock data from dashboard
- Added `/api/user/hopsworks-info` endpoint for real-time Hopsworks data
- Updated `/api/usage` to fetch actual projects count from Hopsworks
- Dashboard now shows:
  - Real projects count and list
  - Hopsworks username
  - Cluster assignment status
  - Only displays data that actually exists

### Admin Test Button
- Fixed to show real Hopsworks data
- Matches users by email (not Auth0 ID)
- Shows user's actual projects and status

## Best Practices

1. **No Mock Data**: Never return mock or simulated data in production
2. **Email Matching**: Always use email to match users between systems
3. **Real-time Data**: Fetch from Hopsworks for current state, not cached values
4. **Batch Requests**: When possible, fetch all users and filter locally vs making multiple API calls
5. **Error Boundaries**: Each Hopsworks call should have try-catch to prevent cascading failures

## Example: Adding New Hopsworks Data

To add new data from Hopsworks to the dashboard:

1. Update the API endpoint to fetch the data:
```typescript
// In /api/user/hopsworks-info.ts
const newData = await getNewDataFromHopsworks(credentials, username);
```

2. Add to response structure:
```typescript
return res.status(200).json({
  ...existingData,
  newField: newData
});
```

3. Update TypeScript interfaces:
```typescript
interface HopsworksInfo {
  // ... existing fields
  newField?: NewDataType;
}
```

4. Display in UI only if data exists:
```typescript
{hopsworksInfo?.newField && (
  <Card>
    {/* Display new data */}
  </Card>
)}
```

## User Consumption Metrics

### Key Findings

1. **Project Visibility**: `/project` endpoint only shows projects where API key owner is member. Use `/admin/projects` for ALL projects.

2. **Finding User Projects**:
```javascript
// Get user ID first
const user = users.find(u => u.email === "user@example.com");

// Filter projects by creator ID (from admin endpoint)
const userProjects = projects.filter(p => 
  p.creator.href.endsWith(`/${user.id}`)
);
```

3. **Fetching Consumption Data**:
```bash
/api/project/{projectId}/dataset          # Datasets (check .size)
/api/project/{projectId}/jobs             # Jobs  
/api/project/{projectId}/jobs/{id}/executions  # Compute hours (duration/3600000)
/api/project/{projectId}/featurestores    # Feature stores
```

4. **Missing Endpoints** (return 404):
- `/admin/users/{username}/projects`
- `/admin/monitoring/metrics`
- `/admin/audit`

5. **Implementation**: See `/api/admin/usage/[userId]` for complete flow

### Notes
- No direct user consumption API - must aggregate from projects
- Admin API key required for cluster-wide visibility
- Current implementation only finds projects where user is creator (not member)

## Testing

Use the admin panel buttons to verify:
- **"Test API"**: Basic connectivity and user lookup
- **"Get Metrics"**: Full consumption metrics aggregation
- Email-based matching
- API key authentication