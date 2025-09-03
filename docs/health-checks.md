# Health Check System

## Overview

The health check system ensures user accounts remain functional by automatically detecting and repairing common issues during login. This provides resilience against partial failures during registration or external service outages.

## Architecture

```
User Login → sync-user.ts → Health Checks → Auto-Repair → Log Failures
                                ↓
                        health_check_failures table
```

## Health Checks Performed

The system performs these checks on every login (`/api/auth/sync-user`):

### 1. Billing Status
- **Checks**: Determines billing type and ensures proper setup
- **Auto-repair**: 
  - **Postpaid users**: Creates Stripe customer and subscription if missing
  - **Prepaid/Corporate users**: No Stripe needed, billing already enabled
- **Applies to**: Account owners only (not team members)

#### Billing Types:
**Postpaid (SaaS)**:
- Stripe customer created on first login
- User redirected to payment setup if no payment method
- Subscription created automatically after payment (via webhook)
- Identified by: `billing_mode = 'postpaid'` or null

**Prepaid (Corporate/Enterprise)**:
- No Stripe integration needed
- Billing handled via invoices
- Cluster assigned immediately
- Identified by: `billing_mode = 'prepaid'`
- Set during registration with `?corporate_ref=deal_id`

### 2. Cluster Assignment
- **Checks**: User assigned to an active Hopsworks cluster
- **Auto-repair**: Only for prepaid and team members
- **Prerequisites**: 
  - **Postpaid**: Requires verified payment method (assigned via webhook after payment)
  - **Prepaid**: Assigned immediately, no payment check
  - **Team members**: Assigned to same cluster as account owner

### 3. Hopsworks User
- **Checks**: Hopsworks user exists with correct settings
- **Auto-repair**: 
  - Creates Hopsworks OAuth user if missing
  - Retrieves user ID if only username is known
  - Searches by email as fallback
- **Retry logic**: 3 attempts with exponential backoff

### 4. Project Limits (maxNumProjects)
- **Checks**: Correct project limit set in Hopsworks
- **Auto-repair**: Updates to correct value
- **Values**:
  - **Postpaid account owners**: 5 projects (if Stripe customer exists)
  - **Prepaid/Corporate account owners**: 5 projects (always)
  - **Team members**: 0 projects (use owner's projects)
  - **Users without billing**: 0 projects (trial/restricted)

### 5. Team Membership
- **Checks**: Team members on same cluster as account owner
- **Auto-repair**: Logs mismatch (migration not automated)

### 6. Team Project Access
- **Checks**: Logs which owner projects the team member has access to
- **Auto-repair**: None - owner controls project membership
- **Note**: Can be managed via admin panel or directly in Hopsworks

## Failure Tracking

### Database Table: `health_check_failures`

```sql
- id: UUID
- user_id: Auth0 ID
- email: User email
- check_type: Type of check that failed
- error_message: Human-readable error
- details: JSON with full error details
- created_at: Timestamp
- resolved_at: When issue was resolved
- resolution_notes: Admin notes
```

### Check Types

- `stripe_customer_creation` - Failed to create Stripe customer
- `subscription_creation` - Failed to create subscription
- `cluster_assignment` - Failed to assign cluster
- `hopsworks_user_creation` - Failed to create Hopsworks user
- `hopsworks_user_creation_team` - Failed for team member
- `hopsworks_user_creation_owner` - Failed for account owner
- `maxnumprojects_update` - Failed to update project limit
- `team_cluster_mismatch` - Team member on wrong cluster

## Admin Tools

### Health Check Monitor Dashboard
Located at `/admin47392` - includes `HealthCheckMonitor` component

Features:
- View all unresolved failures
- Filter by email, check type, or status
- Bulk resolve failures
- Add resolution notes
- Automatic cleanup of old resolved failures

### API Endpoints

#### GET `/api/admin/health-check-failures`
Query parameters:
- `userId` - Filter by user
- `email` - Filter by email (partial match)
- `checkType` - Filter by check type
- `unresolved=true` - Only show unresolved
- `limit` & `offset` - Pagination

#### PATCH `/api/admin/health-check-failures`
Mark single failure as resolved:
```json
{
  "id": "failure-uuid",
  "resolution_notes": "Manual fix applied"
}
```

#### POST `/api/admin/health-check-failures`
Bulk resolve failures:
```json
{
  "ids": ["uuid1", "uuid2"],
  "resolution_notes": "Bulk resolved after fix"
}
```

## Monitoring

### Check System Health
```bash
# Recent failures
SELECT email, check_type, error_message, created_at 
FROM health_check_failures 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

# Unresolved by type
SELECT check_type, COUNT(*) 
FROM health_check_failures 
WHERE resolved_at IS NULL 
GROUP BY check_type;
```

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| SSL certificate errors | Self-signed certs | Fixed with `NODE_TLS_REJECT_UNAUTHORIZED` |
| Missing Stripe subscription | Price IDs incorrect | Update `stripe_products` table |
| No Hopsworks user ID | Only username stored | System retrieves ID on login |
| Can't create projects | maxNumProjects = 0 | Auto-fixed on login for paying users |
| Team member no cluster | Owner not assigned yet | Owner must login first |

## Manual Verification

### Test User Billing Status
```bash
curl https://run.hopsworks.ai/api/user/verify-billing \
  -H "Cookie: appSession=SESSION_COOKIE"
```

Response shows:
- Billing enabled status
- Issues found
- Cluster assignment status
- Auto-fix suggestions

### Force Health Check
Simply log out and log back in - all checks run automatically.

## Resilience Features

1. **Idempotent operations** - Safe to run multiple times
2. **Retry logic** - Transient failures handled automatically  
3. **Graceful degradation** - Partial failures don't block login
4. **Detailed logging** - All failures tracked for debugging
5. **Auto-repair** - Most issues fixed without admin intervention

## Configuration

No configuration needed - the system is always active and runs on every login to ensure accounts remain functional.