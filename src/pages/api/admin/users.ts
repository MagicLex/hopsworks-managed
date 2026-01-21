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
        
        // Get all user projects (active and inactive - admin sees everything)
        const { data: userProjects, error: projectsError } = await supabase
          .from('user_projects')
          .select('user_id, namespace, project_name, project_id, status');

        if (projectsError) {
          console.error('Error fetching user_projects:', projectsError);
        }
        console.log(`[Admin API] Found ${userProjects?.length || 0} projects (all statuses)`);
        
        // Get today's usage with project breakdown
        const { data: todayUsage } = await supabase
          .from('usage_daily')
          .select('user_id, total_cost, project_breakdown')
          .eq('date', today);
        
        // Get yesterday's usage for 24h comparison
        const { data: yesterdayUsage } = await supabase
          .from('usage_daily')
          .select('user_id, total_cost')
          .eq('date', yesterday.toISOString().split('T')[0]);
        
        // Build user data
        let usersWithProjects = 0;
        users.forEach(user => {
          // Get user's projects
          const projects = userProjects?.filter(p => p.user_id === user.id) || [];
          if (projects.length > 0) {
            usersWithProjects++;
            console.log(`[Admin API] User ${user.email} has ${projects.length} projects`);
          }
          const todayData = todayUsage?.find(u => u.user_id === user.id);
          const yesterdayData = yesterdayUsage?.find(u => u.user_id === user.id);
          
          // Calculate 24h cost
          user.last_24h_cost = (todayData?.total_cost || 0) + (yesterdayData?.total_cost || 0);
          
          // Build project details with usage from OpenCost
          user.projects = projects.map(project => {
            const projectData = todayData?.project_breakdown?.[project.namespace] || {};
            // Calculate cost from usage
            const cpuCost = (projectData.cpuHours || 0) * 0.125;
            const gpuCost = (projectData.gpuHours || 0) * 2.50;
            const ramCost = (projectData.ramGBHours || 0) * 0.0125;
            const totalCost = cpuCost + gpuCost + ramCost;
            
            return {
              namespace: project.namespace,
              name: project.project_name,
              id: project.project_id,
              status: project.status,
              is_owner: true,
              total_cost: totalCost,
              cpu_hours: projectData.cpuHours || 0,
              gpu_hours: projectData.gpuHours || 0,
              ram_gb_hours: projectData.ramGBHours || 0
            };
          });
          
          // Count active namespaces
          user.active_namespaces = projects.map(p => p.namespace);
        });
        console.log(`[Admin API] ${usersWithProjects}/${users.length} users have projects`);
      }

      if (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      // Prevent browser caching to ensure fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
  } else if (req.method === 'PATCH') {
    // Handle user field updates (e.g., spending cap)
    const { userId, spendingCap } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    try {
      const updateData: any = {};

      // Handle spending cap update
      if (spendingCap !== undefined) {
        updateData.spending_cap = spendingCap === null || spendingCap === '' ? null : parseFloat(spendingCap);
        // Reset alerts when admin changes cap
        updateData.spending_alerts_sent = null;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Failed to update user' });
      }

      return res.status(200).json({ success: true, message: 'User updated' });
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