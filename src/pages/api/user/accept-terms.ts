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
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    const { marketingConsent } = req.body;

    // Update user with terms acceptance
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        terms_accepted_at: new Date().toISOString(),
        marketing_consent: !!marketingConsent
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating terms acceptance:', error);
      return res.status(500).json({ error: 'Failed to save consent' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in accept-terms:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
