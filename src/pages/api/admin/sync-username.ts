import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { getHopsworksUserByAuth0Id } from '../../../lib/hopsworks-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Get user with cluster assignment
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        user_hopsworks_assignments!inner (
          hopsworks_cluster_id,
          hopsworks_clusters (
            id,
            name,
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cluster = user.user_hopsworks_assignments?.[0]?.hopsworks_clusters;
    if (!cluster) {
      return res.status(400).json({ error: 'User has no cluster assignment' });
    }

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    // Try to find existing Hopsworks user by email
    const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, user.email);
    
    if (!hopsworksUser?.username) {
      return res.status(404).json({ error: 'Hopsworks user not found' });
    }

    // Update both users table and assignment with the username
    await supabase
      .from('users')
      .update({ hopsworks_username: hopsworksUser.username })
      .eq('id', userId);
      
    await supabase
      .from('user_hopsworks_assignments')
      .update({ hopsworks_username: hopsworksUser.username })
      .eq('user_id', userId)
      .eq('hopsworks_cluster_id', cluster.id);

    return res.status(200).json({ 
      success: true,
      username: hopsworksUser.username,
      message: `Successfully synced username: ${hopsworksUser.username}`
    });
  } catch (error) {
    console.error('Error syncing username:', error);
    return res.status(500).json({ 
      error: 'Failed to sync username',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function syncUsernameHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}