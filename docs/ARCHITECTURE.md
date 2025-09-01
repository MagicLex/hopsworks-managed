# Architecture Overview

## Tech Stack
- **Frontend**: Next.js 15.4 (Pages Router), TypeScript
- **UI**: tailwind-quartz component library
- **Auth**: Auth0 SDK v3 (MUST use v3, not v4)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (live integration)
- **Hosting**: Vercel with cron jobs
- **Cost Tracking**: OpenCost in Kubernetes cluster

## Key Flows

### User Signup
1. Auth0 authentication
2. Auth0 webhook → Creates user in database and Stripe customer (NOT subscription yet)
3. User must add payment method before cluster assignment
4. After payment method added → Auto-assigns to available Hopsworks cluster
5. During cluster assignment → Creates OAuth user in Hopsworks with:
   - Account owners: 5 project limit
   - Team members: 0 project limit
6. Stores `hopsworks_user_id` and `hopsworks_username` in database

### Team Management
1. Account owners can invite team members via email
2. Team members join through invitation links
3. Team member usage is billed to account owner
4. Account owners manage team through dashboard

### Cost Collection (Hourly via OpenCost)
1. Cron job runs every hour on Vercel
2. For each active cluster:
   - Uses `kubectl exec` to query OpenCost API inside cluster
   - Gets costs per namespace for the last hour
   - No external exposure needed (secure)
3. Maps namespaces to users via `user_projects` table
4. Accumulates hourly costs in `usage_daily` table
5. Updates `project_breakdown` JSONB with per-project details
6. Deducts from credits for prepaid users

### OpenCost Integration
```
┌─────────────┐     kubectl exec      ┌──────────────┐
│   Vercel    │─────────────────────▶│  OpenCost    │
│  Cron Job   │                       │  (in cluster)│
└─────────────┘                       └──────────────┘
      │                                      │
      │                                      │ Query costs
      ▼                                      ▼
┌─────────────┐                       ┌──────────────┐
│  Database   │                       │  Namespaces  │
│ usage_daily │◀──────────────────────│   (costs)    │
└─────────────┘    Map & Store        └──────────────┘
```

### Billing
- **Postpaid** (default): OpenCost usage synced to Stripe daily for monthly invoicing
- **Prepaid** (opt-in): Users buy credits, OpenCost costs deducted daily
- Hybrid model supports both simultaneously
- Team member project costs aggregated to account owner
- All costs come from OpenCost (actual infrastructure costs)

## Database Schema

### Core Tables
- **`users`** - Auth0 ID as primary key, includes:
  - `hopsworks_username` - Username in Hopsworks
  - `hopsworks_user_id` - Internal Hopsworks user ID for API calls
  - `account_owner_id` - Links team members to account owners
  - `stripe_customer_id` - Stripe customer (only for account owners)
- **`team_invites`** - Pending team invitations with 7-day expiration

### Cluster Management
- **`hopsworks_clusters`** - Shared cluster endpoints with kubeconfig
- **`user_hopsworks_assignments`** - Maps users to clusters, includes:
  - `hopsworks_user_id` - For API updates
  - `hopsworks_username` - For reference
  - `assigned_by` - Tracks manual vs automatic assignment

### Billing Tables
- **`user_projects`** - Maps Kubernetes namespaces to users (NEW)
- **`usage_daily`** - Daily aggregated costs from OpenCost
- **`user_credits`** - Prepaid credit tracking

### Key Changes from Legacy
- Replaced hardcoded pricing with OpenCost actual costs
- Added `user_projects` for namespace → user mapping
- Added `opencost_*` columns to `usage_daily`
- Changed from 15-minute to hourly collection
- Uses `kubectl exec` instead of metrics-server API

## Hopsworks Integration

### User Creation Flow
1. **No Hopsworks user on signup** - Only database user created
2. **Hopsworks user created during cluster assignment** after payment verified
3. **Project limits**:
   - Billing users (account owners): 5 projects (`maxNumProjects: 5`)
   - Team members: 0 projects (`maxNumProjects: 0`)
   - Limits enforced by Hopsworks, controlled by hopsworks-managed

### OAuth Authentication
- Hopsworks configured to accept Auth0 OAuth tokens
- Uses Auth0 `CLIENT_ID` for OAuth user creation
- Subject ID links Auth0 identity to Hopsworks user

### Project Access
- **Account owners** can create up to 5 projects
- **Team members** cannot create projects but can be added to owner's projects
- Project membership managed within Hopsworks UI
- Future: Group mapping API for automatic team access

## Security
- All API routes protected by Auth0
- Admin routes check `is_admin` flag in DB
- Service role key for Supabase operations
- Kubeconfig stored encrypted in DB
- **OpenCost not exposed externally** - accessed via kubectl exec
- Team members cannot access billing information

## Deployment Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Vercel (Frontend + API)           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │  Next.js   │  │  API       │  │  Cron Jobs │      │
│  │  Pages     │  │  Routes    │  │  (Hourly)  │      │
│  └────────────┘  └────────────┘  └────────────┘      │
└──────────────────────────────────────────────────────┘
         │              │                │
         │              │                │ kubectl exec
         ▼              ▼                ▼
┌──────────────┐ ┌──────────────┐  ┌──────────────┐
│    Auth0     │ │   Supabase   │  │  Kubernetes  │
│              │ │   Database   │  │   Cluster    │
└──────────────┘ └──────────────┘  │ ┌──────────┐ │
                                   │ │ OpenCost │ │
┌──────────────┐                   │ └──────────┘ │
│    Stripe    │                   └──────────────┘
│   Payments   │
└──────────────┘
```

## Cost Data Flow

1. **OpenCost** tracks actual cloud resource costs in Kubernetes
2. **Hourly Collection** queries OpenCost for namespace costs
3. **Namespace Mapping** uses `user_projects` to find owners
4. **Cost Aggregation** sums all project costs per user
5. **Database Storage** in `usage_daily` with breakdown
6. **Stripe Billing** uses aggregated costs for invoicing

## Monitoring Points

- Vercel cron job execution logs
- OpenCost connection status (admin UI)
- Unmapped namespaces (no owner found)
- Collection success/failure rates
- Daily cost trends per user
- Project activity (active/inactive status)