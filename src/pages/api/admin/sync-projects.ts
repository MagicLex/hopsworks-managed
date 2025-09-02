import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { getAllProjects } from '../../../lib/hopsworks-validation';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const { data: currentUser } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', session.user.sub)
    .single();

  if (!currentUser?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get a cluster to use for validation
    const { data: cluster } = await supabaseAdmin
      .from('hopsworks_clusters')
      .select('api_url, api_key')
      .eq('status', 'active')
      .single();

    if (!cluster) {
      return res.status(404).json({ error: 'No active cluster found' });
    }

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    // Get all projects from Hopsworks
    const hopsworksProjects = await getAllProjects(credentials);
    const hopsworksProjectNames = new Set(hopsworksProjects.map(p => p.name));
    const hopsworksProjectIds = new Set(hopsworksProjects.map(p => p.id));

    // Get all projects from our database
    const { data: dbProjects } = await supabaseAdmin
      .from('user_projects')
      .select('*');

    const { data: dbRoles } = await supabaseAdmin
      .from('project_member_roles')
      .select('*');

    let stats = {
      projectsInHopsworks: hopsworksProjects.length,
      projectsInDb: dbProjects?.length || 0,
      rolesInDb: dbRoles?.length || 0,
      deletedProjects: 0,
      deletedRoles: 0,
      updatedProjects: 0
    };

    // Clean up user_projects table
    if (dbProjects) {
      for (const project of dbProjects) {
        if (!hopsworksProjectNames.has(project.project_name)) {
          // Project no longer exists in Hopsworks
          await supabaseAdmin
            .from('user_projects')
            .delete()
            .eq('id', project.id);
          stats.deletedProjects++;
          console.log(`Deleted stale project: ${project.project_name}`);
        }
      }
    }

    // Clean up project_member_roles table
    if (dbRoles) {
      for (const role of dbRoles) {
        if (!hopsworksProjectNames.has(role.project_name)) {
          // Project no longer exists
          await supabaseAdmin
            .from('project_member_roles')
            .delete()
            .eq('id', role.id);
          stats.deletedRoles++;
          console.log(`Deleted stale role for project: ${role.project_name}`);
        }
      }
    }

    // Update project IDs if they're missing
    for (const hProject of hopsworksProjects) {
      // Update user_projects
      const { error: updateError1 } = await supabaseAdmin
        .from('user_projects')
        .update({ 
          project_id: hProject.id,
          last_seen_at: new Date().toISOString()
        })
        .eq('project_name', hProject.name)
        .is('project_id', null);

      // Update project_member_roles
      const { error: updateError2 } = await supabaseAdmin
        .from('project_member_roles')
        .update({ 
          project_id: hProject.id 
        })
        .eq('project_name', hProject.name)
        .or('project_id.is.null,project_id.eq.0');

      if (!updateError1 || !updateError2) {
        stats.updatedProjects++;
      }
    }

    return res.status(200).json({
      message: 'Project sync completed',
      stats,
      currentProjects: Array.from(hopsworksProjectNames)
    });

  } catch (error: any) {
    console.error('Failed to sync projects:', error);
    return res.status(500).json({ 
      error: 'Failed to sync projects', 
      details: error.message 
    });
  }
}