import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Get health check failures with filters
    const { 
      userId, 
      email, 
      checkType, 
      unresolved,
      limit = 100,
      offset = 0
    } = req.query;

    let query = supabase
      .from('health_check_failures')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (email) {
      query = query.ilike('email', `%${email}%`);
    }
    
    if (checkType) {
      query = query.eq('check_type', checkType);
    }
    
    if (unresolved === 'true') {
      query = query.is('resolved_at', null);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch health check failures' });
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('health_check_failures')
      .select('check_type')
      .is('resolved_at', null);

    const unresolvedByType = stats?.reduce((acc, item) => {
      acc[item.check_type] = (acc[item.check_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return res.status(200).json({
      failures: data,
      total: count,
      unresolvedByType,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        hasMore: count ? Number(offset) + Number(limit) < count : false
      }
    });
  } 
  
  else if (req.method === 'PATCH') {
    // Mark failure as resolved
    const { id, resolution_notes } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Failure ID is required' });
    }

    const { error } = await supabase
      .from('health_check_failures')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update failure status' });
    }

    return res.status(200).json({ success: true });
  }
  
  else if (req.method === 'POST') {
    // Bulk resolve failures
    const { ids, resolution_notes } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const { error } = await supabase
      .from('health_check_failures')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes
      })
      .in('id', ids);

    if (error) {
      return res.status(500).json({ error: 'Failed to bulk update failures' });
    }

    return res.status(200).json({ success: true, resolved: ids.length });
  }
  
  else if (req.method === 'DELETE') {
    // Delete old resolved failures (cleanup)
    const daysOld = Number(req.query.daysOld) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('health_check_failures')
      .delete()
      .not('resolved_at', 'is', null)
      .lt('resolved_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to delete old failures' });
    }

    return res.status(200).json({ 
      success: true, 
      deleted: data?.length || 0,
      message: `Deleted ${data?.length || 0} resolved failures older than ${daysOld} days`
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default function healthCheckFailuresHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}