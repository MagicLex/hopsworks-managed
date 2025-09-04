import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.sub;

  if (req.method === 'GET') {
    try {
      // Check if user is an account owner
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('account_owner_id')
        .eq('id', userId)
        .single();

      if (userError || !currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // If user is a team member, they can only see their own team
      const accountOwnerId = currentUser.account_owner_id || userId;

      // Get all team members for this account
      const { data: teamMembers, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          last_login_at,
          hopsworks_username,
          status
        `)
        .eq('account_owner_id', accountOwnerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch team members:', error);
        return res.status(500).json({ error: 'Failed to fetch team members' });
      }

      // Also get the account owner info
      const { data: owner, error: ownerError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          stripe_customer_id
        `)
        .eq('id', accountOwnerId)
        .single();

      if (ownerError) {
        console.error('Failed to fetch owner:', ownerError);
        return res.status(500).json({ error: 'Failed to fetch account owner' });
      }

      return res.status(200).json({
        account_owner: owner,
        team_members: teamMembers || [],
        is_owner: userId === accountOwnerId
      });

    } catch (error) {
      console.error('List team members error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { memberId } = req.query;

      if (!memberId || typeof memberId !== 'string') {
        return res.status(400).json({ error: 'Member ID is required' });
      }

      // Only account owners can remove team members
      const { data: currentUser } = await supabase
        .from('users')
        .select('account_owner_id')
        .eq('id', userId)
        .single();

      if (currentUser?.account_owner_id !== null) {
        return res.status(403).json({ error: 'Only account owners can remove team members' });
      }

      // Verify the member belongs to this account
      const { data: member, error: memberError } = await supabase
        .from('users')
        .select('account_owner_id')
        .eq('id', memberId)
        .single();

      if (memberError || !member || member.account_owner_id !== userId) {
        return res.status(404).json({ error: 'Team member not found' });
      }

      // Remove team member by setting account_owner_id to NULL
      // This converts them to a standalone account
      const { error } = await supabase
        .from('users')
        .update({ 
          account_owner_id: null
        })
        .eq('id', memberId);

      if (error) {
        console.error('Failed to remove team member:', error);
        return res.status(500).json({ error: 'Failed to remove team member' });
      }

      return res.status(200).json({ message: 'Team member removed successfully' });

    } catch (error) {
      console.error('Remove team member error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PATCH') {
    // PATCH endpoint removed - team member project assignment should be handled via user_projects table
    return res.status(501).json({ error: 'Team member project assignment has been deprecated' });
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}