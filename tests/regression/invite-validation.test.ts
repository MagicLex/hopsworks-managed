/**
 * Invite Validation Tests
 *
 * Tests the invite request validation logic.
 * If broken, invalid invites get created or valid ones rejected.
 */

import { describe, it, expect } from 'vitest';
import { validateInviteRequest } from '@/lib/invite-validation';

describe('validateInviteRequest', () => {
  it('accepts valid request', () => {
    const result = validateInviteRequest({
      email: 'test@example.com',
      projectRole: 'Data scientist'
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalizedEmail).toBe('test@example.com');
      expect(result.role).toBe('Data scientist');
    }
  });

  it('rejects missing email', () => {
    const result = validateInviteRequest({ projectRole: 'Data scientist' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Email is required');
    }
  });

  it('rejects invalid email format', () => {
    const result = validateInviteRequest({ email: 'not-an-email' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Invalid email address');
    }
  });

  it('rejects invalid role', () => {
    const result = validateInviteRequest({
      email: 'test@example.com',
      projectRole: 'Admin'
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Invalid project role');
    }
  });

});
