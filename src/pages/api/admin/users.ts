import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { assignUserToCluster } from '../../../lib/cluster-assignment';

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
          user_hopsworks_assignments (
            hopsworks_cluster_id,
            hopsworks_clusters (
              id,
              name,
              api_url
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      // Get last 24h OpenCost data for each user
      if (users) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Get user projects and recent costs
        const { data: userProjects } = await supabase
          .from('user_projects')
          .select('user_id, namespace, project_name')
          .eq('status', 'active');
        
        const { data: recentUsage } = await supabase
          .from('usage_daily')
          .select('user_id, opencost_total_cost')
          .gte('date', yesterday.toISOString().split('T')[0]);
        
        // Aggregate data per user
        const userCosts = new Map();
        const userNamespaces = new Map();
        
        if (userProjects) {
          userProjects.forEach(project => {
            if (!userNamespaces.has(project.user_id)) {
              userNamespaces.set(project.user_id, []);
            }
            userNamespaces.get(project.user_id).push(project.namespace);
          });
        }
        
        if (recentUsage) {
          recentUsage.forEach(usage => {
            const current = userCosts.get(usage.user_id) || 0;
            userCosts.set(usage.user_id, current + (usage.opencost_total_cost || 0));
          });
        }
        
        // Add to user objects
        users.forEach(user => {
          user.last_24h_cost = userCosts.get(user.id) || 0;
          user.active_namespaces = userNamespaces.get(user.id) || [];
        });
      }

      if (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      return res.status(200).json({ users: users || [] });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    // Handle manual user-cluster assignment by admin
    const { userId, clusterId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    try {
      // Use manual assignment flag to bypass payment check
      const { success, error } = await assignUserToCluster(
        supabase, 
        userId, 
        true // isManualAssignment = true
      );
      
      if (!success) {
        return res.status(400).json({ error: error || 'Failed to assign cluster' });
      }
      
      return res.status(200).json({ success: true, message: `User assigned to cluster` });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    // Handle user-cluster unassignment
    const { userId, clusterId } = req.body;
    
    try {
      const { error } = await supabase
        .from('user_hopsworks_assignments')
        .delete()
        .match({ user_id: userId, hopsworks_cluster_id: clusterId });
        
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