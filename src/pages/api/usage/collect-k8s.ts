import { NextApiRequest, NextApiResponse } from 'next';
import { collectK8sMetrics } from '../../../lib/usage-collection';

// This endpoint collects usage data directly from Kubernetes
// Should be called hourly by a cron job for more accurate tracking
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify this is called by Vercel Cron or admin
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
    const result = await collectK8sMetrics();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error collecting K8s metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
}