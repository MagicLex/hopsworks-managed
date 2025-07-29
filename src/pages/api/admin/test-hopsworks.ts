import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { testHopsworksConnection } from '../../../lib/hopsworks-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, clusterId } = req.body;

  if (!userId || !clusterId) {
    return res.status(400).json({ error: 'userId and clusterId are required' });
  }

  try {
    // Get cluster credentials
    const { data: cluster, error: clusterError } = await supabase
      .from('hopsworks_clusters')
      .select('*')
      .eq('id', clusterId)
      .single();

    if (clusterError || !cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Import the Hopsworks API functions
    const { 
      getHopsworksUserByAuth0Id, 
      getUserProjects,
      getAllUsers,
      getAllProjects
    } = await import('../../../lib/hopsworks-api');

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    const results: any = {
      test: 'hopsworks-connection',
      timestamp: new Date().toISOString(),
      cluster: {
        id: cluster.id,
        name: cluster.name,
        api_url: cluster.api_url,
        status: cluster.status
      },
      user: {
        id: user.id,
        email: user.email,
        hopsworks_project_id: user.hopsworks_project_id || 'not_set'
      },
      hopsworksData: {}
    };

    try {
      // Get Hopsworks user by email (since Auth0 IDs aren't stored in Hopsworks)
      const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, user.email);
      results.hopsworksData.user = hopsworksUser;

      if (hopsworksUser) {
        // Get user's projects
        try {
          const projects = await getUserProjects(credentials, hopsworksUser.username);
          results.hopsworksData.projects = projects;
          results.hopsworksData.projectCount = projects.length;
        } catch (projectError) {
          results.hopsworksData.projectsError = projectError instanceof Error ? projectError.message : 'Failed to fetch projects';
        }
      }
    } catch (apiError) {
      results.hopsworksData.userLookupError = apiError instanceof Error ? apiError.message : 'Failed to fetch user';
    }

    // Get cluster statistics
    try {
      const allUsers = await getAllUsers(credentials, `ApiKey ${credentials.apiKey}`);
      results.hopsworksData.totalUsers = allUsers.length;
      results.hopsworksData.activeUsers = allUsers.filter((u: any) => u.status === 2).length;
    } catch (statsError) {
      results.hopsworksData.statsError = statsError instanceof Error ? statsError.message : 'Failed to fetch stats';
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error testing Hopsworks connection:', error);
    return res.status(500).json({ 
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function testHopsworksHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}