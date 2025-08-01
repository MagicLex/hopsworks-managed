import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

      // Send email with invite link
      const inviteUrl = `${process.env.AUTH0_BASE_URL}/team/accept-invite?token=${token}`;

      // Get inviter's details
      const { data: inviter } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', userId)
        .single();

      const inviterName = inviter?.name || inviter?.email || 'Your colleague';

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Hopsworks <no-reply@hopsworks.com>',
          to: email,
          subject: `${inviterName} invited you to join their Hopsworks team`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">You've been invited to join a Hopsworks team</h2>
              
              <p style="color: #666; line-height: 1.6;">
                ${inviterName} has invited you to join their team on Hopsworks. 
                As a team member, you'll have access to Hopsworks and your usage will be billed to the team account.
              </p>

              <div style="margin: 30px 0;">
                <a href="${inviteUrl}" 
                   style="background-color: #1eb182; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Accept Invitation
                </a>
              </div>

              <p style="color: #999; font-size: 14px;">
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>

              <p style="color: #999; font-size: 14px; margin-top: 30px;">
                Or copy and paste this link: <br>
                <a href="${inviteUrl}" style="color: #1eb182;">${inviteUrl}</a>
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Don't fail the whole operation if email fails
      }

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