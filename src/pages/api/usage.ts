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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    const currentDate = new Date().toISOString().split('T')[0];

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyUsage, error: usageError } = await supabaseAdmin
      .from('usage_daily')
      .select('cpu_hours, gpu_hours, storage_gb')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', currentDate);

    if (usageError) {
      console.error('Usage error:', usageError);
    }

    // Sum up the usage
    const totalUsage = monthlyUsage?.reduce((acc, day) => ({
      cpuHours: acc.cpuHours + (day.cpu_hours || 0),
      gpuHours: acc.gpuHours + (day.gpu_hours || 0),
      storageGB: Math.max(acc.storageGB, day.storage_gb || 0) // Use max for storage
    }), { cpuHours: 0, gpuHours: 0, storageGB: 0 }) || { cpuHours: 0, gpuHours: 0, storageGB: 0 };

    // Get feature groups count
    const { count: featureGroupsCount } = await supabaseAdmin
      .from('feature_groups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    // Get model deployments count
    const { count: modelsCount } = await supabaseAdmin
      .from('model_deployments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    return res.status(200).json({
      cpuHours: totalUsage.cpuHours,
      gpuHours: totalUsage.gpuHours,
      storageGB: totalUsage.storageGB,
      featureGroups: featureGroupsCount || 0,
      modelDeployments: modelsCount || 0
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return res.status(500).json({ error: 'Failed to fetch usage data' });
  }
}