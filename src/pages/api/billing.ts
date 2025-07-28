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
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('billing_mode, stripe_customer_id, stripe_subscription_status, feature_flags')
      .eq('id', userId)
      .single();

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usageData } = await supabaseAdmin
      .from('usage_daily')
      .select('cpu_hours, gpu_hours, storage_gb, total_cost')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    // Calculate totals
    const totals = usageData?.reduce((acc, day) => ({
      cpuHours: acc.cpuHours + (day.cpu_hours || 0),
      gpuHours: acc.gpuHours + (day.gpu_hours || 0),
      storageGB: Math.max(acc.storageGB, day.storage_gb || 0),
      totalCost: acc.totalCost + (day.total_cost || 0)
    }), { cpuHours: 0, gpuHours: 0, storageGB: 0, totalCost: 0 }) || 
    { cpuHours: 0, gpuHours: 0, storageGB: 0, totalCost: 0 };

    // For prepaid users, get credit balance
    let creditBalance = null;
    if (user?.billing_mode === 'prepaid' && user?.feature_flags?.prepaid_enabled) {
      const { data: credits } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (credits) {
        creditBalance = {
          total: (credits.total_purchased - credits.total_used) + 
                 (credits.free_credits_granted - credits.free_credits_used),
          purchased: credits.total_purchased - credits.total_used,
          free: credits.free_credits_granted - credits.free_credits_used
        };
      }
    }

    // Get billing history
    const { data: billingHistory, error: billingError } = await supabaseAdmin
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (billingError) console.error('Billing error:', billingError);

    return res.status(200).json({
      billingMode: user?.billing_mode || 'postpaid',
      hasPaymentMethod: !!user?.stripe_customer_id,
      subscriptionStatus: user?.stripe_subscription_status,
      prepaidEnabled: user?.feature_flags?.prepaid_enabled || false,
      currentUsage: {
        cpuHours: totals.cpuHours.toFixed(2),
        gpuHours: totals.gpuHours.toFixed(2),
        storageGB: totals.storageGB.toFixed(2),
        currentMonth: {
          cpuCost: totals.cpuHours * 0.10,
          gpuCost: totals.gpuHours * 0.50,
          storageCost: totals.storageGB * 0.10,
          total: totals.totalCost
        }
      },
      creditBalance,
      invoices: billingHistory?.map(bill => ({
        id: bill.id,
        invoice_number: bill.invoice_id,
        amount: bill.amount,
        status: bill.status,
        created_at: bill.created_at
      })) || []
    });
  } catch (error) {
    console.error('Error fetching billing:', error);
    return res.status(500).json({ error: 'Failed to fetch billing data' });
  }
}