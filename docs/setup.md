# Setup Guide

## Prerequisites
- Node.js 18+
- Supabase account
- Vercel account (for Auth0 integration)

## Initial Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Supabase
The `.env.local` file has been created with your Supabase credentials.

### 3. Run Database Migrations
Go to your Supabase SQL editor:
https://supabase.com/dashboard/project/pahfsiosiuxdkiebepav/sql/new

Copy and run the migration from `supabase/migrations/001_initial_schema.sql`

This creates:
- `user_profiles` table
- `clusters` table  
- `subscriptions` table
- Row Level Security policies
- Automatic user profile creation trigger

### 4. Start Development Server
```bash
npm run dev
```

## Testing Authentication

1. Visit http://localhost:3000
2. Click "Join Cluster" on the Small deployment
3. Click "Sign In with Auth0"
4. Complete authentication on Auth0
5. You'll see your email in the top-right corner

**Note**: You need to add the Auth0 Client Secret to `.env.local` from your Auth0 dashboard.

## Next Steps

### Auth0 Setup

1. **Generate AUTH0_SECRET**:
```bash
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

2. **Update .env.local**:
- Copy the client secret from Auth0 dashboard
- Add the generated AUTH0_SECRET
- For production, update AUTH0_BASE_URL to your Vercel URL

3. **Auth0 Application Settings**:
- Allowed Callback URLs: `http://localhost:3000/api/auth/callback, https://hopsworks-managed.vercel.app/api/auth/callback`
- Allowed Logout URLs: `http://localhost:3000/, https://hopsworks-managed.vercel.app/`
- Allowed Web Origins: `http://localhost:3000, https://hopsworks-managed.vercel.app`

### Deploy to Production
See [deployment.md](deployment.md) for detailed Vercel deployment instructions.

### Stripe Integration (Payments)
- Set up Stripe account
- Add Stripe keys to environment variables
- Implement payment processing in DeployModal