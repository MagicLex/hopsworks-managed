/**
 * User Status Cascade Integration Tests
 *
 * Tests that suspending/reactivating an account owner
 * correctly cascades to all team members.
 *
 * Requires: `supabase start` running locally
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getTestSupabase,
  seedUser,
  cleanupTestData,
  getUserStatus,
} from './helpers/test-db';
import { suspendUser, reactivateUser } from '@/lib/user-status';

describe('User Status Cascade', () => {
  const supabase = getTestSupabase();

  beforeEach(async () => {
    // Clean slate for each test
    await cleanupTestData(supabase);
  });

  afterAll(async () => {
    await cleanupTestData(supabase);
  });

  describe('suspendUser', () => {
    it('suspends owner and all team members', async () => {
      // Setup: owner + 2 team members
      const owner = await seedUser(supabase, { account_owner_id: null });
      const member1 = await seedUser(supabase, { account_owner_id: owner.id });
      const member2 = await seedUser(supabase, { account_owner_id: owner.id });

      // Act: suspend owner
      const result = await suspendUser(supabase, owner.id, 'payment_failed');

      // Assert
      expect(result.success).toBe(true);
      expect(await getUserStatus(supabase, owner.id)).toBe('suspended');
      expect(await getUserStatus(supabase, member1.id)).toBe('suspended');
      expect(await getUserStatus(supabase, member2.id)).toBe('suspended');
    });

    it('does NOT cascade when suspending a team member', async () => {
      // Setup
      const owner = await seedUser(supabase, { account_owner_id: null });
      const member = await seedUser(supabase, { account_owner_id: owner.id });

      // Act: suspend member only
      await suspendUser(supabase, member.id, 'manual');

      // Assert: owner unaffected
      expect(await getUserStatus(supabase, owner.id)).toBe('active');
      expect(await getUserStatus(supabase, member.id)).toBe('suspended');
    });

    it('handles owner with no team members', async () => {
      const owner = await seedUser(supabase, { account_owner_id: null });

      const result = await suspendUser(supabase, owner.id);

      expect(result.success).toBe(true);
      expect(await getUserStatus(supabase, owner.id)).toBe('suspended');
    });
  });

  describe('reactivateUser', () => {
    it('reactivates owner and suspended team members', async () => {
      // Setup: suspended owner + suspended members
      const owner = await seedUser(supabase, {
        account_owner_id: null,
        status: 'suspended',
      });
      const member1 = await seedUser(supabase, {
        account_owner_id: owner.id,
        status: 'suspended',
      });
      const member2 = await seedUser(supabase, {
        account_owner_id: owner.id,
        status: 'suspended',
      });

      // Act
      const result = await reactivateUser(supabase, owner.id, 'payment_received');

      // Assert
      expect(result.success).toBe(true);
      expect(await getUserStatus(supabase, owner.id)).toBe('active');
      expect(await getUserStatus(supabase, member1.id)).toBe('active');
      expect(await getUserStatus(supabase, member2.id)).toBe('active');
    });

    it('only reactivates suspended members, not deleted ones', async () => {
      // Setup
      const owner = await seedUser(supabase, {
        account_owner_id: null,
        status: 'suspended',
      });
      const suspendedMember = await seedUser(supabase, {
        account_owner_id: owner.id,
        status: 'suspended',
      });
      const deletedMember = await seedUser(supabase, {
        account_owner_id: owner.id,
        status: 'deleted',
      });

      // Act
      await reactivateUser(supabase, owner.id);

      // Assert
      expect(await getUserStatus(supabase, suspendedMember.id)).toBe('active');
      expect(await getUserStatus(supabase, deletedMember.id)).toBe('deleted'); // unchanged
    });

    it('does not affect already active members', async () => {
      // Setup: owner suspended, member somehow still active
      const owner = await seedUser(supabase, {
        account_owner_id: null,
        status: 'suspended',
      });
      const activeMember = await seedUser(supabase, {
        account_owner_id: owner.id,
        status: 'active',
      });

      // Act
      await reactivateUser(supabase, owner.id);

      // Assert: member stays active (wasn't touched)
      expect(await getUserStatus(supabase, activeMember.id)).toBe('active');
    });
  });
});
