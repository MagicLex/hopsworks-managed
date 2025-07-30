import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.sub)
      .single();

    if (error || !user?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return handler(req, res);
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}