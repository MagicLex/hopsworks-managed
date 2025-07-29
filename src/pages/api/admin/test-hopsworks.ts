import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { testHopsworksConnection } from '../../../lib/hopsworks-api';

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
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Test connection to Hopsworks
    const testResult = await testHopsworksConnection(
      {
        apiUrl: cluster.api_url,
        apiKey: cluster.api_key
      },
      userId
    );

    // Return comprehensive test results
    return res.status(200).json({
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
      connectionResult: testResult,
      notes: [
        'This is a test endpoint to verify Hopsworks API connectivity',
        'Actual usage data collection requires proper authentication',
        'Consider using ApiKey authentication or admin credentials'
      ]
    });
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