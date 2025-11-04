# Architecture Overview

## Tech Stack
- **Frontend**: Next.js 15.4 (Pages Router), TypeScript
- **UI**: tailwind-quartz component library
- **Auth**: Auth0 SDK v3 (MUST use v3, not v4)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe metered billing (live)
- **Corporate CRM**: HubSpot (deal validation for prepaid onboarding)
- **Email**: Resend for invite delivery
- **Hosting**: Vercel with scheduled cron jobs
- **Cost Tracking**: OpenCost inside the Kubernetes cluster

## Key Flows

### User Signup (Self-Service SaaS)
1. Auth0 authentication via hosted login.
2. Auth0 post-login webhook (`/api/webhooks/auth0`) creates the `users` row and Stripe customer if missing.
3. User is redirected to Stripe Checkout to add a payment method.
4. Stripe webhook (`/api/webhooks/stripe`) creates/updates the metered subscription once payment data exists.
5. Health checks (`/api/auth/sync-user`) or admin actions assign a shared Hopsworks cluster after billing is verified.
6. Cluster assignment creates or links an OAuth user in Hopsworks with:
   - Account owners: 5 project limit.
   - Team members: 0 project limit.
7. Stores `hopsworks_username` (and ID if returned) in Supabase for future API calls.

### Corporate (Prepaid) Signup
1. User arrives with `?corporate_ref=<hubspot-deal-id>`.
2. `/api/auth/validate-corporate` validates the deal through HubSpot APIs using `HUBSPOT_API_KEY`.
3. On successful validation, the account is marked `billing_mode = 'prepaid'` and the deal ID is stored in `metadata.corporate_ref`.
4. Cluster assignment runs immediately after signup—no Stripe flow.
5. Usage is still collected hourly, but invoicing happens off-platform.

### Team Management
1. Account owners send invites via `/api/team/invite`; Resend emails the tokenized link.
2. Invited users authenticate with Auth0 and accept via `/api/team/join`.
3. Membership details are stored in `users.account_owner_id` and mirrored in Hopsworks.
4. Optional auto-assignment adds members to the owner's projects and caches roles in `project_member_roles`.
5. Team member usage is aggregated to the owner's account for billing and reporting.

### Cost Collection (Hourly via OpenCost)
1. Cron job runs every hour on Vercel
2. For **each active cluster** (multi-cluster support):
   - Uses `kubectl exec` to query OpenCost API inside cluster
   - Gets costs per namespace for the last hour
   - No external exposure needed (secure)
   - Verifies namespace owner is on correct cluster
3. Maps namespaces to users via `user_projects` table
4. Accumulates hourly costs in `usage_daily` table
5. Updates `project_breakdown` JSONB with per-project details
6. Persists totals in `usage_daily` for reporting and Stripe sync.

**See**: [OpenCost Collection Documentation](../operations/opencost-collection.md) for detailed flow.

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
- **Postpaid (default)**: Daily cron `/api/billing/sync-stripe` reports usage totals to Stripe Billing Meter Events.
- **Prepaid (corporate)**: Usage retained for reporting; invoicing handled manually based on HubSpot deal metadata.
- Hybrid model supports SaaS and prepaid accounts simultaneously.
- Team member usage rolls up to the owner via `usage_daily.account_owner_id`.
- All costs originate from OpenCost allocations; pricing is defined in `src/config/billing-rates.ts`.

## Database Schema

### Core Tables
- **`users`** – Auth0 ID as primary key:
  - `account_owner_id` links team members to owners.
  - `billing_mode` toggles between `postpaid` and `prepaid`.
  - `hopsworks_username` cached for API calls.
  - `metadata.corporate_ref` stores the HubSpot deal ID.
- **`team_invites`** – Pending invitations, including desired project role and `auto_assign_projects`.
- **`project_member_roles`** – Tracks team member access to each Hopsworks project plus sync status.

### Cluster Management
- **`hopsworks_clusters`** - Shared cluster endpoints with kubeconfig
- **`user_hopsworks_assignments`** - Maps users to clusters, includes:
  - `hopsworks_user_id` - For API updates
  - `hopsworks_username` - For reference
  - `assigned_by` - Tracks manual vs automatic assignment

### Billing Tables
- **`user_projects`** – Maps OpenCost namespaces to account owners.
- **`usage_daily`** – Hourly totals aggregated per day for Stripe sync.
- **`stripe_products`** – Active Stripe product/price mappings used by billing sync.
- **`user_credits`** – Legacy/prepaid credits (report-only for current builds).

### Key Changes from Legacy
- Replaced hardcoded pricing with OpenCost-derived actuals.
- Added `user_projects` for namespace → user mapping.
- Added `project_member_roles` for project auto-assignment tracking.
- Added `opencost_*` columns to `usage_daily`.
- Switched cost pulls from metrics-server to `kubectl exec` proxying into OpenCost.

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

## Security
- All API routes require Auth0 sessions; admin routes enforce `is_admin`.
- Supabase service-role key enables server-to-server access; never expose client-side.
- Hopsworks API keys and kubeconfigs are stored as text in Supabase—access restricted to admin functions and encrypted at rest by Supabase.
- **OpenCost is not exposed externally**; all calls go through Kubernetes API proxying.
- Team members inherit billing but cannot view Stripe data.

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
┌──────────────┐
│   HubSpot    │
│  (Deals)     │
└──────────────┘
┌──────────────┐
│    Resend    │
│ (Invites)    │
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
