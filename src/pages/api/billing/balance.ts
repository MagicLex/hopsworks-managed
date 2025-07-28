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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;

    // Get user billing info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('billing_mode, feature_flags, stripe_subscription_status')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // For postpaid users, return subscription status
    if (user.billing_mode === 'postpaid') {
      return res.status(200).json({
        billingMode: 'postpaid',
        subscriptionStatus: user.stripe_subscription_status || 'none',
        prepaidEnabled: user.feature_flags?.prepaid_enabled || false
      });
    }

    // For prepaid users, get credit balance
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') { // Not found is ok
      throw creditsError;
    }

    const balance = credits ? (credits.total_purchased - credits.total_used) : 0;
    const freeBalance = credits ? (credits.free_credits_granted - credits.free_credits_used) : 0;

    // Get recent transactions
    const { data: transactions } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      billingMode: 'prepaid',
      balance: {
        total: balance + freeBalance,
        paid: balance,
        free: freeBalance
      },
      credits: {
        totalPurchased: credits?.total_purchased || 0,
        totalUsed: credits?.total_used || 0,
        cpuHoursUsed: credits?.cpu_hours_used || 0,
        gpuHoursUsed: credits?.gpu_hours_used || 0,
        storageGbMonths: credits?.storage_gb_months || 0
      },
      autoRefill: {
        enabled: user.feature_flags?.auto_refill_enabled || false,
        amount: user.feature_flags?.auto_refill_amount || 50,
        threshold: user.feature_flags?.auto_refill_threshold || 10
      },
      recentTransactions: transactions || []
    });
  } catch (error) {
    console.error('Error fetching billing balance:', error);
    return res.status(500).json({ error: 'Failed to fetch billing information' });
  }
}