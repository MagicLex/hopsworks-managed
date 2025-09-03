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
  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', session.user.sub)
      .single();

    if (!adminUser?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    switch (req.method) {
      case 'POST':
        return handlePost(req, res);
      case 'GET':
        return handleGet(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Admin billing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { action, userId, data } = req.body;

  switch (action) {
    case 'enable_prepaid': {
      // Get current user data
      const { data: currentUser, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('feature_flags')
        .eq('id', userId)
        .single();

      if (fetchError) {
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }

      // Merge feature flags
      const updatedFeatureFlags = {
        ...(currentUser?.feature_flags || {}),
        prepaid_enabled: true
      };

      // Enable prepaid mode for a user
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          billing_mode: 'prepaid',
          feature_flags: updatedFeatureFlags
        })
        .eq('id', userId);

      if (error) {
        return res.status(500).json({ error: 'Failed to enable prepaid mode' });
      }

      // Prepaid mode enabled - uses invoicing, not credits

      return res.status(200).json({ success: true });
    }

    case 'disable_prepaid': {
      // Get current user data
      const { data: currentUser, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('feature_flags')
        .eq('id', userId)
        .single();

      if (fetchError) {
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }

      // Merge feature flags
      const updatedFeatureFlags = {
        ...(currentUser?.feature_flags || {}),
        prepaid_enabled: false
      };

      // Switch user back to postpaid
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          billing_mode: 'postpaid',
          feature_flags: updatedFeatureFlags
        })
        .eq('id', userId);

      if (error) {
        return res.status(500).json({ error: 'Failed to disable prepaid mode' });
      }

      return res.status(200).json({ success: true });
    }

    // Removed grant_credits - not using credit system

    // Removed set_pricing_override - not using pricing overrides

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;

  if (!userId) {
    // Get all users with billing info
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        billing_mode,
        feature_flags,
        stripe_subscription_status,
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    return res.status(200).json({ users });
  }

  // Get specific user billing details
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(`
      *
    `)
    .eq('id', userId)
    .single();

  if (error) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user });
}