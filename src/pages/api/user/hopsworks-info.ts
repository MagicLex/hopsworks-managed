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

      // Get user's projects - check owned projects AND team member access
      let projects: any[] = [];

      // First check if user is a team member with project access
      const { data: memberProjects } = await supabaseAdmin
        .from('project_member_roles')
        .select('project_id, project_name, role')
        .eq('member_id', userId)
        .eq('synced_to_hopsworks', true);

      if (memberProjects && memberProjects.length > 0) {
        // Team member with project access
        projects = memberProjects.map(p => ({
          id: p.project_id,
          name: p.project_name,
          role: p.role,
          owner: 'team', // Team project
          created: new Date().toISOString()
        }));
        console.log(`Found ${projects.length} team projects for ${userData.email}`);
      } else {
        // Try to get owned projects from cache
        const { data: cachedProjects } = await supabaseAdmin
          .from('user_projects')
          .select('project_id, project_name, namespace')
          .eq('user_id', userId)
          .eq('status', 'active');

        // Use cache only if count matches Hopsworks (avoids stale data after project deletion)
        const cacheIsValid = cachedProjects &&
          cachedProjects.length > 0 &&
          cachedProjects.length === hopsworksUser.numActiveProjects;

        if (cacheIsValid) {
          projects = cachedProjects.map(p => ({
            id: p.project_id,
            name: p.project_name,
            namespace: p.namespace,
            owner: hopsworksUser.username,
            created: new Date().toISOString()
          }));
          console.log(`Using ${projects.length} cached projects for ${userData.email}`);
        } else {
          // Cache mismatch or empty - invalidate stale entries and fetch fresh
          if (cachedProjects && cachedProjects.length !== hopsworksUser.numActiveProjects) {
            console.log(`Cache mismatch for ${userData.email}: cached=${cachedProjects.length}, actual=${hopsworksUser.numActiveProjects} - refetching`);
            // Mark all cached projects as potentially stale
            await supabaseAdmin
              .from('user_projects')
              .update({ status: 'pending_verification' })
              .eq('user_id', userId)
              .eq('status', 'active');
          }
          // Fallback to API if no cached projects
          try {
            const apiProjects = await getUserProjects(credentials, hopsworksUser.username, hopsworksUser.id);
            projects = apiProjects;

            // Cache these projects for next time (filter out any without namespace)
            const validProjects = apiProjects.filter((p: any) => {
              if (!p.namespace) {
                console.error(`[BILLING] Project ${p.name} (id: ${p.id}) missing namespace field - skipping cache`);
                return false;
              }
              return true;
            });

            if (validProjects.length > 0) {
              const projectsToCache = validProjects.map((p: any) => ({
                user_id: userId,
                project_id: p.id,
                project_name: p.name,
                namespace: p.namespace,
                status: 'active'
              }));

              await supabaseAdmin
                .from('user_projects')
                .upsert(projectsToCache, {
                  onConflict: 'user_id,project_id',
                  ignoreDuplicates: false
                });

              console.log(`Cached ${validProjects.length} projects for ${userData.email}`);
            }
          } catch (error) {
            console.error('Error fetching projects from API:', error);
          }
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