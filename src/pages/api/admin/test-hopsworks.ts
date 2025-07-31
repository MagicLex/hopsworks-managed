import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_API_BASE, HOPSWORKS_API_BASE } from '../../../lib/hopsworks-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, clusterId } = req.body;

  if (!userId || !clusterId) {
    return res.status(400).json({ error: 'userId and clusterId are required' });
  }

  try {
    // Get cluster credentials
    const { data: cluster, error: clusterError } = await supabase
      .from('hopsworks_clusters')
      .select('*')
      .eq('id', clusterId)
      .single();

    if (clusterError || !cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, user_hopsworks_assignments!left(hopsworks_username)')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Import the Hopsworks API functions
    const { 
      getHopsworksUserByAuth0Id, 
      getHopsworksUserByUsername,
      getUserProjects,
      getAllUsers,
      getAllProjects
    } = await import('../../../lib/hopsworks-api');

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    const results: any = {
      test: 'hopsworks-connection',
      timestamp: new Date().toISOString(),
      cluster: {
        id: cluster.id,
        name: cluster.name,
        api_url: cluster.api_url,
        status: cluster.status
      },
      user: {
        id: user.id,
        email: user.email,
        hopsworks_project_id: user.hopsworks_project_id || 'not_set'
      },
      hopsworksData: {}
    };

    let hopsworksUser: any = null;
    
    // First check if we have a stored username
    const storedUsername = user.hopsworks_username || user.user_hopsworks_assignments?.[0]?.hopsworks_username;
    
    if (storedUsername) {
      // We have a stored username, use it directly
      hopsworksUser = {
        username: storedUsername,
        email: user.email
      };
      results.hopsworksData.user = hopsworksUser;
      results.hopsworksData.storedUsername = true;
    } else {
      results.hopsworksData.userLookupError = 'No stored Hopsworks username found';
    }

    // Note: Hopsworks API metrics endpoints not available - using Kubernetes metrics instead

    // Test Kubernetes metrics collection
    try {
      if (!cluster.kubeconfig) {
        results.kubernetesMetrics = {
          available: false,
          error: 'No kubeconfig found for this cluster',
          note: 'Upload kubeconfig using the /api/admin/clusters/update-kubeconfig endpoint'
        };
      } else {
        const { KubernetesMetricsClient } = await import('../../../lib/kubernetes-metrics');
        
        // Use kubeconfig string directly
        const k8sClient = new KubernetesMetricsClient(cluster.kubeconfig, false);
        
        // Try to get metrics for the user
        if (hopsworksUser && hopsworksUser.username) {
          const userMetrics = await k8sClient.getUserMetrics(hopsworksUser.username);
          results.kubernetesMetrics = {
            available: true,
            userMetrics: userMetrics,
            note: 'Metrics collected directly from Kubernetes cluster'
          };
        } else {
          results.kubernetesMetrics = {
            available: false,
            error: 'Hopsworks username not found',
            note: 'Need Hopsworks username to query Kubernetes metrics'
          };
        }
      }
    } catch (k8sError) {
      results.kubernetesMetrics = {
        available: false,
        error: k8sError instanceof Error ? k8sError.message : 'Failed to connect to Kubernetes',
        note: 'Check kubeconfig validity and cluster connectivity'
      };
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error testing Hopsworks connection:', error);
    return res.status(500).json({ 
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function testHopsworksHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}