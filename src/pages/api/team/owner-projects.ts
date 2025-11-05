import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { getUserProjects } from '../../../lib/hopsworks-team';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.sub;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if user is an account owner
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('account_owner_id, hopsworks_username')
      .eq('id', userId)
      .single();

    if (!currentUser || currentUser.account_owner_id !== null) {
      return res.status(403).json({ error: 'Only account owners can access this endpoint' });
    }

    // Get projects directly from user_projects table - this is the source of truth
    // for project ownership and namespace mappings
    const { data: dbProjects, error: dbError } = await supabaseAdmin
      .from('user_projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (dbError) {
      console.error('Failed to fetch projects from database:', dbError);
      return res.status(500).json({ error: 'Failed to fetch projects from database' });
    }

    const projects = (dbProjects || []).map(p => ({
      id: p.project_id,
      name: p.project_name,
      namespace: p.namespace
    }));

    console.log(`Found ${projects.length} active projects for user ${userId}`);
    return res.status(200).json({ projects });

  } catch (error) {
    console.error('Failed to fetch owner projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}