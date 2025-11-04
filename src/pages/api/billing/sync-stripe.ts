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
  // Verify this is called by Vercel Cron with proper authentication
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  // Always check CRON_SECRET if it's configured
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    console.error('Stripe sync unauthorized attempt');
    return res.status(401).json({ error: 'Unauthorized' });
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
        users!usage_daily_user_id_fkey!inner (
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

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each user's usage
    for (const usage of unreportedUsage) {
      try {
        const customerId = usage.users.stripe_customer_id;

        // Report compute credits (total cost in cents)
        if (usage.total_cost > 0) {
          const cpuUsageRecord = await stripe.billing.meterEvents.create({
            event_name: 'compute_credits',
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

        // Report online storage GB
        if (usage.online_storage_gb > 0) {
          await stripe.billing.meterEvents.create({
            event_name: 'storage_online_gb',
            payload: {
              value: String(Math.round(usage.online_storage_gb)),
              stripe_customer_id: customerId,
            },
            timestamp: Math.floor(new Date(reportDate).getTime() / 1000)
          });
        }

        // Report offline storage GB
        if (usage.offline_storage_gb > 0) {
          await stripe.billing.meterEvents.create({
            event_name: 'storage_offline_gb',
            payload: {
              value: String(Math.round(usage.offline_storage_gb)),
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

        // Successfully reported to Stripe

        results.successful++;
      } catch (error) {
        console.error(`Failed to sync usage for user ${usage.user_id}:`, error);
        results.failed++;
        results.errors.push(`User ${usage.users.email}: ${error instanceof Error ? error.message : String(error)}`);

        // Failed to report - error already logged
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