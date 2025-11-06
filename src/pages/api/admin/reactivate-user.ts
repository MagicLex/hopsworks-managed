import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '../../../middleware/adminAuth';
import { reactivateUser } from '../../../lib/user-status';

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check user exists and is suspended
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, account_owner_id')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.status !== 'suspended') {
      return res.status(400).json({
        error: `Cannot reactivate user with status '${targetUser.status}'. Only suspended users can be reactivated.`
      });
    }

    // Reactivate the user (includes Hopsworks reactivation)
    const result = await reactivateUser(
      supabaseAdmin as any,
      userId,
      reason || 'admin_action'
    );

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to reactivate user',
        details: {
          supabaseUpdated: result.supabaseUpdated,
          hopsworksUpdated: result.hopsworksUpdated
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `User ${targetUser.email} reactivated successfully`,
      supabaseUpdated: result.supabaseUpdated,
      hopsworksUpdated: result.hopsworksUpdated
    });
  } catch (error) {
    console.error('Error reactivating user:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export default withAdminAuth(handler);
