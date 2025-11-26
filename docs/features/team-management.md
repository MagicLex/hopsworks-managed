# team-management

## overview

team management allows account owners to invite members to share their hopsworks resources and billing. team members inherit billing configuration from the account owner and share the same cluster assignment.

team member onboarding is fully automated. when a member accepts an invite, their hopsworks account is created instantly with the correct quota, and they're automatically added to the owner's projects if `autoAssignProjects=true`.

## core concepts

### account owner
- the primary user who controls billing and team management
- can invite and remove team members
- responsible for all team usage and costs
- identified by `account_owner_id = null` in the database
- gets 5 project limit in Hopsworks after payment setup
- can create and manage projects in Hopsworks

### team member
- invited by an account owner
- inherits billing mode from the owner (stripe or prepaid)
- shares the same cluster as the owner
- usage aggregates under the owner's account
- identified by `account_owner_id` pointing to the owner
- gets 0 project limit in Hopsworks (cannot create projects)
- can only access projects the owner adds them to

## invitation flow

### sending invites

account owners can invite team members via email:

```http
POST /api/team/invite
{
  "email": "newmember@example.com",
  "projectRole": "Data scientist",    // optional: "Data owner", "Data scientist"
  "autoAssignProjects": true          // optional: auto-add to owner's projects on join
}
```

**prerequisite:** the account owner must have completed billing setup (have a cluster assignment) before inviting team members. this ensures the owner's cluster is ready to receive team members.

the system:
1. validates the requester is an account owner
2. **verifies the owner has a cluster assignment** (returns 403 if not)
3. checks the email isn't already a team member
4. creates an invite record with 7-day expiration
5. stores project role preference and auto-assignment settings
6. sends an email with the invite link

### accepting invites

invited users follow the link to join:

```
https://your-domain/team/accept-invite?token=uuid-token
```

the acceptance process:
1. validates the token and expiration
2. **user must accept Terms of Service and Privacy Policy** (checkbox on accept-invite page)
3. user authenticates via auth0
4. `/api/team/join` is called with `termsAccepted: true` (required, returns 400 if false)
5. system links user to the account owner and saves `terms_accepted_at`
6. inherits billing mode and cluster assignment
7. **automatically creates Hopsworks OAuth user** with 0 project limit (no user interaction needed)
8. stores `hopsworks_user_id` and `hopsworks_username` immediately
9. **auto-assigns to owner's projects** if `autoAssignProjects=true` (happens instantly)
10. redirects to dashboard - member can access cluster immediately

**note:** team members do not see the billing-setup page since they inherit billing from the account owner. the terms acceptance happens during the invite acceptance flow.

## database schema

### key fields in users table

```sql
-- account owner
account_owner_id: null
billing_mode: 'postpaid' or 'prepaid'
hopsworks_user_id: integer (after cluster assignment)
hopsworks_username: string (after cluster assignment)
stripe_customer_id: string (for postpaid billing)

-- team member
account_owner_id: 'auth0|owner-id'
billing_mode: inherited from owner
hopsworks_user_id: integer (after cluster assignment)
hopsworks_username: string (after cluster assignment)
stripe_customer_id: null (uses owner's billing)
```

### team_invites table

```sql
id: uuid
inviter_id: auth0 user id
email: invited email
token: unique token
expires_at: timestamp (7 days)
accepted_at: null or timestamp
```

## api endpoints

### POST /api/team/invite
invite a new team member

**authorization:** must be account owner

**request:**
```json
{
  "email": "member@example.com"
}
```

**response:**
```json
{
  "message": "Invite sent successfully",
  "invite": {
    "id": "uuid",
    "email": "member@example.com",
    "expires_at": "2024-01-08T00:00:00Z",
    "invite_url": "https://domain/team/accept-invite?token=..."
  }
}
```

### GET /api/team/members
list all team members

**authorization:** authenticated user

**response:**
```json
{
  "account_owner": {
    "id": "auth0|...",
    "email": "owner@example.com",
    "name": "Owner Name"
  },
  "team_members": [
    {
      "id": "auth0|...",
      "email": "member@example.com",
      "name": "Member Name",
      "created_at": "2024-01-01T00:00:00Z",
      "hopsworks_username": "member123"
    }
  ],
  "is_owner": true
}
```

### DELETE /api/team/members/:id
remove a team member

**authorization:** must be account owner

**response:**
```json
{
  "message": "Team member removed successfully"
}
```

### GET /api/team/accept-invite
get invite details by token

**query params:** `token=uuid`

**response:**
```json
{
  "email": "invited@example.com",
  "invitedBy": "owner@example.com",
  "expiresAt": "2024-01-08T00:00:00Z"
}
```

### POST /api/team/join
complete team joining after auth0 login

**request:**
```json
{
  "token": "uuid-token"
}
```

**response:**
```json
{
  "message": "Successfully joined team",
  "account_owner_id": "auth0|owner-id",
  "cluster_assigned": true,
  "projects_assigned": ["project1", "project2"],
  "warning": "Some projects could not be assigned...",  // if errors
  "project_errors": ["project3: sync failed"]           // if errors
}
```

### GET /api/team/member-projects
get team member's project assignments

**query params:** `memberId=auth0|member-id`

**authorization:** must be account owner

**response:**
```json
{
  "projects": [
    {
      "id": 123,
      "name": "ml_project_1",
      "role": "Data scientist",
      "synced": true,
      "lastSyncAt": "2024-01-01T00:00:00Z",
      "syncError": null
    }
  ]
}
```

### POST /api/team/member-projects
manage team member project access

**authorization:** must be account owner

**request:**
```json
{
  "memberId": "auth0|member-id",
  "projectName": "ml_project_1",
  "projectId": 123,              // optional
  "role": "Data scientist",
  "action": "add"                // "add" or "remove"
}
```

**response (success):**
```json
{
  "message": "Successfully added member@example.com to ml_project_1 as Data scientist",
  "project": "ml_project_1",
  "role": "Data scientist",
  "synced": true
}
```

**response (error):**
```json
{
  "error": "Failed to add user to project in Hopsworks. The cluster may need to be upgraded to support OAuth group mappings. Please contact support.",
  "details": "404 Not Found"
}
```

### POST /api/team/sync-member-projects
retry failed project assignments

**authorization:** must be account owner

**request:**
```json
{
  "memberId": "auth0|member-id"
}
```

**response:**
```json
{
  "message": "Successfully synced 2 project(s)",
  "syncedCount": 2,
  "failedCount": 1,
  "syncedProjects": ["project1", "project2"],
  "failedProjects": [
    {
      "project": "project3",
      "error": "404 Not Found"
    }
  ],
  "warning": "Some projects could not be synced..."  // if failures
}
```

## billing implications

### stripe accounts
- account owner must have payment method configured
- all team member usage bills to owner's stripe account
- team members cannot make independent purchases
- credit balance shared across team

### prepaid corporate accounts
- account owner registered via hubspot-validated link
- team members automatically prepaid without validation
- no payment methods required for any team member
- usage tracked for reporting but not billed

## usage aggregation

### team usage query
```sql
select 
  owner.email as account_owner,
  owner.name as owner_name,
  coalesce(owner.billing_mode, 'stripe') as billing_mode,
  count(distinct u.id) + 1 as team_size,
  sum(ud.total_cost) as total_usage,
  sum(ud.opencost_cpu_hours) as cpu_hours,
  sum(ud.opencost_gpu_hours) as gpu_hours
from users owner
left join users u on u.account_owner_id = owner.id
left join usage_daily ud on ud.user_id in (owner.id, u.id)
where owner.account_owner_id is null
  and ud.date >= date_trunc('month', current_date)
group by owner.id, owner.email, owner.name, owner.billing_mode;
```

### individual member usage
```sql
select 
  u.email,
  u.name,
  owner.email as billed_to,
  sum(ud.total_cost) as usage_cost
from users u
join users owner on owner.id = u.account_owner_id
left join usage_daily ud on ud.user_id = u.id
where ud.date >= date_trunc('month', current_date)
group by u.id, u.email, u.name, owner.email;
```

## hopsworks project access

### project limits
- **account owners**: 5 projects maximum (`maxNumProjects: 5`)
- **team members**: 0 projects (`maxNumProjects: 0`)
- limits are enforced by Hopsworks, not hopsworks-managed

### project management

#### automatic project assignment
when `autoAssignProjects: true` in the invite:
- team member automatically added to all owner's existing projects
- uses the specified `projectRole` (default: "Data scientist")
- assignments tracked in `project_member_roles` table
- sync status shown to account owner

#### manual project management
account owners can manage team member project access:

```http
POST /api/team/member-projects
{
  "memberId": "auth0|member-id",
  "projectName": "ml_project_1",
  "role": "Data scientist",  // "Data owner" or "Data scientist"
  "action": "add"            // "add" or "remove"
}
```

#### sync failed assignments
if project assignments fail (e.g., cluster needs upgrade):

```http
POST /api/team/sync-member-projects
{
  "memberId": "auth0|member-id"
}
```

returns detailed sync results with any errors

### project membership implementation

the system uses the admin endpoint to add users to projects:
```javascript
// When adding a team member to a project
POST /hopsworks-api/api/admin/projects/add-to-projects
{
  "username": "membername123",
  "role": "Data scientist",
  "projectIds": [120, 121]
}
```

this endpoint accepts:
- `username` - the Hopsworks username (not email)
- `role` - one of "Data owner", "Data scientist"
- `projectIds` - array of numeric project IDs

### database tracking

project assignments are stored in `project_member_roles`:
```sql
member_id: auth0 user id
account_owner_id: owner's auth0 id
project_id: hopsworks project id
project_name: project name
role: "Data owner" | "Data scientist"
synced_to_hopsworks: boolean
sync_error: error message if sync failed
last_sync_at: timestamp of last sync attempt
```

## cluster management

### assignment rules
- team members use the same cluster as the owner
- cluster assignment happens automatically on join
- creates Hopsworks OAuth user during assignment
- removing a team member decrements cluster user count
- cluster limits apply to total team size

### cluster capacity check
```sql
select 
  hc.name as cluster_name,
  hc.max_users,
  count(distinct coalesce(u.account_owner_id, u.id)) as unique_accounts,
  count(*) as total_users
from hopsworks_clusters hc
left join user_hopsworks_assignments uha on uha.hopsworks_cluster_id = hc.id
left join users u on u.id = uha.user_id
where hc.status = 'active'
group by hc.id, hc.name, hc.max_users;
```

## security considerations

### invite tokens
- cryptographically secure random generation
- 7-day expiration
- single use only
- stored hashed in database

### permission checks
- only account owners can invite/remove members
- team members cannot invite others
- team members cannot change billing settings
- api endpoints validate ownership before operations

### audit trail
all team operations logged:
- invite sent
- invite accepted/expired
- member removed
- failed authorization attempts

## edge cases

### owner with existing team wants prepaid
when converting to corporate prepaid:
1. owner's billing_mode changes to 'prepaid'
2. all existing team members inherit prepaid status
3. stripe subscriptions should be cancelled
4. cluster access continues uninterrupted

### team member becomes independent
to split from team:
1. remove as team member (sets account_owner_id to null)
2. user must set up own payment method
3. assign to new or existing cluster
4. future usage bills independently

### owner account deletion
before deleting owner account:
1. transfer ownership to team member, or
2. remove all team members first
3. ensure no orphaned team relationships