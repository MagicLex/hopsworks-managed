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

export async function collectK8sMetrics() {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];

  console.log(`Starting K8s metrics collection for: ${currentDate}`);

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
      const k8sClient = new KubernetesMetricsClient(cluster.kubeconfig);

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
          
          // Calculate usage for 15-minute interval (0.25 hours)
          const intervalHours = 0.25; // 15 minutes = 0.25 hours
          const cpuCores = userMetrics.totals.cpuCores; // Current CPU cores in use
          const memoryGB = userMetrics.totals.memoryGB;
          const storageGB = userMetrics.totals.storageGB;
          
          // Calculate resource hours for this 15-minute interval
          const cpuHours = cpuCores * intervalHours; // cores * 0.25 hours
          const memoryGBHours = memoryGB * intervalHours;

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

          // Calculate costs for this 15-minute interval
          const cpuCost = calculateCpuCost(instanceType, intervalHours); // Cost for 0.25 hours
          const storageCost = calculateStorageCost(storageGB) * intervalHours; // Pro-rated storage cost
          const apiCost = 0; // API calls need separate tracking
          const totalCost = cpuCost + storageCost + apiCost;

          console.log(`User ${username}: 15-min interval - CPU=${cpuCores} cores (+${cpuHours} core-hours), Memory=${memoryGB}GB, Storage=${storageGB}GB, Interval cost=$${totalCost.toFixed(4)}`);

          // Check if we already have a record for today
          const { data: existingRecord } = await supabaseAdmin
            .from('usage_daily')
            .select('*')
            .eq('user_id', assignment.user_id)
            .eq('date', currentDate)
            .single();

          if (existingRecord) {
            // For 15-minute intervals: ADD to existing values
            const { error: updateError } = await supabaseAdmin
              .from('usage_daily')
              .update({
                cpu_hours: existingRecord.cpu_hours + cpuHours, // Accumulate CPU hours
                gpu_hours: existingRecord.gpu_hours + 0,
                storage_gb: storageGB, // Storage is current snapshot
                feature_store_api_calls: existingRecord.feature_store_api_calls + 0,
                model_inference_calls: existingRecord.model_inference_calls + 0,
                hopsworks_cluster_id: cluster.id,
                total_cost: existingRecord.total_cost + totalCost // Accumulate costs
              })
              .eq('id', existingRecord.id);
              
            if (updateError) {
              console.error('Update error:', updateError);
              throw new Error(`Failed to update usage record: ${updateError.message}`);
            }
          } else {
            // Create new record - use actual schema columns
            const insertData = {
              user_id: assignment.user_id,
              date: currentDate,
              cpu_hours: cpuHours,
              gpu_hours: 0,
              storage_gb: storageGB,
              feature_store_api_calls: 0,
              model_inference_calls: 0,
              hopsworks_cluster_id: cluster.id,
              total_cost: totalCost
            };
            
            console.log(`Inserting daily usage for ${username}:`, JSON.stringify(insertData, null, 2));
            
            const { error: insertError } = await supabaseAdmin
              .from('usage_daily')
              .insert(insertData);
              
            if (insertError) {
              console.error('Insert error details:', insertError);
              throw new Error(`Failed to insert usage record: ${insertError.message || JSON.stringify(insertError)}`);
            }
          }

          // Skip prepaid handling for now - focus on getting basic collection working

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

  console.log(`K8s metrics collection completed: ${results.successful} successful, ${results.failed} failed`);

  return {
    message: 'K8s metrics collection completed',
    timestamp: currentDate,
    results
  };
}