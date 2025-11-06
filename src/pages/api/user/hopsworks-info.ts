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
      const { getHopsworksUserByEmail, getUserProjects } = await import('../../../lib/hopsworks-api');
      
      const credentials = {
        apiUrl: cluster.api_url,
        apiKey: cluster.api_key
      };

      // Get Hopsworks user
      const hopsworksUser = await getHopsworksUserByEmail(credentials, userData.email);
      
      if (!hopsworksUser) {
        return res.status(200).json({
          hasCluster: true,
          clusterName: cluster.name,
          hasHopsworksUser: false,
          message: 'User not found in Hopsworks'
        });
      }

      // Get user's projects - FIRST try from cache, then fallback to API
      let projects: any[] = [];
      let projectSource = 'cache';
      
      // Try to get projects from our database cache first (for billing accuracy)
      const { data: cachedProjects } = await supabaseAdmin
        .from('user_projects')
        .select('project_id, project_name, namespace')
        .eq('user_id', userId)
        .eq('status', 'active');
      
      if (cachedProjects && cachedProjects.length > 0) {
        // Use cached projects
        projects = cachedProjects.map(p => ({
          id: p.project_id,
          name: p.project_name,
          namespace: p.namespace,
          owner: hopsworksUser.username,
          created: new Date().toISOString() // We don't store creation date
        }));
        console.log(`Using ${projects.length} cached projects for ${userData.email}`);
      } else {
        // Fallback to API if no cached projects
        try {
          projectSource = 'api';
          const apiProjects = await getUserProjects(credentials, hopsworksUser.username, hopsworksUser.id);
          projects = apiProjects;
          
          // Cache these projects for next time
          if (apiProjects.length > 0) {
            const projectsToCache = apiProjects.map((p: any) => ({
              user_id: userId,
              project_id: p.id,
              project_name: p.name,
              namespace: `project-${p.name}`,
              status: 'active'
            }));
            
            await supabaseAdmin
              .from('user_projects')
              .upsert(projectsToCache, { 
                onConflict: 'user_id,project_id',
                ignoreDuplicates: false 
              });
            
            console.log(`Cached ${apiProjects.length} projects for ${userData.email}`);
          }
        } catch (error) {
          console.error('Error fetching projects from API:', error);
        }
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