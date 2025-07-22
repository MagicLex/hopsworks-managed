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
3. Click "Sign In to Continue"
4. Create a new account or sign in
5. You'll see your email in the top-right corner

## Next Steps

### Auth0 Integration (Production)
```bash
vercel integration add auth0
```

This will:
- Set up Auth0 as OAuth2 provider
- Configure environment variables automatically
- Enable SSO for Hopsworks

### Stripe Integration (Payments)
- Set up Stripe account
- Add Stripe keys to environment variables
- Implement payment processing in DeployModal