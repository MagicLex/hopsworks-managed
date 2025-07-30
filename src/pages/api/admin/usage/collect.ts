import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';

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
    // Check admin authentication
    const session = await getSession(req, res);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify admin status
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('auth0_id', session.user.sub)
      .single();

    if (!user?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Call the collect-k8s endpoint with cron secret
    const collectResponse = await fetch(`${process.env.AUTH0_BASE_URL}/api/usage/collect-k8s`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });

    if (!collectResponse.ok) {
      const error = await collectResponse.text();
      throw new Error(`Collection failed: ${error}`);
    }

    const result = await collectResponse.json();

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