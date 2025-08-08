import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil'
});

// This runs daily to report usage to Stripe for postpaid customers
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];

    // Get all postpaid users with usage from yesterday
    const { data: usageRecords, error } = await supabaseAdmin
      .from('usage_daily')
      .select(`
        *,
        users!inner(
          id,
          email,
          billing_mode,
          stripe_customer_id,
          stripe_subscription_id
        )
      `)
      .eq('date', reportDate)
      .eq('users.billing_mode', 'postpaid')
      .not('users.stripe_subscription_id', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch usage records: ${error.message}`);
    }

    const results = {
      reported: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const usage of usageRecords || []) {
      try {
        const user = usage.users;
        
        if (!user.stripe_subscription_id) {
          console.log(`Skipping user ${user.email} - no subscription`);
          continue;
        }

        // Get subscription items
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        
        // Report each usage type
        for (const item of subscription.items.data) {
          const productId = item.price.product as string;
          
          // Map product to usage type and report
          let quantity = 0;
          let unitAmount = 100; // Default to cents precision
          
          if (productId.includes('cpu')) {
            quantity = Math.round(usage.opencost_cpu_hours * unitAmount);
          } else if (productId.includes('gpu')) {
            quantity = Math.round(usage.opencost_gpu_hours * unitAmount);
          } else if (productId.includes('ram') || productId.includes('memory')) {
            quantity = Math.round(usage.opencost_ram_gb_hours * unitAmount);
          } else if (productId.includes('storage_online')) {
            quantity = Math.round(usage.online_storage_gb * unitAmount);
          } else if (productId.includes('storage_offline')) {
            quantity = Math.round(usage.offline_storage_gb * unitAmount);
          } else if (productId.includes('network')) {
            quantity = Math.round(usage.network_egress_gb * unitAmount);
          }
          
          if (quantity > 0) {
            await stripe.billing.meterEvents.create({
              event_name: `usage_${productId}`,
              payload: {
                value: String(quantity),
                stripe_customer_id: user.stripe_customer_id
              },
              timestamp: Math.floor(new Date(reportDate).getTime() / 1000)
            });
          }
        }

        // Mark as reported
        await supabaseAdmin
          .from('usage_daily')
          .update({ reported_to_stripe: true })
          .eq('id', usage.id);

        results.reported++;
      } catch (error) {
        console.error(`Failed to report usage for user ${usage.users.email}:`, error);
        results.failed++;
        results.errors.push(`${usage.users.email}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`Usage reporting completed: ${results.reported} reported, ${results.failed} failed`);

    return res.status(200).json({
      message: 'Usage reporting completed',
      date: reportDate,
      results
    });
  } catch (error) {
    console.error('Usage reporting error:', error);
    return res.status(500).json({ 
      error: 'Failed to report usage',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}