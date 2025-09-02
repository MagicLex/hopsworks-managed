import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { addUserToProject, createGroupMapping, getUserProjects } from '../../../lib/hopsworks-team';

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

  if (req.method === 'GET') {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID required' });
    }

    try {
      // Get user's cluster and Hopsworks username
      const { data: user } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          hopsworks_username,
          account_owner_id,
          user_hopsworks_assignments!inner (
            hopsworks_cluster_id,
            hopsworks_username,
            hopsworks_clusters!inner (
              api_url,
              api_key
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (!user || !user.user_hopsworks_assignments?.[0]) {
        return res.status(404).json({ error: 'User not found or not assigned to cluster' });
      }

      const assignment = user.user_hopsworks_assignments[0];
      const cluster = (assignment as any).hopsworks_clusters;
      const credentials = {
        apiUrl: cluster.api_url,
        apiKey: cluster.api_key
      };

      const hopsworksUsername = user.hopsworks_username || assignment.hopsworks_username;
      
      if (!hopsworksUsername) {
        return res.status(400).json({ error: 'User has no Hopsworks username' });
      }

      // Get user's projects from Hopsworks
      const projects = await getUserProjects(credentials, hopsworksUsername);

      return res.status(200).json({ projects });

    } catch (error) {
      console.error('Failed to fetch user projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

  } else if (req.method === 'POST') {
    const { userId, projectName, role, action } = req.body;

    if (!userId || !projectName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    const validRoles = ['Data owner', 'Data scientist', 'Observer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Valid roles: Data owner, Data scientist, Observer' });
    }

    try {
      // Get user and cluster info
      const { data: user } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          hopsworks_username,
          account_owner_id,
          user_hopsworks_assignments!inner (
            hopsworks_cluster_id,
            hopsworks_username,
            hopsworks_clusters!inner (
              api_url,
              api_key
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (!user || !user.user_hopsworks_assignments?.[0]) {
        return res.status(404).json({ error: 'User not found or not assigned to cluster' });
      }

      const assignment = user.user_hopsworks_assignments[0];
      const cluster = (assignment as any).hopsworks_clusters;
      const credentials = {
        apiUrl: cluster.api_url,
        apiKey: cluster.api_key
      };

      const hopsworksUsername = user.hopsworks_username || assignment.hopsworks_username;

      if (!hopsworksUsername) {
        return res.status(400).json({ error: 'User has no Hopsworks username' });
      }

      if (action === 'add') {
        // Add user to project with specified role
        await addUserToProject(credentials, projectName, hopsworksUsername, role as any);

        // If this is a team member, also create group mapping for OAuth
        if (user.account_owner_id) {
          // Create a unique group name for this user's team access
          const groupName = `team_${user.account_owner_id}_${userId}`;
          await createGroupMapping(credentials, projectName, [groupName], role as any);
        }

        return res.status(200).json({ 
          message: `User added to project ${projectName} as ${role}`,
          project: projectName,
          role 
        });

      } else if (action === 'remove') {
        // Remove user from project
        // Note: Hopsworks API doesn't have a direct remove endpoint, 
        // you'd need to implement this in hopsworks-team.ts
        return res.status(501).json({ error: 'Remove functionality not yet implemented' });

      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

    } catch (error) {
      console.error('Failed to manage project role:', error);
      return res.status(500).json({ error: 'Failed to update project role' });
    }

  } else if (req.method === 'PUT') {
    // Bulk assign team member to all owner's projects
    const { teamMemberId, ownerId, defaultRole = 'Data scientist' } = req.body;

    if (!teamMemberId || !ownerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // Get owner's cluster and projects
      const { data: owner } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          hopsworks_username,
          user_hopsworks_assignments!inner (
            hopsworks_cluster_id,
            hopsworks_clusters!inner (
              api_url,
              api_key
            )
          )
        `)
        .eq('id', ownerId)
        .single();

      if (!owner || !owner.user_hopsworks_assignments?.[0]) {
        return res.status(404).json({ error: 'Owner not found or not assigned to cluster' });
      }

      // Get team member info
      const { data: teamMember } = await supabaseAdmin
        .from('users')
        .select('hopsworks_username, email')
        .eq('id', teamMemberId)
        .single();

      if (!teamMember?.hopsworks_username) {
        return res.status(400).json({ error: 'Team member has no Hopsworks username' });
      }

      const assignment = owner.user_hopsworks_assignments[0];
      const cluster = (assignment as any).hopsworks_clusters;
      const credentials = {
        apiUrl: cluster.api_url,
        apiKey: cluster.api_key
      };

      // Get owner's projects
      const ownerProjects = await getUserProjects(credentials, owner.hopsworks_username!);

      const addedToProjects: string[] = [];
      const errors: string[] = [];

      // Add team member to each project
      for (const project of ownerProjects) {
        try {
          await addUserToProject(
            credentials, 
            project.name, 
            teamMember.hopsworks_username, 
            defaultRole as any
          );
          addedToProjects.push(project.name);
        } catch (error) {
          errors.push(`Failed to add to ${project.name}: ${error}`);
        }
      }

      return res.status(200).json({ 
        message: 'Team member added to owner projects',
        addedToProjects,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error('Failed to assign team member to projects:', error);
      return res.status(500).json({ error: 'Failed to assign team member' });
    }

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}