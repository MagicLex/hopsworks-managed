# Authentication Architecture

## Overview
Hopsworks-managed uses Auth0 for authentication, which will also serve as the OAuth2 provider for Hopsworks SSO.

## Current Implementation

### Auth0 Setup
- Centralized authentication via Auth0
- Automatic user creation on first login
- Session management handled by Auth0
- User data stored in Supabase after authentication

### Components
- `AuthContext`: React context wrapping Auth0's useUser hook
- `AuthModal`: Modal that redirects to Auth0 login
- `UserProfile`: User dropdown showing Auth0 user info
- `/api/auth/[...auth0]`: Next.js API route handling Auth0 callbacks

### Authentication Flow
1. User clicks "Join Cluster" on Small deployment
2. If not authenticated, shows AuthModal
3. User clicks "Sign In with Auth0"
4. Redirected to Auth0 Universal Login
5. After successful auth, redirected back to app
6. User can proceed with cluster provisioning

### Environment Variables
```bash
AUTH0_SECRET=<generated-secret>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-fur3a3gej0xmnk7f.eu.auth0.com
AUTH0_CLIENT_ID=fKsp6ZBzMPuxk79fP1C1TJ4F2TBOfRvZ
AUTH0_CLIENT_SECRET=<from-auth0-dashboard>
```

## Future Hopsworks Integration
- Auth0 will act as OAuth2 provider for Hopsworks
- Users will auto-provision in Hopsworks on first SSO login
- Single sign-on across hopsworks-managed and Hopsworks clusters