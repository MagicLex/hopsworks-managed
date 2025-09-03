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

    // Get user with their cluster assignment
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select(`
        email,
        user_hopsworks_assignments (
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

    if (!userData?.user_hopsworks_assignments?.[0]?.hopsworks_clusters) {
      return res.status(200).json({
        hasCluster: false,
        message: 'No Hopsworks cluster assigned'
      });
    }

    const clusterData = userData.user_hopsworks_assignments[0].hopsworks_clusters;
    // Handle both array and single object response from Supabase
    const cluster = Array.isArray(clusterData) ? clusterData[0] : clusterData;
    
    if (!cluster) {
      return res.status(200).json({
        hasCluster: true,
        clusterName: 'Unknown',
        error: 'Cluster data not found'
      });
    }
    
    try {
      const { getHopsworksUserByAuth0Id, getUserProjects } = await import('../../../lib/hopsworks-api');
      
      const credentials = {
        apiUrl: cluster.api_url,
        apiKey: cluster.api_key
      };

      // Get Hopsworks user
      const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, userData.email);
      
      if (!hopsworksUser) {
        return res.status(200).json({
          hasCluster: true,
          clusterName: cluster.name,
          hasHopsworksUser: false,
          message: 'User not found in Hopsworks'
        });
      }

      // Get user's projects
      let projects: any[] = [];
      try {
        projects = await getUserProjects(credentials, hopsworksUser.username, hopsworksUser.id);
      } catch (error) {
        console.error('Error fetching projects:', error);
      }

      return res.status(200).json({
        hasCluster: true,
        clusterName: cluster.name,
        clusterEndpoint: cluster.api_url.replace('/hopsworks-api/api', ''),
        hasHopsworksUser: true,
        hopsworksUser: {
          username: hopsworksUser.username,
          email: hopsworksUser.email,
          accountType: hopsworksUser.accountType,
          status: hopsworksUser.status,
          maxNumProjects: hopsworksUser.maxNumProjects,
          numActiveProjects: hopsworksUser.numActiveProjects,
          activated: hopsworksUser.activated
        },
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          owner: p.owner,
          created: p.created
        }))
      });
    } catch (error) {
      console.error('Error fetching Hopsworks data:', error);
      return res.status(200).json({
        hasCluster: true,
        clusterName: cluster.name,
        error: 'Failed to fetch Hopsworks data'
      });
    }
  } catch (error) {
    console.error('Error in hopsworks-info:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}