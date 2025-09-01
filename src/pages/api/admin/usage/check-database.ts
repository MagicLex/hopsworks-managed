import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's usage data
    const { data: todayUsage } = await supabaseAdmin
      .from('usage_daily')
      .select(`
        user_id,
        opencost_cpu_hours,
        opencost_gpu_hours,
        opencost_ram_gb_hours,
        total_cost,
        project_breakdown,
        updated_at
      `)
      .eq('date', today)
      .order('total_cost', { ascending: false });

    // Get last collection time
    const { data: lastCollection } = await supabaseAdmin
      .from('usage_daily')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Summarize project data
    const allProjects = new Map();
    todayUsage?.forEach(usage => {
      if (usage.project_breakdown) {
        Object.entries(usage.project_breakdown).forEach(([namespace, data]: [string, any]) => {
          if (!allProjects.has(namespace)) {
            allProjects.set(namespace, {
              namespace,
              userCount: 0,
              totalCpuHours: 0,
              totalGpuHours: 0,
              totalRamGBHours: 0,
              users: []
            });
          }
          const project = allProjects.get(namespace);
          project.userCount++;
          project.totalCpuHours += data.cpuHours || 0;
          project.totalGpuHours += data.gpuHours || 0;
          project.totalRamGBHours += data.ramGBHours || 0;
          if (usage.user_id && !project.users.includes(usage.user_id)) {
            project.users.push(usage.user_id);
          }
        });
      }
    });

    return res.status(200).json({
      date: today,
      lastCollectionTime: lastCollection?.updated_at,
      totalUsers: todayUsage?.length || 0,
      totalCost: todayUsage?.reduce((sum, u) => sum + (u.total_cost || 0), 0) || 0,
      userSummary: todayUsage?.map(u => ({
        userId: u.user_id,
        cpuHours: u.opencost_cpu_hours || 0,
        gpuHours: u.opencost_gpu_hours || 0,
        ramGBHours: u.opencost_ram_gb_hours || 0,
        totalCost: u.total_cost || 0,
        projectCount: Object.keys(u.project_breakdown || {}).length,
        lastUpdate: u.created_at
      })) || [],
      projectSummary: Array.from(allProjects.values())
    });
  } catch (error) {
    console.error('Error checking database:', error);
    return res.status(500).json({ 
      error: 'Failed to check database',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export default function checkDatabaseHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}