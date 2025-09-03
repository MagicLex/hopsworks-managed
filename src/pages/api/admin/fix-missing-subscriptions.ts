import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { assignUserToCluster } from '../../../lib/cluster-assignment';

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil'
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Admin check
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', session.user.sub)
      .single();

    if (!currentUser?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find users with stripe_customer_id but no subscription
    const { data: usersNeedingFix } = await supabaseAdmin
      .from('users')
      .select('*')
      .not('stripe_customer_id', 'is', null)
      .is('stripe_subscription_id', null)
      .eq('billing_mode', 'postpaid')
      .is('account_owner_id', null); // Only account owners

    if (!usersNeedingFix || usersNeedingFix.length === 0) {
      return res.status(200).json({ message: 'No users need fixing', fixed: [] });
    }

    const results = {
      fixed: [] as string[],
      failed: [] as { email: string; error: string }[]
    };

    // Get stripe products for subscription creation
    const { data: stripeProducts } = await supabaseAdmin
      .from('stripe_products')
      .select('*')
      .eq('active', true);

    if (!stripeProducts || stripeProducts.length === 0) {
      return res.status(500).json({ error: 'No active Stripe products configured' });
    }

    for (const user of usersNeedingFix) {
      try {
        console.log(`Processing user ${user.email}...`);

        // Check if subscription already exists in Stripe
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          limit: 10,
          status: 'all'
        });

        let subscription = existingSubscriptions.data.find(
          sub => sub.status === 'active' || sub.status === 'trialing'
        );

        if (subscription) {
          // Subscription exists in Stripe, just sync to DB
          console.log(`Found existing subscription ${subscription.id} for ${user.email}`);
        } else {
          // Create new subscription
          console.log(`Creating subscription for ${user.email}...`);
          subscription = await stripe.subscriptions.create({
            customer: user.stripe_customer_id,
            items: stripeProducts.map(product => ({
              price: product.stripe_price_id
            })),
            metadata: {
              user_id: user.id,
              email: user.email
            }
          });
          console.log(`Created subscription ${subscription.id} for ${user.email}`);
        }

        // Update user with subscription ID
        await supabaseAdmin
          .from('users')
          .update({
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: subscription.status
          })
          .eq('id', user.id);

        // Check if user needs cluster assignment
        const { data: assignment } = await supabaseAdmin
          .from('user_hopsworks_assignments')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!assignment) {
          // Assign cluster
          const { success, error } = await assignUserToCluster(supabaseAdmin, user.id, true);
          if (success) {
            console.log(`Assigned cluster to user ${user.email}`);
          } else {
            console.error(`Failed to assign cluster to ${user.email}: ${error}`);
          }
        }

        results.fixed.push(user.email);
      } catch (error: any) {
        console.error(`Failed to fix user ${user.email}:`, error);
        results.failed.push({
          email: user.email,
          error: error.message || 'Unknown error'
        });
      }
    }

    return res.status(200).json({
      message: `Fixed ${results.fixed.length} users, ${results.failed.length} failed`,
      results
    });
  } catch (error: any) {
    console.error('Error in fix-missing-subscriptions:', error);
    return res.status(500).json({ 
      error: 'Failed to fix subscriptions',
      details: error.message 
    });
  }
}