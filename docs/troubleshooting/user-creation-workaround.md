# Hopsworks User Creation Flow

## Status: ✅ FIXED (2025-11-04)

The `POST /admin/users` endpoint for creating OAuth users now works correctly after:
1. **PR #2670** merged by Ermias (logicalclocks/hopsworks-ee)
2. **Admin server restart** required to deploy SNAPSHOT changes

## Working Solution

### API Call

```bash
curl -k -X POST \
  "https://cluster/hopsworks-api/api/admin/users?accountType=REMOTE_ACCOUNT_TYPE&email={email}&givenName={firstName}&surname={lastName}&maxNumProjects={quota}&subject={auth0UserId}&clientId={AUTH0_CLIENT_ID}&type=OAUTH2" \
  -H "Authorization: ApiKey {ADMIN_API_KEY}"
```

### Key Points
- **Query params only** - No JSON body
- **No `status` param** - Creates with default ACTIVATED status
- **Returns 201** with user object including generated username
- **Subject format** - Must be URL-encoded if contains `|` (e.g., `auth0%7C123`)

### Example Response
```json
{
  "uuid": "fKsp6ZBzMPuxk79fP1C1TJ4F2TBOfRvZ.auth0|testfinal789",
  "givenName": "TestFinal",
  "surname": "User",
  "email": "testfinal2@example.com",
  "username": "testfina"
}
```

## Previous Workaround (No Longer Needed)

Use "Access Cluster" as gate for user setup completion.

### Flow

1. User signup → Supabase user created
2. User sees: **"Complete setup by accessing your cluster"**
3. User clicks "Access Cluster" → OAuth flow
4. Hopsworks creates user, generates username (e.g., `lex20000`)
5. User redirected to Hopsworks UI
6. `/api/auth/sync-user` (health check):
   - Fetches username from Hopsworks
   - Updates `hopsworks_username` in Supabase
   - Checks `maxNumProjects` (current vs expected)
   - Updates if needed (0 → 5 for paying users)
7. For team members with `auto_assign_projects = true`:
   - Call `/api/team/complete-setup` to trigger project assignments
8. Done

### Implementation

**Frontend:**
- Show message if `hopsworks_username` is NULL
- "Access Cluster" button
- After redirect back, poll `/api/user/status` to check if username populated
- Trigger `/api/team/complete-setup` if applicable

**Backend:**
- `/api/auth/sync-user` already handles username sync + maxNumProjects update
- Add `/api/team/complete-setup` endpoint to run pending project assignments

### Race Condition Handling

**Problem:** User lands in Hopsworks before health check runs.

**Mitigation:** `/api/auth/sync-user` runs on every page load and corrects:
- Missing username in Supabase
- Incorrect `maxNumProjects` (updates via PUT /admin/users/{id})

User might see wrong quota for 1-2 seconds, but it gets fixed automatically.

## Implementation Guide

### New Flow (Recommended)

1. User signup → Supabase user created
2. Backend immediately calls `POST /admin/users` with correct `maxNumProjects`
3. Hopsworks creates OAuth user with username
4. Response contains `username` → store in Supabase
5. For team members: auto-assign to projects immediately
6. User can "Access Cluster" → already exists with correct settings
7. No race conditions, no health check fixes needed

### Code Changes Needed

**Update `src/lib/cluster-assignment.ts`:**

```typescript
// Replace createHopsworksOAuthUser implementation
const response = await fetch(
  `${cluster.api_url}/hopsworks-api/api/admin/users?` +
  new URLSearchParams({
    accountType: 'REMOTE_ACCOUNT_TYPE',
    email: user.email,
    givenName: firstName,
    surname: lastName,
    maxNumProjects: maxProjects.toString(),
    subject: userId,
    clientId: process.env.AUTH0_CLIENT_ID!,
    type: 'OAUTH2'
  }),
  {
    method: 'POST',
    headers: { 'Authorization': `ApiKey ${cluster.api_key}` }
  }
);

if (!response.ok) {
  const error = await response.json();
  throw new Error(`Failed to create Hopsworks user: ${error.usrMsg || error.errorMsg}`);
}

const hopsworksUser = await response.json();
// hopsworksUser.username now available immediately
```

### Cleanup Tasks

Once implemented, remove:
- "Access Cluster" gate requirement from frontend
- `/api/auth/sync-user` maxNumProjects correction logic
- Race condition mitigation code

### Benefits

- ✅ No user interaction required
- ✅ Correct quota from the start
- ✅ Username available immediately
- ✅ Team member auto-assignment works on first try
- ✅ Cleaner code, no workarounds

## Troubleshooting

### Common Issues

**404 Not Found**
- Check that Auth0 is configured as identity provider on cluster
- Verify `clientId` matches Auth0 configuration
- Ensure admin server has been restarted after upgrade

**500 NPE on groups**
- Older versions had a bug with empty groups
- Fixed in PR #2670, ensure cluster is updated

**422 Account type not provided**
- Using JSON body instead of query params
- Must use query params only

### Testing

```bash
# Verify endpoint works
curl -k -X POST \
  "https://cluster/hopsworks-api/api/admin/users?accountType=REMOTE_ACCOUNT_TYPE&email=test@example.com&givenName=Test&surname=User&maxNumProjects=5&subject=auth0%7Ctest123&clientId={AUTH0_CLIENT_ID}&type=OAUTH2" \
  -H "Authorization: ApiKey {ADMIN_API_KEY}"

# Should return 201 with:
# {"uuid":"...","givenName":"Test","surname":"User","email":"test@example.com","username":"test1234"}
```

## Timeline

- **2025-11-04 15:00** - HWORKS-2426 Jira created
- **2025-11-04 16:36** - PR #2670 & #1710 merged
- **2025-11-04 16:00** - Admin server restart required for SNAPSHOT deploy
- **2025-11-04 16:05** - Verified working on lex-saas.dev-cloud.hopsworks.ai
