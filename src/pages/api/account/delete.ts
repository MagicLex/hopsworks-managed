import { NextApiRequest, NextApiResponse } from 'next';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default withApiAuthRequired(async function handler(
  req: NextApiRequest, 
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;

    // 1. Delete all user data from Supabase
    // Delete in order to respect foreign key constraints
    
    // Delete usage records
    await supabase
      .from('usage_daily')
      .delete()
      .eq('user_id', userId);

    // Delete cluster assignments
    await supabase
      .from('user_hopsworks_assignments')
      .delete()
      .eq('user_id', userId);

    // Delete billing subscriptions
    await supabase
      .from('user_billing_subscriptions')
      .delete()
      .eq('user_id', userId);

    // Finally delete the user record
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Error deleting user data:', error);
      return res.status(500).json({ error: 'Failed to delete user data' });
    }

    // 2. Note: Auth0 user deletion would require Management API
    // This is typically handled through Auth0 dashboard or a separate admin endpoint
    // as it requires elevated permissions

    return res.status(200).json({ 
      success: true,
      message: 'User data deleted successfully' 
    });
  } catch (error) {
    console.error('Error in account deletion:', error);
    return res.status(500).json({ 
      error: 'Failed to process account deletion' 
    });
  }
});