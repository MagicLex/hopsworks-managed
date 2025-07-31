import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { calculateCpuCost, calculateStorageCost, calculateApiCost } from '../../../lib/pricing';
import { getHopsworksUserByAuth0Id, getUserProjects, getProjectUsage } from '../../../lib/hopsworks-api';

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

// This endpoint collects usage data from Hopsworks clusters
// Should be called daily by a cron job
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify this is called by Vercel Cron
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];

    console.log(`Starting usage collection for date: ${reportDate}`);

    // Get all active clusters
    const { data: clusters, error: clusterError } = await supabaseAdmin
      .from('hopsworks_clusters')
      .select('*')
      .eq('status', 'active');

    if (clusterError) {
      throw new Error(`Failed to fetch clusters: ${clusterError.message}`);
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each cluster
    for (const cluster of clusters || []) {
      try {
        // Get users assigned to this cluster
        const { data: assignments } = await supabaseAdmin
          .from('user_hopsworks_assignments')
          .select('user_id')
          .eq('hopsworks_cluster_id', cluster.id);

        if (!assignments || assignments.length === 0) {
          continue;
        }

        // For each user on this cluster
        for (const assignment of assignments) {
          try {
            // Note: Hopsworks API metrics endpoints not available - using Kubernetes metrics instead
            // This is a placeholder - replace with actual API call
            const usage = await fetchUserUsageFromHopsworks(
              cluster.api_url,
              cluster.api_key,
              assignment.user_id,
              reportDate
            );

            // Calculate costs
            const cpuCost = calculateCpuCost(usage.instanceType, usage.instanceHours);
            const storageCost = calculateStorageCost(usage.storageGb);
            const apiCost = calculateApiCost('general', usage.apiCalls);
            const totalCost = cpuCost + storageCost + apiCost;

            // Get user billing mode and pricing overrides
            const { data: user } = await supabaseAdmin
              .from('users')
              .select('billing_mode, feature_flags')
              .eq('id', assignment.user_id)
              .single();

            // Check for custom pricing
            const { data: pricingOverrides } = await supabaseAdmin
              .from('user_pricing_overrides')
              .select('*')
              .eq('user_id', assignment.user_id)
              .or(`valid_until.is.null,valid_until.gte.${reportDate}`);

            // Apply pricing overrides if any
            let adjustedCost = totalCost;
            if (pricingOverrides && pricingOverrides.length > 0) {
              adjustedCost = applyPricingOverrides(
                usage,
                pricingOverrides,
                cpuCost,
                storageCost,
                apiCost
              );
            }

            // Get user's account owner (if they're a team member)
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('account_owner_id')
              .eq('id', assignment.user_id)
              .single();

            const accountOwnerId = userData?.account_owner_id || assignment.user_id;

            // Store usage record
            const { data: usageRecord, error: usageError } = await supabaseAdmin
              .from('usage_daily')
              .insert({
                user_id: assignment.user_id,
                account_owner_id: accountOwnerId,
                date: reportDate,
                hopsworks_cluster_id: cluster.id,
                cpu_hours: usage.cpuHours,
                gpu_hours: usage.gpuHours || 0,
                storage_gb: usage.storageGb,
                api_calls: usage.apiCalls,
                feature_store_api_calls: usage.featureStoreApiCalls || 0,
                model_inference_calls: usage.modelInferenceCalls || 0,
                instance_type: usage.instanceType,
                instance_hours: usage.instanceHours,
                total_cost: adjustedCost,
                reported_to_stripe: false
              })
              .select()
              .single();

            if (usageError) {
              throw usageError;
            }

            // Handle based on billing mode
            if (user?.billing_mode === 'prepaid' && user?.feature_flags?.prepaid_enabled) {
              // Deduct credits for prepaid users
              const deducted = await supabaseAdmin.rpc('deduct_user_credits', {
                p_user_id: assignment.user_id,
                p_amount: adjustedCost,
                p_description: `Daily usage for ${reportDate}`,
                p_usage_daily_id: usageRecord.id
              });

              if (deducted) {
                await supabaseAdmin
                  .from('usage_daily')
                  .update({ 
                    credits_deducted: adjustedCost,
                    reported_to_stripe: true // Mark as handled
                  })
                  .eq('id', usageRecord.id);
              }
            }
            // Postpaid users will be synced to Stripe in a separate process

            results.successful++;
          } catch (error) {
            console.error(`Failed to collect usage for user ${assignment.user_id}:`, error);
            results.failed++;
            results.errors.push(`User ${assignment.user_id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        console.error(`Failed to process cluster ${cluster.name}:`, error);
        results.failed++;
        results.errors.push(`Cluster ${cluster.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`Usage collection completed: ${results.successful} successful, ${results.failed} failed`);

    return res.status(200).json({
      message: 'Usage collection completed',
      date: reportDate,
      results
    });
  } catch (error) {
    console.error('Error collecting usage:', error);
    return res.status(500).json({ 
      error: 'Failed to collect usage data',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
}

// Fetch actual usage from Hopsworks
async function fetchUserUsageFromHopsworks(
  apiUrl: string,
  apiKey: string,
  userId: string,
  date: string
): Promise<{
  cpuHours: number;
  gpuHours: number;
  storageGb: number;
  apiCalls: number;
  featureStoreApiCalls: number;
  modelInferenceCalls: number;
  instanceType: string;
  instanceHours: number;
}> {
  const credentials = { apiUrl, apiKey };
  
  try {
    // Get Hopsworks user by Auth0 ID
    const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId);
    if (!hopsworksUser) {
      console.log(`No Hopsworks user found for Auth0 ID: ${userId}`);
      return {
        cpuHours: 0,
        gpuHours: 0,
        storageGb: 0,
        apiCalls: 0,
        featureStoreApiCalls: 0,
        modelInferenceCalls: 0,
        instanceType: 'unknown',
        instanceHours: 0
      };
    }

    // Get user's projects
    const projects = await getUserProjects(credentials, hopsworksUser.username);
    if (projects.length === 0) {
      console.log(`No projects found for user: ${hopsworksUser.username}`);
      return {
        cpuHours: 0,
        gpuHours: 0,
        storageGb: 0,
        apiCalls: 0,
        featureStoreApiCalls: 0,
        modelInferenceCalls: 0,
        instanceType: 'unknown',
        instanceHours: 0
      };
    }

    // Aggregate usage across all projects
    let totalCpuHours = 0;
    let totalGpuHours = 0;
    let totalStorageGb = 0;
    let totalApiCalls = 0;
    let totalFeatureStoreCalls = 0;
    let totalInferenceCalls = 0;
    let primaryInstanceType = 'unknown';
    let totalInstanceHours = 0;

    for (const project of projects) {
      const usage = await getProjectUsage(credentials, project.id, date);
      
      // Aggregate compute usage
      for (const instance of usage.compute.instances) {
        totalCpuHours += instance.cpuHours || 0;
        totalGpuHours += instance.gpuHours || 0;
        totalInstanceHours += instance.hours || 0;
        if (instance.hours > 0) {
          primaryInstanceType = instance.type;
        }
      }

      // Use max storage across projects
      totalStorageGb = Math.max(totalStorageGb, usage.storage.total || 0);

      // Aggregate API calls
      totalApiCalls += usage.apiCalls.total || 0;
      totalFeatureStoreCalls += usage.apiCalls.featureStore || 0;
      totalInferenceCalls += usage.apiCalls.modelServing || 0;
    }

    return {
      cpuHours: totalCpuHours,
      gpuHours: totalGpuHours,
      storageGb: totalStorageGb,
      apiCalls: totalApiCalls,
      featureStoreApiCalls: totalFeatureStoreCalls,
      modelInferenceCalls: totalInferenceCalls,
      instanceType: primaryInstanceType,
      instanceHours: totalInstanceHours
    };
  } catch (error) {
    console.error(`Failed to fetch usage for user ${userId}:`, error);
    // Return zeros on error to avoid blocking other users
    return {
      cpuHours: 0,
      gpuHours: 0,
      storageGb: 0,
      apiCalls: 0,
      featureStoreApiCalls: 0,
      modelInferenceCalls: 0,
      instanceType: 'unknown',
      instanceHours: 0
    };
  }
}

function applyPricingOverrides(
  usage: any,
  overrides: any[],
  cpuCost: number,
  storageCost: number,
  apiCost: number
): number {
  let adjustedCpuCost = cpuCost;
  let adjustedStorageCost = storageCost;
  let adjustedApiCost = apiCost;

  for (const override of overrides) {
    switch (override.resource_type) {
      case 'cpu_hours':
        adjustedCpuCost = usage.cpuHours * override.override_price;
        break;
      case 'storage_gb':
        adjustedStorageCost = usage.storageGb * override.override_price;
        break;
      case 'api_calls':
        adjustedApiCost = (usage.apiCalls / 1000) * override.override_price;
        break;
    }
  }

  return adjustedCpuCost + adjustedStorageCost + adjustedApiCost;
}