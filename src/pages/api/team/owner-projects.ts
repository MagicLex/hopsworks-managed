import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { getUserProjects } from '../../../lib/hopsworks-team';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession(req, res);
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.sub;

  try {
    // Get owner's cluster and Hopsworks username
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select(`
        account_owner_id,
        hopsworks_username,
        user_hopsworks_assignments!inner (
          hopsworks_cluster_id,
          hopsworks_clusters!inner (
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (!owner) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only account owners can get this
    if (owner.account_owner_id !== null) {
      return res.status(403).json({ error: 'Only account owners can access this' });
    }

    if (!owner.hopsworks_username) {
      return res.status(200).json({ projects: [] });
    }

    const assignment = owner.user_hopsworks_assignments[0] as any;
    const credentials = {
      apiUrl: assignment.hopsworks_clusters.api_url,
      apiKey: assignment.hopsworks_clusters.api_key
    };

    // Get owner's projects
    const projects = await getUserProjects(credentials, owner.hopsworks_username);

    return res.status(200).json({ projects });

  } catch (error) {
    console.error('Failed to fetch owner projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}