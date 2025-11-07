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
    const { userId, promoCode, corporateRef } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check user exists
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, promo_code, metadata')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    // Update promo_code if provided (empty string clears it)
    if (promoCode !== undefined) {
      updates.promo_code = promoCode || null;
    }

    // Update metadata.corporate_ref if provided
    if (corporateRef !== undefined) {
      const currentMetadata = targetUser.metadata || {};
      if (corporateRef) {
        updates.metadata = { ...currentMetadata, corporate_ref: corporateRef };
      } else {
        // Remove corporate_ref if empty
        const { corporate_ref, ...rest } = currentMetadata;
        updates.metadata = rest;
      }
    }

    // Update user
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user metadata:', updateError);
      return res.status(500).json({ error: 'Failed to update user metadata' });
    }

    return res.status(200).json({
      success: true,
      message: `User ${targetUser.email} metadata updated successfully`,
      updates: {
        promo_code: updates.promo_code,
        corporate_ref: corporateRef
      }
    });
  } catch (error) {
    console.error('Error updating user metadata:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export default withAdminAuth(handler);
