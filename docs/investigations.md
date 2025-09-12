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