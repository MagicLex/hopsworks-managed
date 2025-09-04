import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { syncUserProjects } from '../../../lib/project-sync';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const { data: currentUser } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', session.user.sub)
    .single();

  if (!currentUser?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    // Sync projects for the specific user
    const result = await syncUserProjects(userId);
    
    if (result.success) {
      console.log(`[Admin] Synced ${result.projectsSynced} of ${result.projectsFound} projects for user ${userId}`);
      return res.status(200).json(result);
    } else {
      console.error(`[Admin] Failed to sync projects for user ${userId}: ${result.error}`);
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}