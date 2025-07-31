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
    const { amount } = req.body;

    // Validate amount
    const validAmounts = [25, 50, 100, 500];
    if (!validAmounts.includes(amount)) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    // Check if user has prepaid enabled
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, stripe_customer_id, billing_mode, feature_flags, account_owner_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Team members cannot purchase credits
    if (user.account_owner_id) {
      return res.status(403).json({ error: 'Team members cannot purchase credits. Contact your account owner.' });
    }

    // Check feature flag
    if (!user.feature_flags?.prepaid_enabled) {
      return res.status(403).json({ 
        error: 'Prepaid credits not enabled for your account. Please contact support.' 
      });
    }

    // Ensure user has a Stripe customer ID
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

    // Create Stripe checkout session for credit purchase
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Hopsworks Credits`,
              description: `$${amount} in compute credits`
            },
            unit_amount: amount * 100 // Convert to cents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.AUTH0_BASE_URL}/dashboard?credits=purchased`,
      cancel_url: `${process.env.AUTH0_BASE_URL}/dashboard?credits=cancelled`,
      metadata: {
        user_id: userId,
        credit_amount: amount.toString()
      }
    });

    return res.status(200).json({ 
      checkoutUrl: checkoutSession.url 
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session' 
    });
  }
}