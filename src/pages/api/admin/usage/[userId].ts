import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_API_BASE, HOPSWORKS_API_BASE } from '../../../../lib/hopsworks-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Get user details with cluster assignment
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        user_hopsworks_assignments!inner (
          hopsworks_cluster_id,
          hopsworks_clusters (
            id,
            name,
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cluster = user.user_hopsworks_assignments?.[0]?.hopsworks_clusters;
    if (!cluster) {
      return res.status(400).json({ error: 'User has no cluster assignment' });
    }

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    // Import Hopsworks API functions
    const { getUserProjects } = await import('../../../../lib/hopsworks-api');

    const metrics: any = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        cluster: cluster.name
      },
      consumption: {
        compute: {
          cpuHours: 0,
          gpuHours: 0,
          instances: []
        },
        storage: {
          featureStore: 0,
          models: 0,
          datasets: 0,
          total: 0
        },
        apiCalls: {
          featureStore: 0,
          modelServing: 0,
          jobs: 0,
          total: 0
        }
      },
      projects: [],
      timestamp: new Date().toISOString()
    };

    // Check if we have a stored Hopsworks username
    const storedUsername = user.hopsworks_username || user.user_hopsworks_assignments?.[0]?.hopsworks_username;
    
    if (storedUsername) {
      metrics.hopsworksUser = {
        username: storedUsername
      };
    }

    // Get historical usage from our database
    const { data: historicalUsage } = await supabase
        .from('usage_daily')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      if (historicalUsage) {
        metrics.historicalUsage = historicalUsage;
        
        // Calculate totals from historical data
        metrics.historicalTotals = historicalUsage.reduce((acc, day) => ({
          cpu_hours: acc.cpu_hours + (day.cpu_hours || 0),
          gpu_hours: acc.gpu_hours + (day.gpu_hours || 0),
          storage_gb_months: acc.storage_gb_months + (day.storage_gb_months || 0),
          api_calls: acc.api_calls + (day.api_calls || 0),
          total_cost: acc.total_cost + (day.total_cost || 0)
        }), {
          cpu_hours: 0,
          gpu_hours: 0,
          storage_gb_months: 0,
          api_calls: 0,
          total_cost: 0
        });
      }

    return res.status(200).json(metrics);
  } catch (error) {
    console.error('Error in user usage handler:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function userUsageHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}