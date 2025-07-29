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

    // Get current month usage with detailed instance information
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyUsage, error: usageError } = await supabaseAdmin
      .from('usage_daily')
      .select('cpu_hours, gpu_hours, storage_gb, feature_store_api_calls, model_inference_calls')
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
      storageGB: Math.max(acc.storageGB, day.storage_gb || 0), // Use max for storage
      apiCalls: acc.apiCalls + (day.feature_store_api_calls || 0) + (day.model_inference_calls || 0), // Sum of both API types
      featureStoreApiCalls: acc.featureStoreApiCalls + (day.feature_store_api_calls || 0),
      modelInferenceCalls: acc.modelInferenceCalls + (day.model_inference_calls || 0)
    }), { 
      cpuHours: 0, 
      gpuHours: 0, 
      storageGB: 0,
      apiCalls: 0,
      featureStoreApiCalls: 0,
      modelInferenceCalls: 0
    }) || { 
      cpuHours: 0, 
      gpuHours: 0, 
      storageGB: 0,
      apiCalls: 0,
      featureStoreApiCalls: 0,
      modelInferenceCalls: 0
    };


    // Get user with their cluster assignment
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select(`
        email,
        hopsworks_project_id,
        user_hopsworks_assignments (
          hopsworks_clusters (
            id,
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();
    
    let projectsCount = 0;
    let modelsCount = 0;

    // If user has a cluster assignment, fetch real data from Hopsworks
    if (userData?.user_hopsworks_assignments?.[0]?.hopsworks_clusters) {
      const clusterData = userData.user_hopsworks_assignments[0].hopsworks_clusters;
      // Handle both array and single object response from Supabase
      const cluster = Array.isArray(clusterData) ? clusterData[0] : clusterData;
      
      if (!cluster) {
        projectsCount = userData?.hopsworks_project_id ? 1 : 0;
      } else {
        try {
          const { getHopsworksUserByAuth0Id, getUserProjects } = await import('../../lib/hopsworks-api');
          
          const credentials = {
            apiUrl: cluster.api_url,
            apiKey: cluster.api_key
          };

          // Get Hopsworks user
          const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, userData.email);
          
          if (hopsworksUser) {
            // Get actual projects count
            projectsCount = hopsworksUser.numActiveProjects || 0;
            
            // TODO: Get actual model deployments count from Hopsworks
            // For now, we'll use the projects count as a placeholder
            modelsCount = 0;
          }
        } catch (error) {
          console.error('Error fetching Hopsworks data:', error);
          // Fall back to database values
          projectsCount = userData?.hopsworks_project_id ? 1 : 0;
        }
      }
    } else {
      // No cluster assigned, use database values
      projectsCount = userData?.hopsworks_project_id ? 1 : 0;
    }

    return res.status(200).json({
      cpuHours: totalUsage.cpuHours,
      gpuHours: totalUsage.gpuHours,
      storageGB: totalUsage.storageGB,
      featureGroups: projectsCount || 0,
      modelDeployments: modelsCount || 0,
      apiCalls: totalUsage.apiCalls,
      featureStoreApiCalls: totalUsage.featureStoreApiCalls,
      modelInferenceCalls: totalUsage.modelInferenceCalls,
      currentMonth: startOfMonth.toISOString().substring(0, 7) // YYYY-MM format
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return res.status(500).json({ error: 'Failed to fetch usage data' });
  }
}