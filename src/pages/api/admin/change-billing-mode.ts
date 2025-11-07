import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '../../../middleware/adminAuth';

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
    const { userId, billingMode } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!billingMode || !['prepaid', 'postpaid'].includes(billingMode)) {
      return res.status(400).json({ error: 'billingMode must be either "prepaid" or "postpaid"' });
    }

    // Check user exists
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, billing_mode, account_owner_id')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow changing billing mode for team members
    if (targetUser.account_owner_id) {
      return res.status(400).json({ error: 'Cannot change billing mode for team members. Only account owners can have billing settings.' });
    }

    // Check if already set to this mode
    if (targetUser.billing_mode === billingMode) {
      return res.status(400).json({ error: `User is already in ${billingMode} mode` });
    }

    // Update billing mode
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        billing_mode: billingMode,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating billing mode:', updateError);
      return res.status(500).json({ error: 'Failed to update billing mode' });
    }

    return res.status(200).json({
      success: true,
      message: `User ${targetUser.email} billing mode changed to ${billingMode}`,
      previousMode: targetUser.billing_mode,
      newMode: billingMode
    });
  } catch (error) {
    console.error('Error changing billing mode:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export default withAdminAuth(handler);
