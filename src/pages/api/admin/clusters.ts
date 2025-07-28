import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data: clusters, error } = await supabase
        .from('clusters')
        .select(`
          *,
          user_cluster_assignments (count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching clusters:', error);
        return res.status(500).json({ error: 'Failed to fetch clusters' });
      }

      return res.status(200).json({ clusters: clusters || [] });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, api_url, api_key, max_users } = req.body;

      const { data: cluster, error } = await supabase
        .from('clusters')
        .insert({
          name,
          api_url,
          api_key,
          max_users: max_users || 100,
          current_users: 0,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating cluster:', error);
        return res.status(500).json({ error: 'Failed to create cluster' });
      }

      return res.status(201).json({ cluster });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;

      const { data: cluster, error } = await supabase
        .from('clusters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating cluster:', error);
        return res.status(500).json({ error: 'Failed to update cluster' });
      }

      return res.status(200).json({ cluster });
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

const adminClustersHandler = function (req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}

export default adminClustersHandler;