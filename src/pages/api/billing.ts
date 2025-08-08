import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_RATES } from '@/config/billing-rates';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;

    // Get user billing info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('billing_mode, stripe_customer_id, feature_flags, account_owner_id')
      .eq('id', userId)
      .single();
    
    // Team members get simplified billing info
    if (user?.account_owner_id) {
      // Get account owner info
      const { data: owner } = await supabaseAdmin
        .from('users')
        .select('email, name')
        .eq('id', user.account_owner_id)
        .single();
      
      return res.status(200).json({
        isTeamMember: true,
        accountOwner: {
          email: owner?.email,
          name: owner?.name
        },
        billingMode: 'team',
        hasPaymentMethod: true, // Team members don't need payment
        currentUsage: {
          cpuHours: 0,
          currentMonth: { total: 0 }
        }
      });
    }

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: currentMonthData } = await supabaseAdmin
      .from('usage_daily')
      .select('opencost_cpu_hours, opencost_gpu_hours, opencost_ram_gb_hours, total_cost')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    // Calculate current month totals
    const currentMonthTotals = currentMonthData?.reduce((acc, day) => ({
      cpuHours: acc.cpuHours + (day.opencost_cpu_hours || 0),
      gpuHours: acc.gpuHours + (day.opencost_gpu_hours || 0),
      storageGB: acc.storageGB + (day.opencost_ram_gb_hours || 0) / 24, // Convert GB-hours to GB
      totalCost: acc.totalCost + (day.total_cost || 0)
    }), { cpuHours: 0, gpuHours: 0, storageGB: 0, totalCost: 0 }) || 
    { cpuHours: 0, gpuHours: 0, storageGB: 0, totalCost: 0 };


    // Get last 30 days of usage for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: historicalData } = await supabaseAdmin
      .from('usage_daily')
      .select('date, opencost_cpu_hours, opencost_gpu_hours, opencost_ram_gb_hours, total_cost')
      .eq('user_id', userId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

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

    // Get billing history from Stripe
    let billingHistory: any[] = [];
    if (user?.stripe_customer_id) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2025-06-30.basil'
        });
        
        const invoices = await stripe.invoices.list({
          customer: user.stripe_customer_id,
          limit: 5
        });
        
        billingHistory = invoices.data.map(invoice => ({
          id: invoice.id,
          invoice_id: invoice.number || invoice.id,
          amount: (invoice.amount_paid || 0) / 100,
          status: invoice.status,
          created_at: new Date(invoice.created * 1000).toISOString()
        }));
      } catch (stripeError) {
        console.error('Error fetching Stripe invoices:', stripeError);
      }
    }

    // Check if customer has payment methods and get details
    let hasPaymentMethod = false;
    let paymentMethodDetails = null;
    if (user?.stripe_customer_id) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2025-06-30.basil'
        });
        
        // Check for attached payment methods - try multiple approaches
        const paymentMethods = await stripe.paymentMethods.list({
          customer: user.stripe_customer_id,
          type: 'card'
        });
        
        // Also check all payment method types
        const allPaymentMethods = await stripe.paymentMethods.list({
          customer: user.stripe_customer_id
        });
        
        // Check customer's default payment method
        const customer = await stripe.customers.retrieve(user.stripe_customer_id);
        const hasDefaultPaymentMethod = !!(customer as any).invoice_settings?.default_payment_method || !!(customer as any).default_source;
        
        // Check if customer has any successful setup intents
        const setupIntents = await stripe.setupIntents.list({
          customer: user.stripe_customer_id,
          limit: 1
        });
        const hasSuccessfulSetup = setupIntents.data.some(si => si.status === 'succeeded');
        
        hasPaymentMethod = paymentMethods.data.length > 0 || 
                          allPaymentMethods.data.length > 0 || 
                          hasDefaultPaymentMethod || 
                          hasSuccessfulSetup;
        
        // Get payment method details if available
        if (paymentMethods.data.length > 0) {
          const primaryCard = paymentMethods.data[0];
          paymentMethodDetails = {
            type: 'card',
            card: {
              brand: primaryCard.card?.brand || 'card',
              last4: primaryCard.card?.last4 || '****',
              expMonth: primaryCard.card?.exp_month,
              expYear: primaryCard.card?.exp_year
            }
          };
        } else if ((customer as any).invoice_settings?.default_payment_method) {
          // Fetch the default payment method details
          try {
            const defaultPm = await stripe.paymentMethods.retrieve(
              (customer as any).invoice_settings.default_payment_method
            );
            if (defaultPm.card) {
              paymentMethodDetails = {
                type: 'card',
                card: {
                  brand: defaultPm.card.brand,
                  last4: defaultPm.card.last4,
                  expMonth: defaultPm.card.exp_month,
                  expYear: defaultPm.card.exp_year
                }
              };
            }
          } catch (e) {
            // Ignore error fetching payment method details
          }
        }
        
      } catch (error) {
        console.error('Error checking payment methods:', error);
        hasPaymentMethod = false;
      }
    }

    // Prevent caching of billing data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).json({
      billingMode: user?.billing_mode || 'postpaid',
      hasPaymentMethod,
      paymentMethodDetails,
      subscriptionStatus: null, // Column doesn't exist in DB
      prepaidEnabled: user?.feature_flags?.prepaid_enabled || false,
      currentUsage: {
        cpuHours: currentMonthTotals.cpuHours.toFixed(2),
        storageGB: currentMonthTotals.storageGB.toFixed(2),
        currentMonth: {
          total: currentMonthTotals.totalCost
        }
      },
      creditBalance,
      invoices: billingHistory?.map(bill => ({
        id: bill.id,
        invoice_number: bill.invoice_id,
        amount: bill.amount,
        status: bill.status,
        created_at: bill.created_at
      })) || [],
      historicalUsage: historicalData?.map(day => ({
        date: day.date,
        cpu_hours: day.opencost_cpu_hours || 0,
        gpu_hours: day.opencost_gpu_hours || 0,
        storage_gb: (day.opencost_ram_gb_hours || 0) / 24,
        total_cost: day.total_cost || 0
      })) || [],
      // Display rates (actual billing happens via Stripe for postpaid)
      rates: {
        cpu_hour: DEFAULT_RATES.CPU_HOUR,
        gpu_hour: DEFAULT_RATES.GPU_HOUR,
        ram_gb_hour: DEFAULT_RATES.RAM_GB_HOUR,
        storage_online_gb: DEFAULT_RATES.STORAGE_ONLINE_GB,
        storage_offline_gb: DEFAULT_RATES.STORAGE_OFFLINE_GB,
        network_egress_gb: DEFAULT_RATES.NETWORK_EGRESS_GB
      }
    });
  } catch (error) {
    console.error('Error fetching billing:', error);
    return res.status(500).json({ error: 'Failed to fetch billing data' });
  }
}