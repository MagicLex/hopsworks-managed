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

  const { userId, date } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // If specific date requested, get that day's usage
    if (date && typeof date === 'string') {
      const { data: dailyUsage, error } = await supabase
        .from('usage_daily')
        .select(`
          *,
          hopsworks_clusters (
            name,
            api_url
          )
        `)
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Error fetching daily usage:', error);
        return res.status(500).json({ error: 'Failed to fetch usage data' });
      }

      // Format response to match Hopsworks expected format
      const usage = dailyUsage ? {
        date,
        compute: {
          instances: [{
            type: dailyUsage.instance_type || 'unknown',
            hours: dailyUsage.instance_hours || 0,
            cpuHours: dailyUsage.cpu_hours || 0,
            gpuHours: dailyUsage.gpu_hours || 0
          }]
        },
        storage: {
          featureStore: 0, // We don't track this separately yet
          models: 0,
          datasets: 0,
          total: dailyUsage.storage_gb || 0
        },
        apiCalls: {
          featureStore: dailyUsage.feature_store_api_calls || 0,
          modelServing: dailyUsage.model_inference_calls || 0,
          jobs: 0, // We don't track this separately
          total: dailyUsage.api_calls || 0
        }
      } : null;

      return res.status(200).json({ usage });
    }

    // Otherwise get monthly summary
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyUsage, error } = await supabase
      .from('usage_daily')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching monthly usage:', error);
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }

    // Aggregate monthly data
    const aggregated = monthlyUsage?.reduce((acc, day) => ({
      cpuHours: acc.cpuHours + (day.cpu_hours || 0),
      gpuHours: acc.gpuHours + (day.gpu_hours || 0),
      storageGB: Math.max(acc.storageGB, day.storage_gb || 0),
      apiCalls: acc.apiCalls + (day.api_calls || 0),
      featureStoreCalls: acc.featureStoreCalls + (day.feature_store_api_calls || 0),
      inferenceCalls: acc.inferenceCalls + (day.model_inference_calls || 0),
      totalCost: acc.totalCost + (day.total_cost || 0)
    }), {
      cpuHours: 0,
      gpuHours: 0,
      storageGB: 0,
      apiCalls: 0,
      featureStoreCalls: 0,
      inferenceCalls: 0,
      totalCost: 0
    }) || null;

    return res.status(200).json({
      userId,
      month: startOfMonth.toISOString().substring(0, 7),
      usage: aggregated,
      dailyUsage: monthlyUsage || []
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const adminUsageHandler = function (req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}

export default adminUsageHandler;