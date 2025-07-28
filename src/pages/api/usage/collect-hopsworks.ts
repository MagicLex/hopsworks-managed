import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { instanceHourlyRates, getInstanceType } from '../../../lib/pricing';

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

// This endpoint collects usage data from Hopsworks
// In production, this would use the Hopsworks Python SDK or REST API
// For now, we'll simulate the data collection
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Get user's Hopsworks project ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('hopsworks_project_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.hopsworks_project_id) {
      return res.status(400).json({ error: 'No Hopsworks project associated with user' });
    }

    // In production, this would:
    // 1. Connect to Hopsworks using their Python SDK
    // 2. Fetch job execution history for the project
    // 3. Calculate CPU hours based on job duration and instance types
    // 4. Count API calls to feature store
    // 5. Get current storage usage
    
    // For now, we'll simulate some usage data
    const simulatedUsage = {
      jobs: [
        {
          jobId: 'job-1',
          instanceType: 'm5.xlarge',
          durationHours: 2.5,
          jobType: 'spark'
        },
        {
          jobId: 'job-2',
          instanceType: 'm5.2xlarge',
          durationHours: 1.0,
          jobType: 'python'
        }
      ],
      featureStoreApiCalls: 1500,
      modelInferenceCalls: 200,
      storageGb: 45.5
    };

    // Calculate total CPU hours
    const totalCpuHours = simulatedUsage.jobs.reduce((total, job) => {
      return total + job.durationHours;
    }, 0);

    // Calculate instance hours by type
    const instanceHours: Record<string, number> = {};
    simulatedUsage.jobs.forEach(job => {
      if (!instanceHours[job.instanceType]) {
        instanceHours[job.instanceType] = 0;
      }
      instanceHours[job.instanceType] += job.durationHours;
    });

    // Check if usage for this date already exists
    const { data: existingUsage } = await supabaseAdmin
      .from('usage_daily')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const usageData = {
      user_id: userId,
      date,
      cpu_hours: totalCpuHours,
      storage_gb: simulatedUsage.storageGb,
      feature_store_api_calls: simulatedUsage.featureStoreApiCalls,
      model_inference_calls: simulatedUsage.modelInferenceCalls,
      project_id: userData.hopsworks_project_id,
      api_calls: simulatedUsage.featureStoreApiCalls + simulatedUsage.modelInferenceCalls,
      // Store the primary instance type used
      instance_type: Object.keys(instanceHours).reduce((a, b) => 
        instanceHours[a] > instanceHours[b] ? a : b
      ),
      instance_hours: totalCpuHours
    };

    if (existingUsage) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('usage_daily')
        .update(usageData)
        .eq('id', existingUsage.id);

      if (updateError) throw updateError;
    } else {
      // Insert new record
      const { error: insertError } = await supabaseAdmin
        .from('usage_daily')
        .insert(usageData);

      if (insertError) throw insertError;
    }

    // Store detailed usage by instance type (for future reporting)
    for (const [instanceType, hours] of Object.entries(instanceHours)) {
      const { error: reportError } = await supabaseAdmin
        .from('stripe_usage_reports')
        .upsert({
          user_id: userId,
          date,
          usage_type: `cpu_hours_${instanceType}`,
          quantity: hours,
          unit_price: instanceHourlyRates[instanceType] || instanceHourlyRates['unknown'],
          total_amount: hours * (instanceHourlyRates[instanceType] || instanceHourlyRates['unknown']),
          status: 'pending',
          metadata: {
            instance_type: instanceType,
            project_id: userData.hopsworks_project_id
          }
        }, {
          onConflict: 'user_id,date,usage_type'
        });

      if (reportError) {
        console.error('Error storing usage report:', reportError);
      }
    }

    return res.status(200).json({
      message: 'Usage data collected successfully',
      date,
      totalCpuHours,
      instanceTypes: Object.keys(instanceHours),
      apiCalls: simulatedUsage.featureStoreApiCalls + simulatedUsage.modelInferenceCalls
    });
  } catch (error) {
    console.error('Error collecting Hopsworks usage:', error);
    return res.status(500).json({ error: 'Failed to collect usage data' });
  }
}