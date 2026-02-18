# Known Issues & Solutions

## Build/Deployment Issues

### 1. React Unescaped Entities
**Error**: `Error: '`' can be escaped with &apos;, &lsquo;, &#39;, &rsquo;. react/no-unescaped-entities`

**Solution**: Replace apostrophes with `&apos;` in JSX text content:
```jsx
// ❌ Bad
<Text>You'll be logged in</Text>

// ✅ Good
<Text>You&apos;ll be logged in</Text>
```

### 2. Auth0 Environment Variables in Vercel
**Error**: `"baseURL" must be a valid uri`

**Solution**: Environment variables in Vercel must not have trailing newlines or spaces:
- ❌ `AUTH0_BASE_URL`: `https://hopsworks-managed.vercel.app\n`
- ✅ `AUTH0_BASE_URL`: `https://hopsworks-managed.vercel.app`
- ❌ `AUTH0_ISSUER_BASE_URL`: `dev-fur3a3gej0xmnk7f.eu.auth0.com`
- ✅ `AUTH0_ISSUER_BASE_URL`: `https://dev-fur3a3gej0xmnk7f.eu.auth0.com`

**Important**: Use Vercel dashboard to set variables, not CLI with echo/printf.

### 3. Tailwind-Quartz Component API Changes
**Error**: Component props not recognized (variant, size, wrap, etc.)

**Solution**: Check actual component API:
```jsx
// ❌ Bad - These props don't exist
<Button variant="primary" size="sm" />
<Flex wrap="wrap" />

// ✅ Good - Use correct props
<Button intent="primary" />
<Flex className="flex-wrap" />
```

### 4. Auth0 SDK Version
**Error**: Import errors with @auth0/nextjs-auth0 v4

**Solution**: Must use Auth0 SDK v3, not v4:
```json
"@auth0/nextjs-auth0": "^3.8.0"  // NOT ^4.x.x
```

## Authentication Issues

### 1. Static Export with API Routes
**Error**: API routes don't work with `output: 'export'`

**Solution**: Remove static export from next.config.js:
```js
// Remove this line:
// output: 'export',
```

### 2. Auth0 Callback URLs
**Issue**: Auth0 redirects fail

**Solution**: Add all callback URLs to Auth0 dashboard:
- `https://hopsworks-managed.vercel.app/api/auth/callback`
- `https://hopsworks-managed.vercel.app/api/auth/login`
- `https://hopsworks-managed.vercel.app/`

## Development Tips

### 1. Environment Variables
Create `.env.local` with:
```env
AUTH0_SECRET=<32-byte-hex>  # Generate: openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000  # No trailing slash!
AUTH0_ISSUER_BASE_URL=https://your-domain.auth0.com  # With https://
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
```

### 2. TypeScript Strict Checks
When using tailwind-quartz components, check the actual exported types:
```bash
# Check what's actually exported
grep -r "export" node_modules/tailwind-quartz/dist/
```

### 3. Next.js Build Errors
Always run locally before deploying:
```bash
npm run build
npm run start
```

## Hopsworks Integration

### 1. Project Quota Counts Created, Not Active (Workaround Active)

**Status**: Workaround active, pending Hopsworks fix

**Issue**: Hopsworks counts **created** projects against `maxNumProjects` quota, not **active** ones. When a user deletes a project, the quota slot is permanently consumed. A free user (limit=1) who creates and deletes a project can never create another one.

**Root cause**: No Hopsworks -> SaaS webhook exists. The bridge only discovers deletions by polling.

**Workaround**: Three changes work together:

1. **`project-sync.ts`** — When the cron detects a project was deleted (marked inactive), it bumps `maxNumProjects` by the number of deleted projects via `updateUserProjectLimit`.

2. **One-way ratchet on `maxNumProjects`** — Every call site that writes `maxNumProjects` now uses a `<` guard instead of `!==`. This means the value can only go UP, never be reset down. This prevents Health Check 5, cluster assignment, Stripe webhooks, and billing APIs from undoing the workaround bump.

   **Files with the ratchet guard** (11 call sites total):
   - `src/pages/api/auth/sync-user.ts` — Health Check 5
   - `src/lib/cluster-assignment.ts` — 2 locations
   - `src/pages/api/webhooks/stripe.ts` — 3 locations (upgrade, sub deleted, payment removed)
   - `src/pages/api/billing.ts` — 2 locations (upgrade, downgrade)
   - `src/pages/api/billing/setup-payment.ts` — 1 location
   - `src/lib/project-sync.ts` — workaround bump (structurally additive)
   - `src/pages/api/admin/fix-project-quotas.ts` — one-off fix

3. **`hopsworks-info.ts`** — Always fetches projects fresh from Hopsworks instead of using cache, so deleted projects never show in the UI.

**Important for future developers**: If you add a new call to `updateUserProjectLimit`, you **MUST** follow the ratchet pattern:
```typescript
const hwUser = await getHopsworksUserById(credentials, userId);
if (hwUser && (hwUser.maxNumProjects ?? 0) < desiredLimit) {
  await updateUserProjectLimit(credentials, userId, desiredLimit);
}
```
Never use `!==` — it will reset the workaround and lock users out of creating projects.

**One-off fix for existing users**: `POST /api/admin/fix-project-quotas`
- Finds all users with inactive (deleted) projects
- Computes `baseLimit + deletedCount` (idempotent — safe to run multiple times)
- Supports `{ "dryRun": true }` to preview before applying
- See [Admin Tools](#fix-project-quotas) below

**TODO**: Remove workaround when Hopsworks counts active projects instead of created.

### 2. SSO Configuration
Hopsworks Identity Provider needs:
- Connection URL: `https://dev-fur3a3gej0xmnk7f.eu.auth0.com`
- Email claim: `email`
- Given name claim: `given_name`
- Family name claim: `family_name`

### 2. CORS Issues
If CORS errors occur with Hopsworks API:
- Add your domain to Hopsworks allowed origins
- Use server-side API routes to proxy requests

### 3. Project Namespace Mismatch (Billing Impact)

**Status**: ✅ Fixed (2025-01-21)

**Issue** (was): Project names stored with wrong namespace format, causing billing lookup failures.

- Hopsworks project names use underscores: `my_project`
- Kubernetes namespaces use hyphens: `my-project`
- We stored `project_name` as namespace, but OpenCost reports K8s namespaces

**Fix**: Upstream PR [HWORKS-2566](https://github.com/logicalclocks/hopsworks-ee/pull/2780) added `namespace` field to admin API. We now use `p.namespace` directly in:
- `src/types/api.ts` - `HopsworksProject.namespace` (shared type)
- `src/lib/hopsworks-api.ts` - `HopsworksProject.namespace` (internal type)
- `src/lib/project-sync.ts` - with defensive validation
- `src/pages/api/user/hopsworks-info.ts` - with defensive validation
- `src/pages/api/team/owner-projects.ts`
- `src/components/admin/ProjectRoleManager.tsx` - UI display

**Defensive validation**: Projects without `namespace` field are logged as `[BILLING]` errors and skipped to prevent corrupt billing data.

**Note**: Existing projects in DB may have stale namespace values. Run project sync to update: `POST /api/cron/sync-projects`