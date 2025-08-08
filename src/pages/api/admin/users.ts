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
      
      // Get last 24h OpenCost data and project details for each user
      if (users) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const today = new Date().toISOString().split('T')[0];
        
        // Get all user projects
        const { data: userProjects } = await supabase
          .from('user_projects')
          .select('user_id, namespace, project_name, project_id')
          .eq('status', 'active');
        
        // Get today's usage with project breakdown
        const { data: todayUsage } = await supabase
          .from('usage_daily')
          .select('user_id, opencost_total_cost, project_breakdown')
          .eq('date', today);
        
        // Get yesterday's usage for 24h comparison
        const { data: yesterdayUsage } = await supabase
          .from('usage_daily')
          .select('user_id, opencost_total_cost')
          .eq('date', yesterday.toISOString().split('T')[0]);
        
        // Build user data
        users.forEach(user => {
          // Get user's projects
          const projects = userProjects?.filter(p => p.user_id === user.id) || [];
          const todayData = todayUsage?.find(u => u.user_id === user.id);
          const yesterdayData = yesterdayUsage?.find(u => u.user_id === user.id);
          
          // Calculate 24h cost
          user.last_24h_cost = (todayData?.opencost_total_cost || 0) + (yesterdayData?.opencost_total_cost || 0);
          
          // Build project details with costs
          user.projects = projects.map(project => {
            const projectCost = todayData?.project_breakdown?.[project.namespace] || {};
            return {
              namespace: project.namespace,
              name: project.project_name,
              id: project.project_id,
              is_owner: true, // User owns projects mapped to them
              hourly_cost: projectCost.hourly_cost || 0,
              cpu_cost: projectCost.cpu_cost || 0,
              memory_cost: projectCost.memory_cost || 0,
              pv_cost: projectCost.pv_cost || 0
            };
          });
          
          // Count active namespaces
          user.active_namespaces = projects.map(p => p.namespace);
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