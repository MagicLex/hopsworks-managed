import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { addUserToProject, getUserProjects } from '../../../lib/hopsworks-team';

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

  // Check if user is an account owner
  const { data: currentUser } = await supabaseAdmin
    .from('users')
    .select('account_owner_id')
    .eq('id', userId)
    .single();

  if (!currentUser || currentUser.account_owner_id !== null) {
    return res.status(403).json({ error: 'Only account owners can manage team projects' });
  }

  if (req.method === 'GET') {
    const { memberId } = req.query;
    
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json({ error: 'Member ID required' });
    }

    try {
      // Verify the member belongs to this owner's team
      const { data: teamMember } = await supabaseAdmin
        .from('users')
        .select('account_owner_id, hopsworks_username')
        .eq('id', memberId)
        .single();

      if (!teamMember || teamMember.account_owner_id !== userId) {
        return res.status(403).json({ error: 'Member not in your team' });
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

      // First, get projects from our database
      const { data: dbProjects, error: dbError } = await supabaseAdmin
        .from('project_member_roles')
        .select('*')
        .eq('member_id', memberId)
        .eq('account_owner_id', userId);

      if (dbError) {
        console.error('Failed to fetch projects from database:', dbError);
      }

      // Format the response
      const projects = dbProjects?.map(p => ({
        id: p.project_id,
        name: p.project_name,
        namespace: p.project_namespace,
        role: p.role,
        synced: p.synced_to_hopsworks,
        lastSyncAt: p.last_sync_at,
        syncError: p.sync_error
      })) || [];

      // If user has hopsworks username but no projects in DB, try to fetch from Hopsworks
      // This handles backward compatibility
      if (teamMember.hopsworks_username && projects.length === 0) {
        try {
          const hopsworksProjects = await getUserProjects(credentials, teamMember.hopsworks_username);
          // These won't have roles, but at least we show the projects
          return res.status(200).json({ 
            projects: hopsworksProjects.map(p => ({
              ...p,
              role: null, // Unknown role
              synced: false,
              fromHopsworks: true // Flag to indicate this came from Hopsworks directly
            }))
          });
        } catch (error) {
          console.error('Failed to fetch from Hopsworks:', error);
        }
      }

      return res.status(200).json({ projects });

    } catch (error) {
      console.error('Failed to fetch member projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

  } else if (req.method === 'POST') {
    const { memberId, projectName, projectId, role, action } = req.body;

    if (!memberId || !projectName || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    const validRoles = ['Data owner', 'Data scientist', 'Observer'];
    if (action === 'add' && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    try {
      // Verify the member belongs to this owner's team
      const { data: teamMember } = await supabaseAdmin
        .from('users')
        .select('account_owner_id, hopsworks_username, email')
        .eq('id', memberId)
        .single();

      if (!teamMember || teamMember.account_owner_id !== userId) {
        return res.status(403).json({ error: 'Member not in your team' });
      }

      if (!teamMember.hopsworks_username) {
        return res.status(400).json({ error: 'Member has no Hopsworks username yet' });
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

      if (action === 'add') {
        // First, save to our database
        const { data: roleRecord, error: dbError } = await supabaseAdmin
          .rpc('upsert_project_member_role', {
            p_member_id: memberId,
            p_owner_id: userId,
            p_project_id: projectId || 0, // Will need to get this from Hopsworks
            p_project_name: projectName,
            p_role: role,
            p_added_by: userId
          });

        if (dbError) {
          console.error('Failed to save role to database:', dbError);
        }

        try {
          // Then sync to Hopsworks
          await addUserToProject(credentials, projectName, teamMember.hopsworks_username, role as any);
          
          // Mark as synced if successful
          if (roleRecord) {
            await supabaseAdmin
              .from('project_member_roles')
              .update({ 
                synced_to_hopsworks: true, 
                last_sync_at: new Date().toISOString(),
                sync_error: null 
              })
              .eq('id', roleRecord);
          }
        } catch (hopsworksError: any) {
          // If Hopsworks sync fails, remove the database record and return error
          if (roleRecord) {
            await supabaseAdmin
              .from('project_member_roles')
              .delete()
              .eq('id', roleRecord);
          }
          
          // Return error to owner
          const errorMessage = hopsworksError.message || 'Failed to sync to Hopsworks';
          console.error('Hopsworks sync failed:', errorMessage);
          return res.status(500).json({ 
            error: 'Failed to add user to project in Hopsworks. The cluster may need to be upgraded to support OAuth group mappings. Please contact support.',
            details: errorMessage
          });
        }

        return res.status(200).json({ 
          message: `Successfully added ${teamMember.email} to ${projectName} as ${role}`,
          project: projectName,
          role,
          synced: true
        });

      } else if (action === 'remove') {
        // Remove from our database
        const { error: dbError } = await supabaseAdmin
          .from('project_member_roles')
          .delete()
          .eq('member_id', memberId)
          .eq('project_name', projectName);

        if (dbError) {
          console.error('Failed to remove role from database:', dbError);
          return res.status(500).json({ error: 'Failed to remove project role' });
        }

        // TODO: Once Hopsworks supports removal, add sync here
        // For now, we just track removal locally
        return res.status(200).json({ 
          message: `Removed ${teamMember.email} from ${projectName}`,
          project: projectName,
          localOnly: true // Indicates this is only removed locally
        });

      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

    } catch (error) {
      console.error('Failed to manage project role:', error);
      return res.status(500).json({ error: 'Failed to update project role' });
    }

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}