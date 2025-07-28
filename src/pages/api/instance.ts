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

    // Get user's instance info
    const { data: instanceData, error: instanceError } = await supabaseAdmin
      .from('instances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (instanceError && instanceError.code !== 'PGRST116') {
      console.error('Instance error:', instanceError);
    }

    // Get user's assigned Hopsworks cluster URL
    const { data: clusterAssignment } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select(`
        hopsworks_clusters (
          name,
          api_url
        )
      `)
      .eq('user_id', userId)
      .single();

    const hopsworksCluster = clusterAssignment?.hopsworks_clusters?.[0];
    const hopsworksUrl = hopsworksCluster?.api_url || '';

    // Default instance data for users without cluster
    const defaultInstance = {
      name: hopsworksCluster?.name || 'Hopsworks Instance',
      status: 'Not Started',
      endpoint: hopsworksUrl,
      plan: 'Pay-as-you-go',
      created: null
    };

    if (!instanceData) {
      return res.status(200).json(defaultInstance);
    }

    return res.status(200).json({
      name: instanceData.instance_name || hopsworksCluster?.name || 'Hopsworks Instance',
      status: instanceData.status === 'active' ? 'Running' : instanceData.status === 'provisioning' ? 'Provisioning' : 'Stopped',
      endpoint: instanceData.hopsworks_url || hopsworksUrl,
      plan: 'Pay-as-you-go',
      created: instanceData.created_at
    });
  } catch (error) {
    console.error('Error fetching instance:', error);
    return res.status(500).json({ error: 'Failed to fetch instance data' });
  }
}