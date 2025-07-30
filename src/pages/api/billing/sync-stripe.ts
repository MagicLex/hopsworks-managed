import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil'
});

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

// This endpoint syncs usage data to Stripe
// Should be called daily by a cron job
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify this is called by Vercel Cron
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];

    console.log(`Starting Stripe usage sync for date: ${reportDate}`);

    // Get all unreported usage for yesterday (postpaid users only)
    const { data: unreportedUsage, error: usageError } = await supabaseAdmin
      .from('usage_daily')
      .select(`
        *,
        users!inner (
          stripe_customer_id,
          stripe_subscription_id,
          email,
          billing_mode
        )
      `)
      .eq('date', reportDate)
      .eq('reported_to_stripe', false)
      .eq('users.billing_mode', 'postpaid')
      .not('users.stripe_subscription_id', 'is', null);

    if (usageError) {
      throw new Error(`Failed to fetch usage data: ${usageError.message}`);
    }

    if (!unreportedUsage || unreportedUsage.length === 0) {
      return res.status(200).json({ 
        message: 'No unreported usage found',
        date: reportDate 
      });
    }

    // Get Stripe product IDs from our configuration
    const { data: stripeProducts } = await supabaseAdmin
      .from('stripe_products')
      .select('*')
      .eq('active', true);

    if (!stripeProducts || stripeProducts.length === 0) {
      throw new Error('No active Stripe products configured');
    }

    const productMap = stripeProducts.reduce((acc, product) => {
      acc[product.product_type] = product;
      return acc;
    }, {} as Record<string, any>);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each user's usage
    for (const usage of unreportedUsage) {
      try {
        const customerId = usage.users.stripe_customer_id;
        const subscriptionId = usage.users.stripe_subscription_id;

        // Get the subscription to find subscription items
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Find subscription items for each product type
        const cpuItem = subscription.items.data.find(item => 
          item.price.product === productMap.cpu_hours?.stripe_product_id
        );
        const storageItem = subscription.items.data.find(item => 
          item.price.product === productMap.storage_gb?.stripe_product_id
        );
        const apiItem = subscription.items.data.find(item => 
          item.price.product === productMap.api_calls?.stripe_product_id
        );

        // Report CPU hours (using total_cost instead of raw hours)
        if (cpuItem && usage.total_cost > 0) {
          const cpuUsageRecord = await stripe.billing.meterEvents.create({
            event_name: 'cpu_usage',
            payload: {
              value: String(Math.round(usage.total_cost * 100)), // Convert dollars to cents
              stripe_customer_id: customerId,
            },
            timestamp: Math.floor(new Date(reportDate).getTime() / 1000)
          });

          // Update our record with Stripe ID
          await supabaseAdmin
            .from('usage_daily')
            .update({ 
              stripe_usage_record_id: cpuUsageRecord.identifier 
            })
            .eq('id', usage.id);
        }

        // Report storage GB (average for the day)
        if (storageItem && usage.storage_gb > 0) {
          await stripe.billing.meterEvents.create({
            event_name: 'storage_usage',
            payload: {
              value: String(Math.round(usage.storage_gb)),
              stripe_customer_id: customerId,
            },
            timestamp: Math.floor(new Date(reportDate).getTime() / 1000)
          });
        }

        // Report API calls
        if (apiItem && usage.api_calls > 0) {
          await stripe.billing.meterEvents.create({
            event_name: 'api_calls',
            payload: {
              value: String(usage.api_calls),
              stripe_customer_id: customerId,
            },
            timestamp: Math.floor(new Date(reportDate).getTime() / 1000)
          });
        }

        // Mark as reported
        await supabaseAdmin
          .from('usage_daily')
          .update({ 
            reported_to_stripe: true 
          })
          .eq('id', usage.id);

        // Update detailed reports
        await supabaseAdmin
          .from('stripe_usage_reports')
          .update({ 
            status: 'reported',
            reported_at: new Date().toISOString()
          })
          .eq('user_id', usage.user_id)
          .eq('date', reportDate);

        results.successful++;
      } catch (error) {
        console.error(`Failed to sync usage for user ${usage.user_id}:`, error);
        results.failed++;
        results.errors.push(`User ${usage.users.email}: ${error instanceof Error ? error.message : String(error)}`);

        // Mark as failed in our records
        await supabaseAdmin
          .from('stripe_usage_reports')
          .update({ 
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          })
          .eq('user_id', usage.user_id)
          .eq('date', reportDate);
      }
    }

    console.log(`Stripe sync completed: ${results.successful} successful, ${results.failed} failed`);

    return res.status(200).json({
      message: 'Usage sync completed',
      date: reportDate,
      results
    });
  } catch (error) {
    console.error('Error syncing usage to Stripe:', error);
    return res.status(500).json({ 
      error: 'Failed to sync usage data',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
}