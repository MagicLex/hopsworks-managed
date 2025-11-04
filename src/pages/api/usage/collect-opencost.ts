import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { OpenCostDirect } from '../../../lib/opencost-direct';
import { getHopsworksUserByUsername, getUserProjects, getAllProjects } from '../../../lib/hopsworks-api';
import { calculateCreditsUsed, calculateDollarAmount } from '../../../config/billing-rates';

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
  // Verify this is called by Vercel Cron with proper authentication
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  // Always check CRON_SECRET if it's configured
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    console.error('OpenCost collection unauthorized attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await collectOpenCostMetrics();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error collecting OpenCost metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
}

async function collectOpenCostMetrics() {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  console.log(`Starting OpenCost collection for: ${currentDate} hour ${currentHour}`);

  // Get ALL active Hopsworks clusters
  const { data: clusters, error: clusterError } = await supabaseAdmin
    .from('hopsworks_clusters')
    .select('*')
    .eq('status', 'active');

  if (clusterError || !clusters || clusters.length === 0) {
    throw new Error(`Failed to fetch active clusters: ${clusterError?.message || 'No active clusters'}`);
  }

  console.log(`Found ${clusters.length} active cluster(s) to process`);

  const aggregatedResults = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
    namespaces: [] as any[],
    clusters: [] as any[]
  };

  // Process each cluster
  for (const cluster of clusters) {
    console.log(`\n=== Processing cluster: ${cluster.name} (${cluster.id}) ===`);

    let opencost: OpenCostDirect | null = null;

    try {
      // Initialize OpenCost direct client for this cluster
      opencost = new OpenCostDirect(cluster.kubeconfig);

      // Get hourly allocations from OpenCost using kubectl exec
      const allocations = await opencost.getOpenCostAllocations('1h');

      // Get storage metrics in batch (once for all projects)
      console.log(`[${cluster.name}] Collecting storage metrics...`);
      const offlineStorage = await opencost.getOfflineStorageBatch();
      const onlineStorage = await opencost.getOnlineStorageBatch(cluster.mysql_password || '');
      console.log(`[${cluster.name}] Storage collected: ${offlineStorage.size} offline, ${onlineStorage.size} online`);

      console.log(`[${cluster.name}] Found ${allocations.size} namespaces with costs`);

      const clusterResults = {
        clusterId: cluster.id,
        clusterName: cluster.name,
        successful: 0,
        failed: 0,
        errors: [] as string[],
        namespaces: [] as any[]
      };

  // Process each namespace with costs
  for (const [namespace, allocation] of Array.from(allocations.entries())) {
    try {
      // Skip Hopsworks system namespace
      if (namespace === 'hopsworks') {
        continue;
      }

      console.log(`Processing namespace: ${namespace}, cost: $${allocation.totalCost.toFixed(4)}`);

      // Look up project owner in our database first
      const { data: project } = await supabaseAdmin
        .from('user_projects')
        .select('user_id, project_name, project_id')
        .eq('namespace', namespace)
        .eq('status', 'active')
        .single();

      let userId: string | null = null;
      let projectName = namespace;
      let projectId: number | null = null;

      if (project) {
        // Found in our cache - verify user is on this cluster
        const { data: userAssignment } = await supabaseAdmin
          .from('user_hopsworks_assignments')
          .select('hopsworks_cluster_id')
          .eq('user_id', project.user_id)
          .single();

        if (userAssignment?.hopsworks_cluster_id === cluster.id) {
          userId = project.user_id;
          projectName = project.project_name;
          projectId = project.project_id;

          // Update last seen
          await supabaseAdmin
            .from('user_projects')
            .update({ last_seen_at: now.toISOString() })
            .eq('namespace', namespace);
        } else {
          console.warn(`[${cluster.name}] Namespace ${namespace} mapped to user on different cluster, will re-resolve`);
        }
      } else {
        // Query Hopsworks API to find owner
        console.log(`Namespace ${namespace} not in cache, querying Hopsworks...`);
        
        // Try to get project info from Hopsworks
        // Note: This assumes namespace name matches project name
        const hopsworksProjects = await getAllProjects(
          { apiUrl: cluster.api_url, apiKey: cluster.api_key },
          `ApiKey ${cluster.api_key}`
        );

        // Try exact match first, then with underscore/hyphen conversion
        const hopsworksProject = hopsworksProjects.find(p => 
          p.name.toLowerCase() === namespace.toLowerCase() ||
          p.name.toLowerCase().replace(/_/g, '-') === namespace.toLowerCase() ||
          p.name.toLowerCase().replace(/-/g, '_') === namespace.toLowerCase()
        );

        if (hopsworksProject) {
          // Find user by Hopsworks username AND verify they're on this cluster
          const { data: user } = await supabaseAdmin
            .from('users')
            .select(`
              id,
              user_hopsworks_assignments!inner (
                hopsworks_cluster_id
              )
            `)
            .eq('hopsworks_username', hopsworksProject.owner)
            .eq('user_hopsworks_assignments.hopsworks_cluster_id', cluster.id)
            .single();

          if (user) {
            userId = user.id;
            projectName = hopsworksProject.name;
            projectId = hopsworksProject.id;

            // Cache the mapping
            await supabaseAdmin
              .from('user_projects')
              .upsert({
                user_id: userId,
                project_id: projectId,
                project_name: projectName,
                namespace: namespace,
                status: 'active',
                last_seen_at: now.toISOString()
              }, {
                onConflict: 'namespace'
              });
          } else {
            console.warn(`[${cluster.name}] Found project ${hopsworksProject.name} but owner ${hopsworksProject.owner} not on this cluster`);
          }
        }
      }

      if (!userId) {
        // Try to identify what type of namespace this is
        let namespaceType = 'user project';
        if (namespace.includes('admin') || namespace === 'hopsworks') {
          namespaceType = 'admin/system';
        }
        
        console.warn(`[${cluster.name}] No user found for namespace ${namespace} (type: ${namespaceType})`);
        clusterResults.errors.push(`Namespace ${namespace}: No user mapping found`);
        clusterResults.failed++;
        continue;
      }

      // Get or create today's usage record
      const { data: existingUsage } = await supabaseAdmin
        .from('usage_daily')
        .select('*')
        .eq('user_id', userId)
        .eq('date', currentDate)
        .single();

      // Extract compute usage metrics
      const cpuHours = allocation.cpuCoreHours || 0;
      const ramGBHours = (allocation.ramByteHours || 0) / (1024 * 1024 * 1024);
      const gpuHours = allocation.gpuHours || 0;

      // Get storage for this project (convert bytes to GB)
      const offlineStorageBytes = offlineStorage.get(projectName) || 0;
      const onlineStorageBytes = onlineStorage.get(projectName) || 0;
      const offlineStorageGB = offlineStorageBytes / (1024 * 1024 * 1024);
      const onlineStorageGB = onlineStorageBytes / (1024 * 1024 * 1024);

      // Storage rates are per month, so divide by 720 hours (30 days * 24 hours) for hourly cost
      const HOURS_PER_MONTH = 30 * 24;

      // Calculate cost using our rates
      const creditsUsed = calculateCreditsUsed({
        cpuHours,
        gpuHours,
        ramGbHours: ramGBHours,
        onlineStorageGb: onlineStorageGB / HOURS_PER_MONTH, // Pro-rata for this hour
        offlineStorageGb: offlineStorageGB / HOURS_PER_MONTH
      });
      const hourlyTotalCost = calculateDollarAmount(creditsUsed);

      if (existingUsage) {
        // Update existing record - ADD the hourly usage
        const updatedProjectBreakdown = existingUsage.project_breakdown || {};
        updatedProjectBreakdown[namespace] = {
          name: projectName,
          cpuHours: cpuHours,
          gpuHours: gpuHours,
          ramGBHours: ramGBHours,
          onlineStorageGB: onlineStorageGB,
          offlineStorageGB: offlineStorageGB,
          cpuEfficiency: allocation.cpuEfficiency,
          ramEfficiency: allocation.ramEfficiency,
          lastUpdated: now.toISOString()
        };

        await supabaseAdmin
          .from('usage_daily')
          .update({
            opencost_cpu_hours: (existingUsage.opencost_cpu_hours || 0) + cpuHours,
            opencost_gpu_hours: (existingUsage.opencost_gpu_hours || 0) + gpuHours,
            opencost_ram_gb_hours: (existingUsage.opencost_ram_gb_hours || 0) + ramGBHours,
            online_storage_gb: onlineStorageGB, // Latest snapshot, not accumulated
            offline_storage_gb: offlineStorageGB,
            total_cost: (existingUsage.total_cost || 0) + hourlyTotalCost,
            project_breakdown: updatedProjectBreakdown
          })
          .eq('id', existingUsage.id);
      } else {
        // Create new record
        const projectBreakdown: any = {};
        projectBreakdown[namespace] = {
          name: projectName,
          cpuHours: cpuHours,
          gpuHours: gpuHours,
          ramGBHours: ramGBHours,
          onlineStorageGB: onlineStorageGB,
          offlineStorageGB: offlineStorageGB,
          cpuEfficiency: allocation.cpuEfficiency,
          ramEfficiency: allocation.ramEfficiency,
          lastUpdated: now.toISOString()
        };

        await supabaseAdmin
          .from('usage_daily')
          .insert({
            user_id: userId,
            date: currentDate,
            opencost_cpu_hours: cpuHours,
            opencost_gpu_hours: gpuHours,
            opencost_ram_gb_hours: ramGBHours,
            online_storage_gb: onlineStorageGB,
            offline_storage_gb: offlineStorageGB,
            total_cost: hourlyTotalCost,
            project_breakdown: projectBreakdown,
            hopsworks_cluster_id: cluster.id
          });
      }

      clusterResults.successful++;
      clusterResults.namespaces.push({
        namespace,
        projectName,
        userId,
        cpuHours,
        gpuHours,
        ramGBHours,
        onlineStorageGB,
        offlineStorageGB
      });

    } catch (error) {
      console.error(`[${cluster.name}] Failed to process namespace ${namespace}:`, error);
      clusterResults.failed++;
      clusterResults.errors.push(`Namespace ${namespace}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

      // Mark projects as inactive if not seen in 30 days (per cluster)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabaseAdmin
        .from('user_projects')
        .update({ status: 'inactive' })
        .lt('last_seen_at', thirtyDaysAgo.toISOString())
        .eq('status', 'active');

      console.log(`[${cluster.name}] Collection completed: ${clusterResults.successful} successful, ${clusterResults.failed} failed`);

      // Aggregate cluster results
      aggregatedResults.successful += clusterResults.successful;
      aggregatedResults.failed += clusterResults.failed;
      aggregatedResults.errors.push(...clusterResults.errors);
      aggregatedResults.namespaces.push(...clusterResults.namespaces);
      aggregatedResults.clusters.push({
        clusterId: cluster.id,
        clusterName: cluster.name,
        successful: clusterResults.successful,
        failed: clusterResults.failed,
        namespaceCount: clusterResults.namespaces.length
      });

    } catch (error) {
      console.error(`[${cluster.name}] Failed to collect metrics for cluster:`, error);
      aggregatedResults.errors.push(`Cluster ${cluster.name}: ${error instanceof Error ? error.message : String(error)}`);
      aggregatedResults.clusters.push({
        clusterId: cluster.id,
        clusterName: cluster.name,
        error: error instanceof Error ? error.message : String(error),
        successful: 0,
        failed: 0,
        namespaceCount: 0
      });
    } finally {
      // Clean up temporary kubeconfig file for this cluster
      if (opencost) {
        await opencost.cleanup();
      }
    }
  }

  console.log(`\n=== Overall OpenCost Collection Summary ===`);
  console.log(`Clusters processed: ${aggregatedResults.clusters.length}`);
  console.log(`Total successful: ${aggregatedResults.successful}`);
  console.log(`Total failed: ${aggregatedResults.failed}`);
  console.log(`Total errors: ${aggregatedResults.errors.length}`);

  return {
    message: 'OpenCost metrics collection completed for all clusters',
    timestamp: currentDate,
    hour: currentHour,
    clustersProcessed: aggregatedResults.clusters.length,
    results: aggregatedResults
  };
}