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

**Issue**: `NODE_TLS_REJECT_UNAUTHORIZED = '0'` disables SSL certificate verification globally, making all HTTPS requests insecure.

**Current Status**:
- Set globally in `src/lib/hopsworks-api.ts` and `src/lib/hopsworks-team.ts`
- Required because Hopsworks uses self-signed certificates
- Affects ALL HTTPS requests from the app, not just Hopsworks

**Security Risk**: HIGH
- Vulnerable to man-in-the-middle attacks
- Affects Stripe API calls, Auth0 calls, and any other HTTPS requests
- Production security vulnerability

**Better Solutions**:
1. **Option 1**: Add Hopsworks certificate to trusted certificates
   ```javascript
   const https = require('https');
   const ca = fs.readFileSync('hopsworks-ca.pem');
   const agent = new https.Agent({ ca });
   ```

2. **Option 2**: Only disable for Hopsworks requests
   ```javascript
   const agent = new https.Agent({ 
     rejectUnauthorized: false // Only for this specific agent
   });
   fetch(url, { agent }); // Only affects this request
   ```

3. **Option 3**: Get proper SSL certificate for Hopsworks

**Action Items**:
- [ ] Get Hopsworks CA certificate
- [ ] Implement per-request SSL bypass instead of global
- [ ] Test with proper certificate validation
- [ ] Remove global NODE_TLS_REJECT_UNAUTHORIZED