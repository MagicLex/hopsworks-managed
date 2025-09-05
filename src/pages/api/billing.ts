import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_RATES } from '@/config/billing-rates';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { month } = req.query;
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
          storageGB: 0,
          currentMonth: { 
            cpuCost: 0,
            storageCost: 0,
            baseCost: 0,
            total: 0 
          }
        }
      });
    }

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: currentMonthData } = await supabaseAdmin
      .from('usage_daily')
      .select('opencost_cpu_hours, opencost_gpu_hours, opencost_ram_gb_hours, total_cost, online_storage_gb, offline_storage_gb')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    // Calculate current month totals
    const currentMonthTotals = currentMonthData?.reduce((acc, day) => ({
      cpuHours: acc.cpuHours + (day.opencost_cpu_hours || 0),
      gpuHours: acc.gpuHours + (day.opencost_gpu_hours || 0),
      storageGB: acc.storageGB + (day.online_storage_gb || 0) + (day.offline_storage_gb || 0),
      totalCost: acc.totalCost + (day.total_cost || 0)
    }), { cpuHours: 0, gpuHours: 0, storageGB: 0, totalCost: 0 }) || 
    { cpuHours: 0, gpuHours: 0, storageGB: 0, totalCost: 0 };


    // Get usage data for the requested period
    let startDate: Date;
    let endDate: Date;
    
    if (month && typeof month === 'string' && month !== 'current') {
      // Specific month requested (YYYY-MM format)
      startDate = new Date(month + '-01');
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); // Last day of month
    } else {
      // Default: last 30 days
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    
    const { data: historicalData } = await supabaseAdmin
      .from('usage_daily')
      .select('date, opencost_cpu_hours, opencost_gpu_hours, online_storage_gb, offline_storage_gb, total_cost')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Prepaid users use invoicing, not credits
    let creditBalance = null;

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
          limit: 10, // Get more to filter out drafts
          expand: ['data.subscription']
        });
        
        // Filter out draft invoices or finalize them if they're ready
        const processedInvoices = [];
        for (const invoice of invoices.data) {
          // Skip draft invoices that are empty (no items)
          if (invoice.status === 'draft') {
            // Check if it has line items and should be finalized
            if (invoice.lines && invoice.lines.data && invoice.lines.data.length > 0 && invoice.auto_advance) {
              try {
                // Auto-finalize drafts that have items and auto_advance enabled
                const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id!);
                processedInvoices.push(finalizedInvoice);
                console.log(`Finalized draft invoice ${invoice.id}`);
              } catch (err) {
                console.log(`Could not finalize draft invoice ${invoice.id}:`, err);
                // Skip this draft
              }
            }
            // Skip drafts - they're not real invoices yet
            continue;
          }
          processedInvoices.push(invoice);
        }
        
        console.log('Processed invoices:', processedInvoices.map(inv => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          has_url: !!inv.hosted_invoice_url
        })));
        
        billingHistory = processedInvoices.slice(0, 5).map(invoice => ({
          id: invoice.id,
          invoice_id: invoice.number || invoice.id,
          amount: (invoice.amount_paid || invoice.amount_due || 0) / 100,
          status: invoice.status || 'unknown',
          created_at: new Date(invoice.created * 1000).toISOString(),
          invoice_url: invoice.hosted_invoice_url,
          pdf_url: invoice.invoice_pdf,
          total: (invoice.total || invoice.amount_due || 0) / 100,
          currency: invoice.currency || 'usd'
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
        
        // Only check actual payment methods, not setup intent history
        hasPaymentMethod = paymentMethods.data.length > 0 || 
                          allPaymentMethods.data.length > 0 || 
                          hasDefaultPaymentMethod;
        
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
          cpuCost: currentMonthTotals.cpuHours * DEFAULT_RATES.CPU_HOUR,
          storageCost: currentMonthTotals.storageGB * DEFAULT_RATES.STORAGE_ONLINE_GB,
          baseCost: currentMonthTotals.totalCost,
          total: currentMonthTotals.totalCost
        }
      },
      creditBalance,
      invoices: billingHistory?.map(bill => ({
        id: bill.id,
        invoice_number: bill.invoice_id,
        amount: bill.amount,
        status: bill.status,
        created_at: bill.created_at,
        invoice_url: bill.invoice_url,
        pdf_url: bill.pdf_url,
        total: bill.total,
        currency: bill.currency
      })) || [],
      historicalUsage: historicalData?.map(day => ({
        date: day.date,
        cpu_hours: day.opencost_cpu_hours || 0,
        gpu_hours: day.opencost_gpu_hours || 0,
        storage_gb: (day.online_storage_gb || 0) + (day.offline_storage_gb || 0),
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