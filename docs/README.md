# Hopsworks Managed - Documentation

## What This Is
A SaaS frontend for Hopsworks ML platform. Users sign up, add payment method, and get access to a managed Hopsworks instance on pay-as-you-go pricing.

## Documentation

### Core Docs
- [Architecture Overview](ARCHITECTURE.md) - System design and tech stack
- [Setup Guide](SETUP_GUIDE.md) - Local development and deployment
- [Database Patterns](DATABASE_PATTERNS.md) - Schema and query patterns

### Key Features
- Pay-as-you-go billing ($0.10/CPU hour, $0.50/GPU hour)
- Multi-cluster support with auto-assignment
- Admin dashboard for user and cluster management
- Usage tracking and billing dashboard
- Auth0 integration for authentication

## Quick Links
- Admin Panel: `/admin47392` (requires admin access)
- [Main README](../README.md) - Project overview
- [Known Issues](../KNOWN_ISSUES.md) - Current limitations
  contexts/       # Auth context
  hooks/          # Custom React hooks
  lib/            # Utilities (Supabase client, types)
docs/             # Documentation
sql/              # Database schema
```

## Getting Started
1. Clone repo
2. `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in credentials
4. Run SQL schema on Supabase: `psql -h YOUR_DB_URL < sql/schema.sql`
5. `npm run dev`

## Key Flows
1. **User Registration**: Auth0 → Webhook → Create user in Supabase
2. **Login**: Auth0 → Sync user data → Show dashboard
3. **Usage Tracking**: Hopsworks → Our API → Store in Supabase → Display in UI

## API Endpoints
- `/api/usage` - Get user's current usage metrics
- `/api/instance` - Get Hopsworks instance details
- `/api/billing` - Get billing history and current costs
- `/api/auth/sync-user` - Sync Auth0 user to Supabase

## Environment Variables
```
AUTH0_SECRET          # Auth0 config
AUTH0_BASE_URL
AUTH0_ISSUER_BASE_URL
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET

NEXT_PUBLIC_SUPABASE_URL     # Supabase config
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

AUTH0_WEBHOOK_SECRET         # For user registration webhook
```

## Development Notes
- No hardcoded values - everything comes from database
- Users without data see zeros/empty states
- All monetary values in USD
- One Hopsworks instance per user (MVP limitation)

## Useful Commands
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run linter
```

See individual docs for:
- [Database Schema](./database.md)
- [Auth Setup](./auth.md)
- [Supabase Setup](./supabase-setup.md)