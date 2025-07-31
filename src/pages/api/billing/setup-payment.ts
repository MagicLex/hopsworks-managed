import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;

    // Get user info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, stripe_customer_id, billing_mode, stripe_subscription_id, account_owner_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Team members cannot set up billing
    if (user.account_owner_id) {
      return res.status(403).json({ error: 'Team members cannot manage billing' });
    }

    // Check if already has payment method
    if (user.stripe_subscription_id) {
      // Create billing portal session to manage existing subscription
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id!,
        return_url: `${process.env.AUTH0_BASE_URL}/dashboard?tab=billing`,
      });
      
      return res.status(200).json({ portalUrl: portalSession.url });
    }

    // Create customer if needed
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: userId
        }
      });
      
      stripeCustomerId = customer.id;
      
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);
    }

    // For postpaid users - create checkout session to add payment method and start subscription
    if (user.billing_mode === 'postpaid') {
      // Get the subscription product price IDs from database
      const { data: stripeProducts } = await supabaseAdmin
        .from('stripe_products')
        .select('*')
        .eq('active', true);

      if (!stripeProducts || stripeProducts.length === 0) {
        return res.status(500).json({ error: 'No active billing products configured' });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: stripeProducts
          .filter(product => product.unit !== 'one_time')
          .map(product => ({
            price: product.stripe_price_id
          })),
        subscription_data: {
          metadata: {
            user_id: userId
          }
        },
        success_url: `${process.env.AUTH0_BASE_URL}/dashboard?payment=success&tab=billing`,
        cancel_url: `${process.env.AUTH0_BASE_URL}/dashboard?payment=cancelled&tab=billing`,
      });

      return res.status(200).json({ checkoutUrl: checkoutSession.url });
    }

    // For prepaid users - just add payment method via setup session
    const setupSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'setup',
      success_url: `${process.env.AUTH0_BASE_URL}/dashboard?payment=success&tab=billing`,
      cancel_url: `${process.env.AUTH0_BASE_URL}/dashboard?payment=cancelled&tab=billing`,
    });

    return res.status(200).json({ checkoutUrl: setupSession.url });

  } catch (error) {
    console.error('Error setting up payment:', error);
    return res.status(500).json({ 
      error: 'Failed to set up payment method' 
    });
  }
}