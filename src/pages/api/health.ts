import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: 'ok',
      database: 'unknown',
      auth0: 'unknown'
    }
  };

  try {
    // Check database connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    health.checks.database = error ? 'error' : 'ok';

    // Check Auth0 configuration
    health.checks.auth0 = process.env.AUTH0_CLIENT_ID ? 'configured' : 'not_configured';

    // Overall status
    if (health.checks.database === 'error') {
      health.status = 'degraded';
      res.status(503);
    } else {
      res.status(200);
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = 'error';
    res.status(503);
  }

  return res.json(health);
}