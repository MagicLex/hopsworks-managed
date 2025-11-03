# Hopsworks User Creation Flow

## The Problem

`POST /admin/users` has a bug (Jira created by Ermias):
- Expects query params, not JSON body
- Returns 404 even with correct query params
- Bug confirmed in Hopsworks 4.6

OAuth users are currently only created via OAuth callback flow when accessing the cluster.

## Current Workaround (Until Bug Fixed)

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

## Future Solution (When Bug Fixed)

Once `POST /admin/users` works with query params:

### API Call

```bash
curl -k -X POST \
  "https://cluster/hopsworks-api/api/admin/users?accountType=REMOTE_ACCOUNT_TYPE&type=OAUTH2&clientId={AUTH0_CLIENT_ID}&subject={auth0UserId}&email={email}&givenName={firstName}&surname={lastName}&maxNumProjects={quota}&status=ACTIVATED" \
  -H "Authorization: ApiKey {ADMIN_API_KEY}"
```

### Flow

1. User signup → Supabase user created
2. Backend immediately calls `POST /admin/users` with correct `maxNumProjects`
3. Hopsworks creates OAuth user with username
4. Response contains `username` → store in Supabase
5. For team members: auto-assign to projects immediately
6. User can "Access Cluster" → already exists with correct settings
7. No race conditions, no health check fixes needed

### Implementation Changes

**Replace in `src/lib/cluster-assignment.ts` (line 90-142):**

```typescript
// OLD: Try/catch that fails
const hopsworksUser = await createHopsworksOAuthUser(...)

// NEW: Use query params
const response = await fetch(
  `${cluster.api_url}/hopsworks-api/api/admin/users?` +
  new URLSearchParams({
    accountType: 'REMOTE_ACCOUNT_TYPE',
    type: 'OAUTH2',
    clientId: process.env.AUTH0_CLIENT_ID!,
    subject: userId,
    email: user.email,
    givenName: firstName,
    surname: lastName,
    maxNumProjects: maxProjects.toString(),
    status: 'ACTIVATED'
  }),
  {
    method: 'POST',
    headers: { 'Authorization': `ApiKey ${cluster.api_key}` }
  }
);

const hopsworksUser = await response.json();
// hopsworksUser.username now available immediately
```

**Remove:**
- "Access Cluster" gate requirement
- `/api/auth/sync-user` maxNumProjects correction logic
- Race condition mitigation code

### Benefits

- ✅ No user interaction required
- ✅ Correct quota from the start
- ✅ Username available immediately
- ✅ Team member auto-assignment works on first try
- ✅ Cleaner code, no workarounds

## Testing the Fix

Once deployed, test with:

```bash
# Should return 201 with user object including username
curl -k -X POST \
  "https://cluster/hopsworks-api/api/admin/users?accountType=REMOTE_ACCOUNT_TYPE&type=OAUTH2&clientId=xxx&subject=test|123&email=test@example.com&givenName=Test&surname=User&maxNumProjects=5&status=ACTIVATED" \
  -H "Authorization: ApiKey xxx"
```

Expected response:
```json
{
  "uuid": "clientId.subject",
  "fname": "Test",
  "lname": "User",
  "email": "test@example.com",
  "username": "test0000"
}
```

## Current Status

- ❌ API broken in Hopsworks 4.6
- ✅ Workaround implemented with "Access Cluster" gate
- ⏳ Jira created, waiting for fix
