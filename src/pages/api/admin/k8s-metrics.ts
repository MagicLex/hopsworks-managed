import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { KubernetesMetricsClient } from '../../../lib/kubernetes-metrics';

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
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, user_hopsworks_assignments!inner(hopsworks_username)')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get cluster with kubeconfig
    const { data: cluster, error: clusterError } = await supabase
      .from('hopsworks_clusters')
      .select('*')
      .eq('id', clusterId)
      .single();

    if (clusterError || !cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    if (!cluster.kubeconfig) {
      return res.status(400).json({ error: 'Cluster has no kubeconfig configured' });
    }

    const username = user.hopsworks_username || user.user_hopsworks_assignments?.[0]?.hopsworks_username;
    
    if (!username) {
      return res.status(400).json({ error: 'User has no Hopsworks username' });
    }

    // Initialize K8s client
    const k8sClient = new KubernetesMetricsClient(cluster.kubeconfig);
    
    // Capture the raw Kubernetes API calls
    const k8sRequests: any[] = [];
    const originalFetch = global.fetch;
    
    // Override fetch to capture requests
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method || 'GET';
      
      if (url.includes('kubernetes')) {
        k8sRequests.push({
          method,
          url,
          headers: Object.fromEntries(
            Object.entries(init?.headers || {})
              .filter(([key]) => key.toLowerCase() !== 'authorization')
              .map(([key, value]) => [key, key.toLowerCase() === 'authorization' ? '[REDACTED]' : value])
          ),
          timestamp: new Date().toISOString()
        });
      }
      
      const response = await originalFetch(input, init);
      
      if (url.includes('kubernetes')) {
        const responseClone = response.clone();
        const responseData = await responseClone.json().catch(() => null);
        
        k8sRequests[k8sRequests.length - 1].response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData
        };
      }
      
      return response;
    };

    try {
      // Get user metrics from Kubernetes
      const userMetrics = await k8sClient.getUserMetrics(username);
      
      // Get raw namespace and pod information
      const namespaceInfo = await k8sClient.getNamespacesForUser(username);
      const podDetails = [];
      
      for (const ns of namespaceInfo) {
        const pods = await k8sClient.getPodsInNamespace(ns.name);
        podDetails.push({
          namespace: ns.name,
          pods: pods.map(pod => ({
            name: pod.metadata?.name,
            phase: pod.status?.phase,
            containers: pod.spec?.containers?.map((c: any) => ({
              name: c.name,
              image: c.image,
              resources: c.resources
            }))
          }))
        });
      }

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          hopsworksUsername: username
        },
        cluster: {
          id: cluster.id,
          name: cluster.name,
          apiUrl: cluster.api_url
        },
        kubernetesMetrics: {
          available: true,
          userMetrics,
          namespaceInfo,
          podDetails
        },
        kubernetesRequests: k8sRequests,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }
  } catch (error) {
    console.error('Error fetching K8s metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Kubernetes metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function k8sMetricsHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}