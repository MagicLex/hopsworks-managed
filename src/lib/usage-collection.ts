import { createClient } from '@supabase/supabase-js';
import { calculateCpuCost, calculateStorageCost } from './pricing';
import { KubernetesMetricsClient } from './kubernetes-metrics';

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

export async function collectK8sMetrics(forceAggregation = false) {
  const now = new Date();
  const currentHour = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const currentDate = now.toISOString().split('T')[0];

  console.log(`Starting K8s metrics collection for: ${currentHour}`);

  // Get all active clusters with kubeconfig
  const { data: clusters, error: clusterError } = await supabaseAdmin
    .from('hopsworks_clusters')
    .select('*')
    .eq('status', 'active')
    .not('kubeconfig', 'is', null);

  if (clusterError) {
    throw new Error(`Failed to fetch clusters: ${clusterError.message}`);
  }

  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
    metrics: [] as any[]
  };

  // Process each cluster
  for (const cluster of clusters || []) {
    try {
      // Initialize K8s client
      const k8sClient = new KubernetesMetricsClient(cluster.kubeconfig, false);

      // Get all users assigned to this cluster
      const { data: assignments } = await supabaseAdmin
        .from('user_hopsworks_assignments')
        .select('user_id, users!inner(email, hopsworks_username)')
        .eq('hopsworks_cluster_id', cluster.id);

      if (!assignments || assignments.length === 0) {
        continue;
      }

      // Collect metrics for each user
      for (const assignment of assignments) {
        try {
          const userInfo = (assignment as any).users;
          const username = userInfo?.hopsworks_username;
          if (!username) {
            console.log(`No Hopsworks username for user ${assignment.user_id}`);
            continue;
          }

          // Get user metrics from Kubernetes
          const userMetrics = await k8sClient.getUserMetrics(username);
          
          // Calculate hourly usage (assuming metrics are current snapshots)
          const cpuHours = userMetrics.totals.cpuCores; // Already in cores
          const memoryGB = userMetrics.totals.memoryGB;
          const storageGB = userMetrics.totals.storageGB;

          // Determine primary instance type from pod names
          let instanceType = 'unknown';
          let instanceCount = 0;
          
          for (const project of userMetrics.projects) {
            for (const pod of project.pods) {
              instanceCount++;
              if (pod.type === 'notebook') {
                instanceType = 'jupyter.small'; // Map to pricing table
              } else if (pod.type === 'job') {
                instanceType = 'compute.medium';
              }
            }
          }

          // Calculate costs
          const cpuCost = calculateCpuCost(instanceType, 1); // 1 hour
          const storageCost = calculateStorageCost(storageGB);
          const apiCost = 0; // API calls need separate tracking
          const totalCost = cpuCost + storageCost + apiCost;

          console.log(`User ${username}: CPU=${cpuHours} cores, Memory=${memoryGB}GB, Storage=${storageGB}GB, Cost=$${totalCost}`);

          // Check if we already have a record for this hour
          const { data: existingRecord } = await supabaseAdmin
            .from('usage_hourly')
            .select('*')
            .eq('user_id', assignment.user_id)
            .eq('hour', currentHour)
            .single();

          if (existingRecord) {
            // Update existing record (accumulate)
            const { error: updateError } = await supabaseAdmin
              .from('usage_hourly')
              .update({
                cpu_hours: existingRecord.cpu_hours + cpuHours,
                memory_gb_hours: existingRecord.memory_gb_hours + memoryGB,
                storage_gb: Math.max(existingRecord.storage_gb, storageGB), // Use max for storage
                instance_count: instanceCount,
                total_cost: existingRecord.total_cost + totalCost,
                updated_at: now
              })
              .eq('id', existingRecord.id);
              
            if (updateError) {
              throw new Error(`Failed to update usage record: ${updateError.message}`);
            }
          } else {
            // Create new record
            const { error: insertError } = await supabaseAdmin
              .from('usage_hourly')
              .insert({
                user_id: assignment.user_id,
                hour: currentHour,
                date: currentDate,
                hopsworks_cluster_id: cluster.id,
                cpu_hours: cpuHours,
                memory_gb_hours: memoryGB,
                storage_gb: storageGB,
                instance_type: instanceType,
                instance_count: instanceCount,
                total_cost: totalCost,
                projects: userMetrics.projects.map(p => ({
                  id: p.projectId,
                  name: p.projectName,
                  cpu: p.resources.cpuCores,
                  memory: p.resources.memoryGB,
                  pods: p.pods.length
                }))
              });
              
            if (insertError) {
              throw new Error(`Failed to insert usage record: ${insertError.message}`);
            }
          }

          results.successful++;
          results.metrics.push({
            user: assignment.user_id,
            username: username,
            metrics: userMetrics.totals,
            projects: userMetrics.projects.length
          });

        } catch (error) {
          console.error(`Failed to collect metrics for user ${assignment.user_id}:`, error);
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

  // Aggregate hourly data to daily if it's midnight OR if forced
  if (now.getHours() === 0 || forceAggregation) {
    // Aggregate today's data so far
    await aggregateHourlyToDaily(new Date(currentDate).toISOString().split('T')[0], true);
  }

  console.log(`K8s metrics collection completed: ${results.successful} successful, ${results.failed} failed`);

  return {
    message: 'K8s metrics collection completed',
    timestamp: currentHour,
    results
  };
}

// Aggregate hourly metrics to daily
async function aggregateHourlyToDaily(date: string, aggregateToday = false) {
  try {
    // Get all hourly records for the target day
    const targetDate = aggregateToday ? date : (() => {
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    })();

    const { data: hourlyRecords } = await supabaseAdmin
      .from('usage_hourly')
      .select('*')
      .eq('date', targetDate);

    if (!hourlyRecords || hourlyRecords.length === 0) {
      return;
    }

    // Group by user
    const userTotals = new Map();
    
    for (const record of hourlyRecords) {
      if (!userTotals.has(record.user_id)) {
        userTotals.set(record.user_id, {
          cpu_hours: 0,
          gpu_hours: 0,
          memory_gb_hours: 0,
          storage_gb: 0,
          total_cost: 0,
          instance_types: new Set(),
          projects: new Set(),
          cluster_id: record.hopsworks_cluster_id
        });
      }

      const totals = userTotals.get(record.user_id);
      totals.cpu_hours += record.cpu_hours;
      totals.gpu_hours += record.gpu_hours || 0;
      totals.memory_gb_hours += record.memory_gb_hours;
      totals.storage_gb = Math.max(totals.storage_gb, record.storage_gb);
      totals.total_cost += record.total_cost;
      totals.instance_types.add(record.instance_type);
      
      if (record.projects) {
        record.projects.forEach((p: any) => totals.projects.add(p.name));
      }
    }

    // Store daily aggregates
    const userEntries = Array.from(userTotals.entries());
    for (const [userId, totals] of userEntries) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('billing_mode, feature_flags')
        .eq('id', userId)
        .single();

      const { data: usageRecord, error } = await supabaseAdmin
        .from('usage_daily')
        .upsert({
          user_id: userId,
          date: targetDate,
          hopsworks_cluster_id: totals.cluster_id,
          cpu_hours: totals.cpu_hours,
          gpu_hours: totals.gpu_hours,
          storage_gb: totals.storage_gb,
          memory_gb_hours: totals.memory_gb_hours,
          instance_type: Array.from(totals.instance_types).join(','),
          instance_hours: totals.cpu_hours, // Approximate
          total_cost: totals.total_cost,
          project_count: totals.projects.size,
          reported_to_stripe: false
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create daily usage for user ${userId}:`, error);
        continue;
      }

      // Handle prepaid users
      if (user?.billing_mode === 'prepaid' && user?.feature_flags?.prepaid_enabled) {
        await supabaseAdmin.rpc('deduct_user_credits', {
          p_user_id: userId,
          p_amount: totals.total_cost,
          p_description: `Daily usage for ${targetDate}`,
          p_usage_daily_id: usageRecord.id
        });

        await supabaseAdmin
          .from('usage_daily')
          .update({ 
            credits_deducted: totals.total_cost,
            reported_to_stripe: true
          })
          .eq('id', usageRecord.id);
      }
    }

    // Clean up old hourly records (keep 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    await supabaseAdmin
      .from('usage_hourly')
      .delete()
      .lt('date', cutoffDate.toISOString().split('T')[0]);

  } catch (error) {
    console.error('Failed to aggregate hourly to daily:', error);
  }
}