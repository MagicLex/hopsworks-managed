import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

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

  if (req.method === 'POST') {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if user is an account owner (account_owner_id is NULL)
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('account_owner_id')
        .eq('id', userId)
        .single();

      if (userError || !currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (currentUser.account_owner_id !== null) {
        return res.status(403).json({ error: 'Only account owners can invite team members' });
      }

      // Check if email is already a user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Check if there's already a pending invite
      const { data: existingInvite } = await supabase
        .from('team_invites')
        .select('id')
        .eq('email', email)
        .eq('account_owner_id', userId)
        .is('accepted_at', null)
        .single();

      if (existingInvite) {
        return res.status(400).json({ error: 'Invite already sent to this email' });
      }

      // Generate invite token
      const token = randomBytes(32).toString('hex');

      // Create invite
      const { data: invite, error: inviteError } = await supabase
        .from('team_invites')
        .insert({
          account_owner_id: userId,
          email,
          token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
        .select()
        .single();

      if (inviteError) {
        console.error('Failed to create invite:', inviteError);
        return res.status(500).json({ error: 'Failed to create invite' });
      }

      // TODO: Send email with invite link
      const inviteUrl = `${process.env.AUTH0_BASE_URL}/team/accept-invite?token=${token}`;

      return res.status(200).json({ 
        message: 'Invite sent successfully',
        invite: {
          id: invite.id,
          email: invite.email,
          expires_at: invite.expires_at,
          invite_url: inviteUrl
        }
      });

    } catch (error) {
      console.error('Team invite error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    try {
      // List pending invites for the account owner
      const { data: invites, error } = await supabase
        .from('team_invites')
        .select('*')
        .eq('account_owner_id', userId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch invites:', error);
        return res.status(500).json({ error: 'Failed to fetch invites' });
      }

      return res.status(200).json({ invites });

    } catch (error) {
      console.error('List invites error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { inviteId } = req.query;

      if (!inviteId || typeof inviteId !== 'string') {
        return res.status(400).json({ error: 'Invite ID is required' });
      }

      // Delete invite (only if owned by current user and not accepted)
      const { error } = await supabase
        .from('team_invites')
        .delete()
        .eq('id', inviteId)
        .eq('account_owner_id', userId)
        .is('accepted_at', null);

      if (error) {
        console.error('Failed to delete invite:', error);
        return res.status(500).json({ error: 'Failed to delete invite' });
      }

      return res.status(200).json({ message: 'Invite deleted successfully' });

    } catch (error) {
      console.error('Delete invite error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}