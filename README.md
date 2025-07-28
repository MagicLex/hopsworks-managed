# Hopsworks Managed Clusters

A managed service platform for Hopsworks clusters with Auth0 authentication and Supabase for data persistence.

## Architecture

- **Authentication**: Auth0 SDK v3 (Note: Must use v3, not v4)
- **Database**: Supabase for user data, cluster memberships, and billing
- **Frontend**: Next.js 15.4 with TypeScript
- **UI**: tailwind-quartz component library
- **Billing**: Stripe with hybrid prepaid/postpaid support
- **Infrastructure**: Vercel with cron jobs for usage collection

## Environment Variables

Create a `.env.local` file with:

```env
# Auth0 Configuration (Authentication)
AUTH0_SECRET=<generate with: openssl rand -hex 32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<your-auth0-domain>
AUTH0_CLIENT_ID=<your-auth0-client-id>
AUTH0_CLIENT_SECRET=<your-auth0-client-secret>

# Supabase Configuration (Database)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-key>

# Hopsworks Configuration
HOPSWORKS_API_URL=<your-hopsworks-api-url>
HOPSWORKS_API_KEY=<your-hopsworks-api-key>

# Stripe Configuration  
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-webhook-signing-secret>

# Cron Security
CRON_SECRET=<random-secret-for-cron-jobs>
```

## Development

```bash
npm install
npm run dev
```

## Production Deployment

For Vercel deployment, ensure all environment variables are set without trailing newlines:
- `AUTH0_BASE_URL`: Must be `https://your-domain.vercel.app` (no trailing slash)
- `AUTH0_ISSUER_BASE_URL`: Must include `https://` prefix

## Database Schema

The Supabase database stores:
- User cluster memberships
- Billing and subscription status
- Cluster configurations and endpoints
- Usage tracking for billing

## Admin Interface

Hidden admin interface available at `/admin47392` for managing users and clusters.

### Setup Admin Access:
1. Run database migrations in Supabase SQL editor
2. Grant admin access: `UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';`
3. Access admin panel when logged in as admin user

### Admin Features:
- View all users with usage metrics and credits
- Manage Hopsworks clusters (capacity, API endpoints)
- Monitor user-cluster assignments

## Documentation

- [Database Patterns](docs/DATABASE_PATTERNS.md) - Schema design, query patterns, and best practices
- [Billing Architecture](docs/BILLING_ARCHITECTURE.md) - Complete billing system overview
- [Billing Implementation](docs/BILLING_IMPLEMENTATION.md) - Current status and what's missing
- [Stripe Setup](docs/STRIPE_SETUP.md) - Step-by-step Stripe configuration