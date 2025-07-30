import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../middleware/adminAuth';
import { collectK8sMetrics } from '../../../../lib/usage-collection';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Call the collection function directly with force aggregation
    const result = await collectK8sMetrics(true);

    return res.status(200).json({
      message: 'Usage collection triggered successfully',
      result
    });
  } catch (error) {
    console.error('Error triggering collection:', error);
    return res.status(500).json({ 
      error: 'Failed to trigger collection',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export default function adminCollectHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}