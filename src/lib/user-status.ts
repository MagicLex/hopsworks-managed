import { createClient } from '@supabase/supabase-js';
import { updateHopsworksUserStatus } from './hopsworks-api';

/**
 * Centralized user status management
 * Ensures Supabase and Hopsworks stay in sync
 */

interface StatusChangeResult {
  success: boolean;
  supabaseUpdated: boolean;
  hopsworksUpdated: boolean;
  error?: string;
}

/**
 * Get Hopsworks credentials for a user
 */
async function getHopsworksCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ apiUrl: string; apiKey: string; hopsworksUserId: number } | null> {
  const { data: assignment } = await supabase
    .from('user_hopsworks_assignments')
    .select(`
      hopsworks_user_id,
      hopsworks_clusters (
        api_url,
        api_key
      )
    `)
    .eq('user_id', userId)
    .single();

  if (!assignment?.hopsworks_clusters || !assignment.hopsworks_user_id) {
    return null;
  }

  const cluster = assignment.hopsworks_clusters as any;
  return {
    apiUrl: cluster.api_url,
    apiKey: cluster.api_key,
    hopsworksUserId: assignment.hopsworks_user_id as number
  };
}

/**
 * Suspend a user account
 * - Sets status='suspended' in Supabase
 * - Deactivates Hopsworks account (status 3 = DEACTIVATED_ACCOUNT)
 */
export async function suspendUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  reason?: string
): Promise<StatusChangeResult> {
  const result: StatusChangeResult = {
    success: false,
    supabaseUpdated: false,
    hopsworksUpdated: false
  };

  try {
    // Get user email for logging
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = user?.email || userId;

    // Update Supabase status
    const { error: supabaseError } = await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', userId);

    if (supabaseError) {
      result.error = `Failed to update Supabase: ${supabaseError.message}`;
      console.error(`[suspendUser] ${result.error}`, supabaseError);
      return result;
    }

    result.supabaseUpdated = true;
    console.log(`[suspendUser] Suspended user ${userEmail} in Supabase${reason ? ` (reason: ${reason})` : ''}`);

    // Deactivate in Hopsworks (status 3 = DEACTIVATED_ACCOUNT)
    try {
      const credentials = await getHopsworksCredentials(supabase, userId);
      if (credentials) {
        await updateHopsworksUserStatus(
          { apiUrl: credentials.apiUrl, apiKey: credentials.apiKey },
          credentials.hopsworksUserId,
          3 // DEACTIVATED_ACCOUNT
        );
        result.hopsworksUpdated = true;
        console.log(`[suspendUser] Deactivated Hopsworks user ${credentials.hopsworksUserId} for ${userEmail}`);
      } else {
        console.log(`[suspendUser] Could not deactivate Hopsworks user for ${userEmail} - no cluster assignment or Hopsworks user ID`);
      }
    } catch (error) {
      // Log but don't fail the whole operation
      console.error(`[suspendUser] Failed to deactivate Hopsworks user for ${userEmail}:`, error);
    }

    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('[suspendUser] Unexpected error:', error);
    return result;
  }
}

/**
 * Reactivate a suspended user account
 * - Sets status='active' in Supabase
 * - Reactivates Hopsworks account (status 2 = ACTIVATED_ACCOUNT)
 */
export async function reactivateUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  reason?: string
): Promise<StatusChangeResult> {
  const result: StatusChangeResult = {
    success: false,
    supabaseUpdated: false,
    hopsworksUpdated: false
  };

  try {
    // Get user email for logging
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = user?.email || userId;

    // Update Supabase status
    const { error: supabaseError } = await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', userId);

    if (supabaseError) {
      result.error = `Failed to update Supabase: ${supabaseError.message}`;
      console.error(`[reactivateUser] ${result.error}`, supabaseError);
      return result;
    }

    result.supabaseUpdated = true;
    console.log(`[reactivateUser] Reactivated user ${userEmail} in Supabase${reason ? ` (reason: ${reason})` : ''}`);

    // Reactivate in Hopsworks (status 2 = ACTIVATED_ACCOUNT)
    try {
      const credentials = await getHopsworksCredentials(supabase, userId);
      if (credentials) {
        await updateHopsworksUserStatus(
          { apiUrl: credentials.apiUrl, apiKey: credentials.apiKey },
          credentials.hopsworksUserId,
          2 // ACTIVATED_ACCOUNT
        );
        result.hopsworksUpdated = true;
        console.log(`[reactivateUser] Reactivated Hopsworks user ${credentials.hopsworksUserId} for ${userEmail}`);
      } else {
        console.log(`[reactivateUser] Could not reactivate Hopsworks user for ${userEmail} - no cluster assignment or Hopsworks user ID`);
      }
    } catch (error) {
      // Log but don't fail the whole operation
      console.error(`[reactivateUser] Failed to reactivate Hopsworks user for ${userEmail}:`, error);
    }

    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('[reactivateUser] Unexpected error:', error);
    return result;
  }
}

/**
 * Deactivate a user account (soft delete)
 * - Sets status='deleted' and deleted_at in Supabase
 * - Deactivates Hopsworks account (status 3 = DEACTIVATED_ACCOUNT)
 */
export async function deactivateUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  reason?: string
): Promise<StatusChangeResult> {
  const result: StatusChangeResult = {
    success: false,
    supabaseUpdated: false,
    hopsworksUpdated: false
  };

  try {
    // Get user email for logging
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = user?.email || userId;

    // Update Supabase status
    const { error: supabaseError } = await supabase
      .from('users')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deletion_reason: reason || 'user_requested'
      })
      .eq('id', userId);

    if (supabaseError) {
      result.error = `Failed to update Supabase: ${supabaseError.message}`;
      console.error(`[deactivateUser] ${result.error}`, supabaseError);
      return result;
    }

    result.supabaseUpdated = true;
    console.log(`[deactivateUser] Deactivated user ${userEmail} in Supabase${reason ? ` (reason: ${reason})` : ''}`);

    // Deactivate in Hopsworks (status 3 = DEACTIVATED_ACCOUNT)
    try {
      const credentials = await getHopsworksCredentials(supabase, userId);
      if (credentials) {
        await updateHopsworksUserStatus(
          { apiUrl: credentials.apiUrl, apiKey: credentials.apiKey },
          credentials.hopsworksUserId,
          3 // DEACTIVATED_ACCOUNT
        );
        result.hopsworksUpdated = true;
        console.log(`[deactivateUser] Deactivated Hopsworks user ${credentials.hopsworksUserId} for ${userEmail}`);
      } else {
        console.log(`[deactivateUser] Could not deactivate Hopsworks user for ${userEmail} - no cluster assignment or Hopsworks user ID`);
      }
    } catch (error) {
      // Log but don't fail the whole operation
      console.error(`[deactivateUser] Failed to deactivate Hopsworks user for ${userEmail}:`, error);
    }

    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('[deactivateUser] Unexpected error:', error);
    return result;
  }
}
