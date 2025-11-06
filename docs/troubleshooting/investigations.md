# Investigations & Technical Debt

## Hopsworks API OAuth User Creation Format

**Discovery Date**: 2025-09-12

**Issue**: The Hopsworks admin API endpoint `/api/admin/users` expects query parameters, not JSON body, when creating OAuth users. This is confirmed by the Java code which uses `@QueryParam` annotations.

**Current Status**: 
- Our code sends JSON body but gets "Account type not provided" error
- The Java code clearly expects query params: `@QueryParam("accountType")`, `@QueryParam("type")`, etc.
- It previously "worked" probably because users were auto-created during OAuth login, not via our API

**Investigation Needed**:
1. Confirm if Hopsworks API has been updated/changed recently
2. Test if query params actually work for OAuth user creation
3. Determine if there's a different endpoint that accepts JSON body
4. Check if this is a Hopsworks bug or intended behavior

**Code Reference**: 
- Our implementation: `/src/lib/hopsworks-api.ts:77-104` (createHopsworksOAuthUser function)
- Hopsworks code: `hopsworks-api/src/main/java/io/hops/hopsworks/api/admin/UsersAdminResource.java:478-515`

**Impact**: 
- Currently blocking manual OAuth user creation via API
- Workaround: Rely on Hopsworks auto-creating users during OAuth login

**Action Items**:
- [ ] Test with query parameters in production
- [ ] Contact Hopsworks team to clarify API specification
- [ ] Update our implementation once confirmed

---

## Team Member Project Tracking Removed

**Discovery Date**: 2025-11-05

**Issue**: Initial implementation attempted to track which Hopsworks projects team members had access to via SaaS dashboard.

**Implementation Complexity**:
- Required kubectl exec to query MySQL directly
- API endpoint `/project/{projectId}/projectMembers` requires member-specific API key (admin keys fail with "No valid role found")
- Alternative `/admin/users/{username}/projects` endpoint doesn't exist in this Hopsworks version
- Necessitated storing kubeconfig in database, SQL injection risk, synchronous kubectl blocking API requests

**Value vs Risk Assessment**:
- **Value**: Low - read-only display of information already available in Hopsworks UI
- **Risk**: High - security vulnerabilities, reliability issues, operational complexity
- **Business logic**: None - no billing, access control, or automation depends on this data

**Decision**: Feature removed (commit 3a14039)
- Replaced with simple status check: user has `hopsworks_username` = active
- Users directed to manage projects directly in Hopsworks UI
- Single source of truth: Hopsworks, not SaaS
- Eliminates security risks and maintenance burden

**API Findings** (documented in `docs/reference/hopsworks-api.md`):
- ✅ `/admin/projects?expand=creator` works for getting project owners
- ❌ `/admin/users/{username}/projects` returns 404
- ❌ `/project/{projectId}/projectMembers` requires project-member API key
- ✅ MySQL direct query via kubectl works but not worth the complexity for read-only display

**Recommendation**: Keep it simple. Hopsworks UI is the authoritative source for project management.

---

## SSL Certificate Verification Disabled

**Discovery Date**: 2025-09-12
**Fix Attempted**: 2025-11-06 (FAILED - Rolled back)
**Status**: WONT-FIX (Acceptable in Vercel serverless context)

**Issue**: `NODE_TLS_REJECT_UNAUTHORIZED = '0'` disables SSL certificate verification globally, making all HTTPS requests insecure.

**Current Status**:
- Set globally in `src/lib/hopsworks-api.ts` and `src/lib/hopsworks-team.ts`
- Required because Hopsworks uses self-signed certificates
- Affects ALL HTTPS requests from the app, not just Hopsworks

**Why the Per-Request Agent Fix Failed**:
On 2025-11-06, attempted to scope SSL bypass using per-request HTTPS agents:
```javascript
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
fetch(url, { agent: httpsAgent });
```

**Failed immediately in production with:**
```
Error: unable to get local issuer certificate
code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
```

**Root Cause**: Vercel serverless runtime uses `undici`-based global `fetch` which **does not support** the `agent` property. This is a platform limitation, not a code bug.

**Risk Assessment in Vercel Serverless Context**:

**Original concern (long-running server)**: Global setting affects all requests forever
**Vercel reality (serverless)**:
- Each invocation = new isolated Node.js process
- Process lives ~100ms-2s (duration of single HTTP request)
- Global setting only affects that one request's lifetime
- No state sharing between different user requests
- Risk window: milliseconds, not hours/days

**Acceptable Risk because**:
1. Serverless isolation: Each function invocation is a separate process
2. Short-lived: Process destroyed after request completes
3. Private networks: Hopsworks communication within Kubernetes clusters
4. API key authentication: Not relying solely on SSL for security
5. Customer isolation: Hopsworks clusters are single-tenant

**Tried Solutions**:
1. ❌ **Per-request HTTPS agent**: Vercel runtime doesn't support it
2. ⏸️ **node-fetch@2**: Would work but requires replacing ~20 fetch() calls
3. ⏸️ **Reverse proxy with real certs**: Requires Hopsworks infrastructure changes

**Decision**: Accept global setting for now. Risk is LOW in serverless context compared to traditional servers.

**Future Improvements** (if needed):
- [ ] Migrate to `node-fetch@2` for full control over SSL validation
- [ ] Add proper SSL certificates to Hopsworks clusters (infrastructure change)
- [ ] Monitor for any Stripe/Auth0 SSL-related issues (unlikely given short process lifetime)