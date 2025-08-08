import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { OpenCostDirect } from '../../../lib/opencost-direct';
import { getHopsworksUserByUsername, getUserProjects, getAllProjects } from '../../../lib/hopsworks-api';

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
  // Verify this is called by Vercel Cron or admin
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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

  // Get the active Hopsworks cluster
  const { data: cluster, error: clusterError } = await supabaseAdmin
    .from('hopsworks_clusters')
    .select('*')
    .eq('status', 'active')
    .single();

  if (clusterError || !cluster) {
    throw new Error(`Failed to fetch active cluster: ${clusterError?.message || 'No active cluster'}`);
  }

  // Initialize OpenCost direct client
  const opencost = new OpenCostDirect(cluster.kubeconfig);

  try {
    // Get hourly allocations from OpenCost using kubectl exec
    const allocations = await opencost.getOpenCostAllocations('1h');

  console.log(`Found ${allocations.size} namespaces with costs`);

  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
    totalCost: 0,
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
        // Found in our cache
        userId = project.user_id;
        projectName = project.project_name;
        projectId = project.project_id;

        // Update last seen
        await supabaseAdmin
          .from('user_projects')
          .update({ last_seen_at: now.toISOString() })
          .eq('namespace', namespace);
      } else {
        // Query Hopsworks API to find owner
        console.log(`Namespace ${namespace} not in cache, querying Hopsworks...`);
        
        // Try to get project info from Hopsworks
        // Note: This assumes namespace name matches project name
        const hopsworksProjects = await getAllProjects(
          { apiUrl: cluster.api_url, apiKey: cluster.api_key },
          `ApiKey ${cluster.api_key}`
        );

        const hopsworksProject = hopsworksProjects.find(p => 
          p.name.toLowerCase() === namespace.toLowerCase()
        );

        if (hopsworksProject) {
          // Find user by Hopsworks username
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('hopsworks_username', hopsworksProject.owner)
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
          }
        }
      }

      if (!userId) {
        console.warn(`No user found for namespace ${namespace}`);
        results.errors.push(`Namespace ${namespace}: No user mapping found`);
        results.failed++;
        continue;
      }

      // Get or create today's usage record
      const { data: existingUsage } = await supabaseAdmin
        .from('usage_daily')
        .select('*')
        .eq('user_id', userId)
        .eq('date', currentDate)
        .single();

      // Calculate the hourly costs
      const hourlyCpuCost = allocation.cpuCost;
      const hourlyRamCost = allocation.ramCost;
      const hourlyStorageCost = allocation.pvCost;
      const hourlyTotalCost = allocation.totalCost;

      // Convert to hours
      const cpuHours = allocation.cpuCoreHours;
      const ramGBHours = allocation.ramByteHours / (1024 * 1024 * 1024);

      if (existingUsage) {
        // Update existing record - ADD the hourly costs
        const updatedProjectBreakdown = existingUsage.project_breakdown || {};
        updatedProjectBreakdown[namespace] = {
          name: projectName,
          cpuCost: hourlyCpuCost,
          ramCost: hourlyRamCost,
          storageCost: hourlyStorageCost,
          totalCost: hourlyTotalCost,
          cpuHours: cpuHours,
          ramGBHours: ramGBHours,
          cpuEfficiency: allocation.cpuEfficiency,
          ramEfficiency: allocation.ramEfficiency,
          lastUpdated: now.toISOString()
        };

        await supabaseAdmin
          .from('usage_daily')
          .update({
            opencost_cpu_cost: (existingUsage.opencost_cpu_cost || 0) + hourlyCpuCost,
            opencost_ram_cost: (existingUsage.opencost_ram_cost || 0) + hourlyRamCost,
            opencost_storage_cost: (existingUsage.opencost_storage_cost || 0) + hourlyStorageCost,
            opencost_total_cost: (existingUsage.opencost_total_cost || 0) + hourlyTotalCost,
            opencost_cpu_hours: (existingUsage.opencost_cpu_hours || 0) + cpuHours,
            opencost_ram_gb_hours: (existingUsage.opencost_ram_gb_hours || 0) + ramGBHours,
            project_breakdown: updatedProjectBreakdown,
            total_cost: (existingUsage.opencost_total_cost || 0) + hourlyTotalCost // Use OpenCost as source of truth
          })
          .eq('id', existingUsage.id);
      } else {
        // Create new record
        const projectBreakdown: any = {};
        projectBreakdown[namespace] = {
          name: projectName,
          cpuCost: hourlyCpuCost,
          ramCost: hourlyRamCost,
          storageCost: hourlyStorageCost,
          totalCost: hourlyTotalCost,
          cpuHours: cpuHours,
          ramGBHours: ramGBHours,
          cpuEfficiency: allocation.cpuEfficiency,
          ramEfficiency: allocation.ramEfficiency,
          lastUpdated: now.toISOString()
        };

        await supabaseAdmin
          .from('usage_daily')
          .insert({
            user_id: userId,
            date: currentDate,
            opencost_cpu_cost: hourlyCpuCost,
            opencost_ram_cost: hourlyRamCost,
            opencost_storage_cost: hourlyStorageCost,
            opencost_total_cost: hourlyTotalCost,
            opencost_cpu_hours: cpuHours,
            opencost_ram_gb_hours: ramGBHours,
            project_breakdown: projectBreakdown,
            total_cost: hourlyTotalCost,
            hopsworks_cluster_id: cluster.id
          });
      }

      results.successful++;
      results.totalCost += hourlyTotalCost;
      results.namespaces.push({
        namespace,
        projectName,
        userId,
        cost: hourlyTotalCost
      });

    } catch (error) {
      console.error(`Failed to process namespace ${namespace}:`, error);
      results.failed++;
      results.errors.push(`Namespace ${namespace}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Mark projects as inactive if not seen in 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await supabaseAdmin
    .from('user_projects')
    .update({ status: 'inactive' })
    .lt('last_seen_at', thirtyDaysAgo.toISOString())
    .eq('status', 'active');

    console.log(`OpenCost collection completed: ${results.successful} successful, ${results.failed} failed, total cost: $${results.totalCost.toFixed(4)}`);

    return {
      message: 'OpenCost metrics collection completed',
      timestamp: currentDate,
      hour: currentHour,
      results
    };
  } finally {
    // Clean up temporary kubeconfig file
    await opencost.cleanup();
  }
}