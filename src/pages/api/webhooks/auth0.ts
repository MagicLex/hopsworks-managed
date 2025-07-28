import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
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
  // Verify webhook secret
  const secret = req.headers['x-auth0-secret'];
  if (secret !== process.env.AUTH0_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, email, name, ip, created_at, logins_count } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();

    if (!existingUser) {
      // Create new user
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user_id,
          email,
          name,
          registration_ip: ip,
          created_at: created_at || new Date().toISOString(),
          login_count: logins_count || 0,
          status: 'active'
        });

      if (userError) throw userError;

      // Create user credits record
      const { error: creditsError } = await supabaseAdmin
        .from('user_credits')
        .insert({
          user_id
        });

      if (creditsError) throw creditsError;
    } else {
      // Update existing user
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: logins_count || 0
        })
        .eq('id', user_id);

      if (updateError) throw updateError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Auth0 webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}