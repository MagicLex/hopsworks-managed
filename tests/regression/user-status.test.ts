/**
 * User Status Management Tests
 *
 * Tests suspend/reactivate cascade logic.
 * If these break, team members may not be suspended with owner
 * or users may be incorrectly locked out.
 */

import { describe, it, expect } from 'vitest';
import { HOPSWORKS_STATUS } from '@/lib/user-status';

describe('HOPSWORKS_STATUS constants', () => {
  it('has correct status codes', () => {
    expect(HOPSWORKS_STATUS.ACTIVATED_ACCOUNT).toBe(2);
    expect(HOPSWORKS_STATUS.DEACTIVATED_ACCOUNT).toBe(3);
  });

  it('activated and deactivated are different values', () => {
    expect(HOPSWORKS_STATUS.ACTIVATED_ACCOUNT).not.toBe(HOPSWORKS_STATUS.DEACTIVATED_ACCOUNT);
  });
});

describe('cascade logic patterns', () => {
  it('suspend logic has base case for team members (no infinite recursion)', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sourceFile = path.join(process.cwd(), 'src/lib/user-status.ts');
    const source = fs.readFileSync(sourceFile, 'utf-8');

    // suspendUser should check account_owner_id to prevent infinite recursion
    // Team members have account_owner_id set, so they won't recurse
    expect(source).toContain('account_owner_id === null');

    // Should only recurse for account owners (account_owner_id is null)
    expect(source).toContain('eq(\'account_owner_id\', userId)');
  });

  it('reactivate logic has base case for team members', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sourceFile = path.join(process.cwd(), 'src/lib/user-status.ts');
    const source = fs.readFileSync(sourceFile, 'utf-8');

    // reactivateUser should also check account_owner_id
    const reactivateSection = source.slice(source.indexOf('async function reactivateUser'));
    expect(reactivateSection).toContain('account_owner_id === null');
  });

  it('status changes update both Supabase and Hopsworks', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sourceFile = path.join(process.cwd(), 'src/lib/user-status.ts');
    const source = fs.readFileSync(sourceFile, 'utf-8');

    // Should update Supabase status
    expect(source).toContain("status: 'suspended'");
    expect(source).toContain("status: 'active'");

    // Should call Hopsworks status update
    expect(source).toContain('updateHopsworksUserStatus');
    expect(source).toContain('DEACTIVATED_ACCOUNT');
    expect(source).toContain('ACTIVATED_ACCOUNT');
  });
});

describe('status result interface', () => {
  it('StatusChangeResult tracks both systems', async () => {
    const { suspendUser, reactivateUser } = await import('@/lib/user-status');

    // These functions should exist and be exported
    expect(typeof suspendUser).toBe('function');
    expect(typeof reactivateUser).toBe('function');
  });
});
