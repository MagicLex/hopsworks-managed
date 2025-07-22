# Deployment Guide

## Prerequisites
- Vercel CLI installed (`npm i -g vercel`)
- Auth0 application configured
- Supabase project created

## Environment Variables Setup

### 1. Copy Client Secret from Auth0
Go to your Auth0 dashboard and copy the Client Secret for your application.

### 2. Set Environment Variables in Vercel

```bash
# Link your project to Vercel (if not already linked)
vercel link

# Set environment variables for production
vercel env add AUTH0_SECRET production
vercel env add AUTH0_BASE_URL production
vercel env add AUTH0_ISSUER_BASE_URL production
vercel env add AUTH0_CLIENT_ID production
vercel env add AUTH0_CLIENT_SECRET production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

### 3. Environment Variable Values

When prompted, enter these values:

```bash
AUTH0_SECRET=IBjXzcv6azgKtR3C3SmGyXE5T+qbAdjgOwmSEc0ec10=
AUTH0_BASE_URL=https://hopsworks-managed.vercel.app
AUTH0_ISSUER_BASE_URL=https://dev-fur3a3gej0xmnk7f.eu.auth0.com
AUTH0_CLIENT_ID=fKsp6ZBzMPuxk79fP1C1TJ4F2TBOfRvZ
AUTH0_CLIENT_SECRET=<paste-from-auth0-dashboard>
NEXT_PUBLIC_SUPABASE_URL=https://pahfsiosiuxdkiebepav.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaGZzaW9zaXV4ZGtpZWJlcGF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjQwNDEsImV4cCI6MjA2NTY0MDA0MX0.IcSMf-Ve_lz9j3eNgxIa-s-qgKWSZxwb67dpCCFoLrQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaGZzaW9zaXV4ZGtpZWJlcGF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDA2NDA0MSwiZXhwIjoyMDY1NjQwMDQxfQ.bFPX-fAiP1WRiQFxwyLK2_s_bF8wTKj32ncPllo4ndc
```

## Deploy to Vercel

```bash
# Deploy to production
vercel --prod
```

## Post-Deployment

### Update Auth0 Settings
In your Auth0 application settings, ensure these URLs are configured:

- **Allowed Callback URLs**: 
  - `https://hopsworks-managed.vercel.app/api/auth/callback`
  - `http://localhost:3000/api/auth/callback` (for local dev)

- **Allowed Logout URLs**: 
  - `https://hopsworks-managed.vercel.app/`
  - `http://localhost:3000/` (for local dev)

- **Allowed Web Origins**: 
  - `https://hopsworks-managed.vercel.app`
  - `http://localhost:3000` (for local dev)

### Test Authentication
1. Visit your deployed app
2. Click "Join Cluster" on Small deployment
3. Click "Sign In with Auth0"
4. Complete authentication
5. Verify user appears in top-right corner

## Troubleshooting

### Common Issues

1. **Callback URL Mismatch**: Ensure Auth0 callback URLs match exactly
2. **Missing Environment Variables**: Check all variables are set in Vercel dashboard
3. **CORS Issues**: Verify Allowed Web Origins in Auth0

### Verify Environment Variables

```bash
# List all environment variables
vercel env ls

# Pull environment variables for local development
vercel env pull .env.local
```