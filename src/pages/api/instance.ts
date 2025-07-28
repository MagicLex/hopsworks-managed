import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    console.log('Instance API - User ID:', userId);

    // Get user's assigned Hopsworks cluster
    const { data: clusterAssignment, error: assignmentError } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select(`
        assigned_at,
        hopsworks_clusters!inner (
          name,
          api_url
        )
      `)
      .eq('user_id', userId)
      .single();

    console.log('Assignment error:', assignmentError);
    console.log('Cluster assignment:', clusterAssignment);
    
    // If user has no cluster assignment yet
    if (!clusterAssignment || assignmentError) {
      console.log('No cluster assignment found for user:', userId);
      return res.status(200).json({
        name: 'Hopsworks Instance',
        status: 'Not Assigned',
        endpoint: '',
        plan: 'Pay-as-you-go',
        created: null
      });
    }

    // Access the cluster data - Supabase returns it as an array even for single joins
    const hopsworksCluster = Array.isArray(clusterAssignment.hopsworks_clusters) 
      ? clusterAssignment.hopsworks_clusters[0] 
      : clusterAssignment.hopsworks_clusters;

    // Return the shared cluster information
    return res.status(200).json({
      name: hopsworksCluster?.name || 'Hopsworks Instance',
      status: 'Active', // Shared clusters are always active
      endpoint: hopsworksCluster?.api_url || '',
      plan: 'Pay-as-you-go',
      created: clusterAssignment.assigned_at || new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching instance:', error);
    return res.status(500).json({ error: 'Failed to fetch instance data' });
  }
}