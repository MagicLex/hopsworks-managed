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

      if (!teamMember.hopsworks_username) {
        return res.status(200).json({ projects: [] });
      }

      // Get member's projects
      const projects = await getUserProjects(credentials, teamMember.hopsworks_username);

      return res.status(200).json({ projects });

    } catch (error) {
      console.error('Failed to fetch member projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

  } else if (req.method === 'POST') {
    const { memberId, projectName, role, action } = req.body;

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
        // Add member to project with specified role
        await addUserToProject(credentials, projectName, teamMember.hopsworks_username, role as any);

        return res.status(200).json({ 
          message: `Added ${teamMember.email} to ${projectName} as ${role}`,
          project: projectName,
          role 
        });

      } else if (action === 'remove') {
        // Note: Hopsworks API doesn't have a direct remove endpoint
        // This would need to be implemented in hopsworks-team.ts
        return res.status(501).json({ error: 'Remove functionality requires Hopsworks API support' });

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