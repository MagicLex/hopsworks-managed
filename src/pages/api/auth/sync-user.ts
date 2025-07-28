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

      // Auto-assign user to available Hopsworks cluster
      const { data: clusters } = await supabaseAdmin
        .from('hopsworks_clusters')
        .select('id, current_users, max_users')
        .eq('status', 'active')
        .order('current_users', { ascending: true });
      
      // Find first cluster with available capacity
      const availableCluster = clusters?.find(c => c.current_users < c.max_users);

      if (availableCluster) {
        // Assign user to cluster
        await supabaseAdmin
          .from('user_hopsworks_assignments')
          .insert({
            user_id: userId,
            hopsworks_cluster_id: availableCluster.id
          });
          
        // Increment cluster user count
        await supabaseAdmin.rpc('increment_cluster_users', { 
          cluster_id: availableCluster.id 
        });
      }
    } else {
      // Update last login
      // First get current login count
      const { data: currentUser } = await supabaseAdmin
        .from('users')
        .select('login_count')
        .eq('id', userId)
        .single();
      
      await supabaseAdmin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: (currentUser?.login_count || 0) + 1
        })
        .eq('id', userId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('User sync error:', error);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
}