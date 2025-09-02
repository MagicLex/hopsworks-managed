import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { getUserProjects } from '../../../lib/hopsworks-team';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.sub;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if user is an account owner
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('account_owner_id, hopsworks_username')
      .eq('id', userId)
      .single();

    if (!currentUser || currentUser.account_owner_id !== null) {
      return res.status(403).json({ error: 'Only account owners can access this endpoint' });
    }

    // Get owner's cluster credentials
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select(`
        user_hopsworks_assignments!inner (
          hopsworks_cluster_id,
          hopsworks_clusters!inner (
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (!owner?.user_hopsworks_assignments?.[0]) {
      return res.status(404).json({ error: 'No cluster assignment found' });
    }

    const assignment = owner.user_hopsworks_assignments[0] as any;
    const credentials = {
      apiUrl: assignment.hopsworks_clusters.api_url,
      apiKey: assignment.hopsworks_clusters.api_key
    };

    // First check our database for cached projects
    const { data: dbProjects } = await supabaseAdmin
      .from('user_projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    let projects = [];

    if (dbProjects && dbProjects.length > 0) {
      // We have cached projects
      projects = dbProjects.map(p => ({
        id: p.project_id,
        name: p.project_name,
        namespace: p.namespace,
        fromCache: true
      }));
    } else if (currentUser.hopsworks_username) {
      // No cached projects, try to fetch from Hopsworks
      try {
        const hopsworksProjects = await getUserProjects(credentials, currentUser.hopsworks_username);
        projects = hopsworksProjects;
        
        // Cache these projects in our database
        if (projects.length > 0) {
          const projectsToInsert = projects.map(p => ({
            user_id: userId,
            project_id: p.id || 0,
            project_name: p.name,
            namespace: p.namespace || `project-${p.name}`,
            status: 'active'
          }));
          
          await supabaseAdmin
            .from('user_projects')
            .upsert(projectsToInsert, { 
              onConflict: 'user_id,project_id',
              ignoreDuplicates: false 
            });
        }
      } catch (error) {
        console.error('Failed to fetch projects from Hopsworks:', error);
      }
    }

    return res.status(200).json({ projects });

  } catch (error) {
    console.error('Failed to fetch owner projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}