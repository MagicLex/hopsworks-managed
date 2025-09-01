# team-management

## overview

team management allows account owners to invite members to share their hopsworks resources and billing. team members inherit billing configuration from the account owner and share the same cluster assignment.

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
  "email": "newmember@example.com"
}
```

the system:
1. validates the requester is an account owner
2. checks the email isn't already a team member
3. creates an invite record with 7-day expiration
4. sends an email with the invite link

### accepting invites

invited users follow the link to join:

```
https://your-domain/team/accept-invite?token=uuid-token
```

the acceptance process:
1. validates the token and expiration
2. user authenticates via auth0
3. system links user to the account owner
4. inherits billing mode and cluster assignment
5. creates Hopsworks OAuth user with 0 project limit
6. stores `hopsworks_user_id` for future API calls
7. redirects to dashboard

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
  "success": true,
  "message": "Successfully joined team"
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
- account owners create projects in Hopsworks UI
- owners manually add team members to specific projects
- team members can only access projects they're added to
- project-level permissions managed within Hopsworks

### future: group mapping api
planned implementation for automatic team access:
```javascript
// When owner creates a project
POST /hopsworks-api/api/admin/group/mapping/bulk
{
  "projectName": "ml_project_1",
  "group": ["team_owner_xyz"],
  "projectRole": "Data scientist",
  "groupType": "OAUTH"
}
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