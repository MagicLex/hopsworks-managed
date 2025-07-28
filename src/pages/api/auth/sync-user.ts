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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { sub: userId, email, name } = session.user;

    // Check if user exists in our database
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingUser) {
      // Create new user
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email,
          name: name || null,
          registration_source: 'organic',
          registration_ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
          status: 'active'
        });

      if (userError && userError.code !== '23505') { // Ignore duplicate key errors
        throw userError;
      }

      // Create user credits record
      await supabaseAdmin
        .from('user_credits')
        .insert({ user_id: userId });

      // Create initial instance record
      await supabaseAdmin
        .from('instances')
        .insert({
          user_id: userId,
          instance_name: `hopsworks-${userId.slice(-8)}`,
          status: 'provisioning'
        });
    } else {
      // Update last login
      await supabaseAdmin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: supabaseAdmin.sql`login_count + 1`
        })
        .eq('id', userId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('User sync error:', error);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
}