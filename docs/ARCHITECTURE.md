# Architecture Overview

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **UI Components**: tailwind-quartz
- **Authentication**: Auth0
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Key Design Decisions

### Authentication Pattern
- Auth0 handles all authentication
- Supabase stores application data
- Users synced on first login via webhook
- Admin status managed in Supabase

### Database Design
- Service role key for API operations
- RLS policies allow full access for service role
- Authorization logic in application layer
- See [Database Patterns](DATABASE_PATTERNS.md) for details

### Billing Model
- Pay-as-you-go: $0.10/CPU hour, $0.50/GPU hour
- Credits system for prepayment
- Daily usage tracking
- Future: Stripe integration

### Multi-Cluster Architecture
- Two distinct cluster concepts:
  - **`clusters`** table: Individual user deployments/projects
  - **`hopsworks_clusters`** table: Hopsworks endpoints (e.g., demo.hops.works)
- Users are assigned to a hopsworks_cluster endpoint
- Auto-assignment based on capacity
- Clusters have max_users limit
- Load balancing across endpoints

## Security
- All API routes protected by Auth0
- Admin routes require is_admin flag
- Database accessed only via service role
- No direct database access from frontend