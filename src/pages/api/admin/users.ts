import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        *,
        user_credits (
          total_purchased,
          total_used,
          cpu_hours_used,
          gpu_hours_used,
          storage_gb_months
        ),
        instances (
          instance_name,
          status,
          hopsworks_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const adminUsersHandler = function (req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}

export default adminUsersHandler;