import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { assignUserToCluster } from '@/lib/cluster-assignment';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { token } = req.body;
    const userId = session.user.sub;
    const userEmail = session.user.email;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid invite token' });
    }

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite has expired' });
    }

    // Verify email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'This invite is for a different email address' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, account_owner_id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      // User exists - check if they're already part of a team
      if (existingUser.account_owner_id) {
        return res.status(400).json({ error: 'You are already part of a team' });
      }

      // Update existing user to be part of the team
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          account_owner_id: invite.account_owner_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update user:', updateError);
        return res.status(500).json({ error: 'Failed to join team' });
      }
    } else {
      // Create new user as team member
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: userEmail,
          name: session.user.name || null,
          account_owner_id: invite.account_owner_id,
          status: 'active',
          login_count: 1,
          last_login_at: new Date().toISOString(),
          metadata: {}
        });

      if (createError) {
        console.error('Failed to create user:', createError);
        return res.status(500).json({ error: 'Failed to join team' });
      }
    }

    // Mark invite as accepted
    const { error: acceptError } = await supabase
      .from('team_invites')
      .update({ 
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId
      })
      .eq('id', invite.id);

    if (acceptError) {
      console.error('Failed to mark invite as accepted:', acceptError);
      // Don't fail the whole operation
    }

    // Assign team member to cluster (same as account owner)
    const clusterAssignment = await assignUserToCluster(supabase, userId);
    
    if (!clusterAssignment.success) {
      console.log('Failed to assign team member to cluster:', clusterAssignment.error);
      // Don't fail the join operation, they can be assigned later
    }

    // If auto_assign_projects is true and we have a cluster, add to owner's projects
    let projectsAssigned: string[] = [];
    if (invite.auto_assign_projects && clusterAssignment.success) {
      try {
        // Get owner's cluster and Hopsworks username
        const { data: owner } = await supabase
          .from('users')
          .select(`
            hopsworks_username,
            user_hopsworks_assignments!inner (
              hopsworks_cluster_id,
              hopsworks_clusters!inner (
                api_url,
                api_key
              )
            )
          `)
          .eq('id', invite.account_owner_id)
          .single();

        // Get team member's Hopsworks username (might need to wait for it to be created)
        const { data: teamMember } = await supabase
          .from('users')
          .select('hopsworks_username')
          .eq('id', userId)
          .single();

        if (owner?.hopsworks_username && teamMember?.hopsworks_username) {
          const { getUserProjects, addUserToProject } = await import('@/lib/hopsworks-team');
          const assignment = owner.user_hopsworks_assignments[0] as any;
          const credentials = {
            apiUrl: assignment.hopsworks_clusters.api_url,
            apiKey: assignment.hopsworks_clusters.api_key
          };

          // Get owner's projects
          const ownerProjects = await getUserProjects(credentials, owner.hopsworks_username);
          const projectRole = invite.project_role || 'Data scientist';

          // Add team member to each project
          for (const project of ownerProjects) {
            try {
              await addUserToProject(credentials, project.name, teamMember.hopsworks_username, projectRole);
              projectsAssigned.push(project.name);
              console.log(`Added ${userEmail} to project ${project.name} as ${projectRole}`);
            } catch (error) {
              console.error(`Failed to add ${userEmail} to project ${project.name}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to auto-assign projects:', error);
        // Don't fail the join operation
      }
    }

    return res.status(200).json({ 
      message: 'Successfully joined team',
      account_owner_id: invite.account_owner_id,
      cluster_assigned: clusterAssignment.success,
      projects_assigned: projectsAssigned
    });

  } catch (error) {
    console.error('Join team error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}