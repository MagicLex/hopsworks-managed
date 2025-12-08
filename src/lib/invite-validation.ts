/**
 * Validation for team invites
 */

// Valid roles for team members
export const VALID_PROJECT_ROLES = ['Data owner', 'Data scientist'] as const;
export type ProjectRole = typeof VALID_PROJECT_ROLES[number];

// Invite expiry in milliseconds (7 days)
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculate invite expiry date (7 days from now)
 */
export function calculateInviteExpiry(fromDate: Date = new Date()): Date {
  return new Date(fromDate.getTime() + INVITE_EXPIRY_MS);
}

/**
 * Validate invite request payload
 * Normalizes email, validates format, validates role
 */
export function validateInviteRequest(payload: {
  email?: string;
  projectRole?: string;
}): { valid: true; normalizedEmail: string; role: ProjectRole } | { valid: false; error: string } {
  const { email, projectRole = 'Data scientist' } = payload;

  // Email required
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  // Normalize and validate email
  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { valid: false, error: 'Invalid email address' };
  }

  // Validate role
  if (!VALID_PROJECT_ROLES.includes(projectRole as ProjectRole)) {
    return { valid: false, error: 'Invalid project role. Valid roles: Data owner, Data scientist' };
  }

  return { valid: true, normalizedEmail, role: projectRole as ProjectRole };
}
