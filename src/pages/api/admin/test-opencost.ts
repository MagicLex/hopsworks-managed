import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { OpenCostDirect } from '../../../lib/opencost-direct';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', session.user.sub)
      .single();

    if (!adminUser?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { clusterId } = req.body;

    if (!clusterId) {
      return res.status(400).json({ error: 'Cluster ID required' });
    }

    // Get cluster kubeconfig
    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from('hopsworks_clusters')
      .select('name, kubeconfig')
      .eq('id', clusterId)
      .single();

    if (clusterError || !cluster?.kubeconfig) {
      return res.status(404).json({ error: 'Cluster not found or missing kubeconfig' });
    }

    // Test OpenCost connection using kubectl exec
    const opencost = new OpenCostDirect(cluster.kubeconfig);
    
    try {
      const allocations = await opencost.getOpenCostAllocations('1h');
      
      // Calculate total cost across all namespaces
      let totalCost = 0;
      let namespaceCount = 0;
      
      for (const [namespace, allocation] of allocations) {
        totalCost += allocation.totalCost;
        namespaceCount++;
      }

      await opencost.cleanup();

      return res.status(200).json({
        success: true,
        connected: true,
        cluster: cluster.name,
        namespaces: namespaceCount,
        hourlyTotalCost: totalCost,
        message: `Connected via kubectl exec! Found ${namespaceCount} namespaces, hourly cost: $${totalCost.toFixed(4)}`
      });
    } catch (error) {
      await opencost.cleanup();
      console.error('OpenCost connection error:', error);
      
      return res.status(200).json({
        success: false,
        connected: false,
        cluster: cluster.name,
        error: error instanceof Error ? error.message : 'Failed to connect to OpenCost',
        message: 'Failed to connect. Make sure OpenCost is installed in the cluster.'
      });
    }
  } catch (error) {
    console.error('Test OpenCost error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}