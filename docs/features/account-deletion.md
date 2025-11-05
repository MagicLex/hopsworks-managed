# Account Deletion

## Overview

Account deletion uses a **soft delete** approach to preserve audit trails, billing data, and enable potential account recovery.

## How It Works

### Self-Deletion Flow

1. **Account Owner Initiates Deletion**
   - User clicks "Delete Account" in Settings tab
   - Must be an account owner (not a team member)
   - Must have removed all team members first

2. **Pre-Deletion Checks**
   ```typescript
   // Check if user is account owner
   if (user.account_owner_id !== null) {
     return error: 'Team members cannot self-delete'
   }

   // Check for team members
   if (hasTeamMembers) {
     return error: 'Remove all team members first'
   }
   ```

3. **Cluster Access Revocation**
   - Sets Hopsworks `maxNumProjects` to 0
   - Prevents creating new projects
   - Existing projects remain visible but read-only

4. **Soft Delete**
   ```sql
   UPDATE users SET
     deleted_at = NOW(),
     deletion_reason = 'user_requested',
     status = 'deleted'
   WHERE id = user_id;
   ```

5. **Login Prevention**
   - Auth check in `/api/auth/sync-user` blocks deleted users
   - Returns 403 with deletion timestamp

## What Gets Preserved

### ✅ Data Retained
- User record with all metadata
- Complete billing history (`usage_daily`)
- Stripe customer ID and subscription history
- Hopsworks username and cluster assignment
- All timestamps and audit data

### ❌ Access Revoked
- Login blocked immediately
- Cluster access restricted (maxNumProjects = 0)
- Cannot create new projects
- Dashboard access blocked

## Team Member Removal

When an account owner removes a team member:

1. Team member is converted to standalone account owner
2. Their `account_owner_id` is set to NULL
3. They can now set up their own billing
4. If they set up billing, they get cluster access

**Note**: Team members cannot self-delete. They must be removed by their account owner.

## Recovery Process

To recover a soft-deleted account (admin only):

```sql
-- Restore account
UPDATE users SET
  deleted_at = NULL,
  deletion_reason = NULL,
  status = 'active'
WHERE id = 'user_id';

-- Restore cluster access (if they have billing)
-- via API: updateUserProjectLimit(credentials, hopsworksUserId, 5)
```

## Hard Delete Policy

**Not implemented yet.** Future considerations:

- Hard delete after 90 days of soft delete
- Archive billing data to separate table before hard delete
- Comply with GDPR right to be forgotten
- Maintain billing records per tax/compliance requirements

## Implementation Details

### Database Schema

```sql
-- users table additions
deleted_at TIMESTAMPTZ DEFAULT NULL,
deletion_reason TEXT DEFAULT NULL,  -- 'user_requested', 'team_member_removed', 'admin_action'

-- Indexes
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_active ON users(id) WHERE deleted_at IS NULL;
```

### API Endpoints

- `DELETE /api/account/delete` - Self-deletion for account owners
- `DELETE /api/team/members?memberId=X` - Remove team member (owner only)

### Auth Flow

```typescript
// In /api/auth/sync-user
if (existingUser?.deleted_at) {
  return res.status(403).json({
    error: 'Account has been deleted',
    deletedAt: existingUser.deleted_at
  });
}
```

## Best Practices

### For Users
- Remove all team members before deleting your account
- Export any important data before deletion
- Contact support within 30 days if you change your mind

### For Admins
- Monitor `health_check_failures` for deletion-related issues
- Review soft-deleted accounts periodically
- Implement hard delete policy per compliance requirements

### For Developers
- Always filter deleted users: `WHERE deleted_at IS NULL`
- Use the `idx_users_active` index for performance
- Never hard delete without archiving billing data

## Compliance Considerations

### GDPR Right to be Forgotten
- Soft delete satisfies immediate access removal
- Hard delete may be required after retention period
- Billing data retention per tax requirements (typically 7 years)

### Audit Trail
- All deletions logged with timestamp and reason
- Deletion reason tracks: user_requested, team_member_removed, admin_action
- `health_check_failures` table captures any issues during deletion

## Monitoring

```sql
-- Count soft-deleted accounts by reason
SELECT deletion_reason, COUNT(*)
FROM users
WHERE deleted_at IS NOT NULL
GROUP BY deletion_reason;

-- Find accounts ready for hard delete (90+ days)
SELECT id, email, deleted_at, deletion_reason
FROM users
WHERE deleted_at IS NOT NULL
AND deleted_at < NOW() - INTERVAL '90 days'
ORDER BY deleted_at;

-- Check for orphaned data (should be none with soft delete)
SELECT 'usage_daily' as table_name, COUNT(*) as orphaned
FROM usage_daily ud
LEFT JOIN users u ON ud.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'user_hopsworks_assignments', COUNT(*)
FROM user_hopsworks_assignments uha
LEFT JOIN users u ON uha.user_id = u.id
WHERE u.id IS NULL;
```
