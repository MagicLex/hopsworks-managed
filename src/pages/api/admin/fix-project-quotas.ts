import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { getHopsworksUserByEmail, updateUserProjectLimit } from '../../../lib/hopsworks-api';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * One-off fix: Hopsworks quota counts created projects, not active ones.
 * Users who deleted projects are stuck because their quota is "used".
 * This bumps maxNumProjects by the number of deleted (inactive) projects.
 *
 * POST /api/admin/fix-project-quotas
 * Optional body: { dryRun: true } to preview without applying changes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', session.user.sub)
      .single();

    if (!currentUser?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dryRun = req.body?.dryRun === true;

    // Find all users with inactive (deleted) projects
    const { data: inactiveProjects, error: queryError } = await supabaseAdmin
      .from('user_projects')
      .select('user_id')
      .eq('status', 'inactive');

    if (queryError) {
      return res.status(500).json({ error: 'Failed to query inactive projects', details: queryError });
    }

    if (!inactiveProjects || inactiveProjects.length === 0) {
      return res.status(200).json({ message: 'No users with deleted projects found', fixed: [] });
    }

    // Count inactive projects per user
    const deletedCountByUser: Record<string, number> = {};
    for (const row of inactiveProjects) {
      deletedCountByUser[row.user_id] = (deletedCountByUser[row.user_id] || 0) + 1;
    }

    const results = {
      fixed: [] as Array<{ email: string; oldLimit: number; newLimit: number; deletedProjects: number }>,
      skipped: [] as Array<{ email: string; reason: string }>,
      failed: [] as Array<{ email: string; error: string }>
    };

    const userIds = Object.keys(deletedCountByUser);
    for (const userId of userIds) {
      const deletedCount = deletedCountByUser[userId];
      try {
        // Get user with cluster info and billing mode
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select(`
            email,
            billing_mode,
            stripe_subscription_id,
            account_owner_id,
            user_hopsworks_assignments (
              hopsworks_clusters (
                api_url,
                api_key
              )
            )
          `)
          .eq('id', userId)
          .single();

        if (!userData?.user_hopsworks_assignments?.[0]?.hopsworks_clusters) {
          results.skipped.push({ email: userData?.email || userId, reason: 'No cluster assignment' });
          continue;
        }

        const clusterData = userData.user_hopsworks_assignments[0].hopsworks_clusters;
        const cluster = Array.isArray(clusterData) ? clusterData[0] : clusterData;

        if (!cluster) {
          results.skipped.push({ email: userData.email, reason: 'Cluster data missing' });
          continue;
        }

        const credentials = { apiUrl: cluster.api_url, apiKey: cluster.api_key };
        const hopsworksUser = await getHopsworksUserByEmail(credentials, userData.email);

        if (!hopsworksUser) {
          results.skipped.push({ email: userData.email, reason: 'User not found in Hopsworks' });
          continue;
        }

        // Compute base limit from billing mode (same logic as sync-user Health Check 5)
        const isTeamMember = !!userData.account_owner_id;
        const baseLimit = isTeamMember ? 0 :
          userData.billing_mode === 'free' ? 1 :
          (userData.stripe_subscription_id || userData.billing_mode === 'prepaid') ? 5 : 0;

        // Idempotent: always compute from base + deleted count, not current + deleted count
        const newLimit = baseLimit + deletedCount;
        const currentLimit = hopsworksUser.maxNumProjects ?? 0;

        if (newLimit <= currentLimit) {
          results.skipped.push({ email: userData.email, reason: `Already at ${currentLimit}, computed ${newLimit}` });
          continue;
        }

        if (!dryRun) {
          await updateUserProjectLimit(credentials, hopsworksUser.id, newLimit);
        }

        results.fixed.push({
          email: userData.email,
          oldLimit: currentLimit,
          newLimit,
          deletedProjects: deletedCount
        });

        console.log(`[fix-project-quotas] ${dryRun ? '(DRY RUN) ' : ''}${userData.email}: maxNumProjects ${currentLimit} -> ${newLimit} (base=${baseLimit} +${deletedCount} deleted)`);
      } catch (error: any) {
        results.failed.push({ email: userId, error: error.message || 'Unknown error' });
        console.error(`[fix-project-quotas] Failed for user ${userId}:`, error);
      }
    }

    return res.status(200).json({
      dryRun,
      message: `${dryRun ? '(DRY RUN) ' : ''}Fixed ${results.fixed.length}, skipped ${results.skipped.length}, failed ${results.failed.length}`,
      results
    });
  } catch (error: any) {
    console.error('[fix-project-quotas] Fatal error:', error);
    return res.status(500).json({ error: 'Failed to fix quotas', details: error.message });
  }
}
