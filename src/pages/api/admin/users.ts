import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
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
          ),
          user_cluster_assignments (
            cluster_id,
            clusters (
              id,
              name,
              api_url
            )
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
  } else if (req.method === 'POST') {
    // Handle user-cluster assignment
    const { userId, clusterId } = req.body;
    
    try {
      const { error } = await supabase
        .from('user_cluster_assignments')
        .upsert({ user_id: userId, cluster_id: clusterId });
        
      if (error) {
        console.error('Error assigning user to cluster:', error);
        return res.status(500).json({ error: 'Failed to assign user to cluster' });
      }
      
      // Update cluster current_users count
      await supabase.rpc('increment_cluster_users', { cluster_id: clusterId });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    // Handle user-cluster unassignment
    const { userId, clusterId } = req.body;
    
    try {
      const { error } = await supabase
        .from('user_cluster_assignments')
        .delete()
        .match({ user_id: userId, cluster_id: clusterId });
        
      if (error) {
        console.error('Error removing user from cluster:', error);
        return res.status(500).json({ error: 'Failed to remove user from cluster' });
      }
      
      // Update cluster current_users count
      await supabase.rpc('decrement_cluster_users', { cluster_id: clusterId });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

const adminUsersHandler = function (req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}

export default adminUsersHandler;