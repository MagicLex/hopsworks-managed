import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { oauth_subject, email, project_id } = req.query;

  try {
    let query = supabase
      .from('users')
      .select(`
        *,
        user_credits (
          balance,
          total_purchased,
          total_used
        ),
        user_hopsworks_assignments (
          assigned_at,
          hopsworks_clusters (
            id,
            name,
            api_url
          )
        )
      `);

    // Search by OAuth subject (Auth0 ID)
    if (oauth_subject && typeof oauth_subject === 'string') {
      query = query.eq('id', oauth_subject);
    }

    // Search by email
    if (email && typeof email === 'string') {
      query = query.eq('email', email);
    }

    // Search by Hopsworks project ID (stored in hopsworks_project_id)
    if (project_id && typeof project_id === 'string') {
      query = query.eq('hopsworks_project_id', project_id);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Error searching users:', error);
      return res.status(500).json({ error: 'Failed to search users' });
    }

    // Format response for Hopsworks compatibility
    const formattedUsers = users?.map(user => ({
      id: user.id, // Auth0 ID
      email: user.email,
      name: user.name,
      hopsworksUsername: user.hopsworks_project_id, // We store username here
      cluster: user.user_hopsworks_assignments?.[0]?.hopsworks_clusters || null,
      billingMode: user.billing_mode,
      creditBalance: user.user_credits?.balance || 0,
      status: user.status,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    }));

    return res.status(200).json({ 
      users: formattedUsers || [],
      count: formattedUsers?.length || 0
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const adminUserSearchHandler = function (req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}

export default adminUserSearchHandler;