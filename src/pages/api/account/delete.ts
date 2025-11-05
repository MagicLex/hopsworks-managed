import { NextApiRequest, NextApiResponse } from 'next';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    const { reason } = req.body || {};

    // Check if user is account owner with team members
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('account_owner_id')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    // Only account owners (account_owner_id IS NULL) can self-delete
    // Team members should be removed by their owner
    if (user.account_owner_id !== null) {
      return res.status(403).json({
        error: 'Team members cannot self-delete. Contact your account owner to be removed.'
      });
    }

    // Check for team members
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id')
      .eq('account_owner_id', userId);

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return res.status(500).json({ error: 'Failed to check team members' });
    }

    if (teamMembers && teamMembers.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete account with active team members. Remove all team members first.'
      });
    }

    // Get user's cluster assignment to revoke access
    const { data: assignment } = await supabase
      .from('user_hopsworks_assignments')
      .select('hopsworks_user_id, hopsworks_cluster_id')
      .eq('user_id', userId)
      .single();

    // Revoke cluster access by setting maxNumProjects to 0
    if (assignment?.hopsworks_user_id && assignment.hopsworks_cluster_id) {
      try {
        const { data: cluster } = await supabase
          .from('hopsworks_clusters')
          .select('api_url, api_key')
          .eq('id', assignment.hopsworks_cluster_id)
          .single();

        if (cluster) {
          const { updateUserProjectLimit } = await import('../../../lib/hopsworks-api');
          const credentials = {
            apiUrl: cluster.api_url,
            apiKey: cluster.api_key
          };

          await updateUserProjectLimit(credentials, assignment.hopsworks_user_id, 0);
          console.log(`Revoked cluster access for deleted user ${userId}`);
        }
      } catch (error) {
        console.error('Failed to revoke cluster access:', error);
        // Continue with deletion even if this fails
      }
    }

    // Soft delete: set deleted_at and status
    const { error: deleteError } = await supabase
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: reason || 'user_requested',
        status: 'deleted'
      })
      .eq('id', userId);

    if (deleteError) {
      console.error('Error soft deleting user:', deleteError);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error in account deletion:', error);
    return res.status(500).json({
      error: 'Failed to process account deletion'
    });
  }
});