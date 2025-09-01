import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Create Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil'
});

// Create Supabase admin client
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

import crypto from 'crypto';

function verifyWebhookSignature(req: NextApiRequest): boolean {
  // For Auth0 webhooks, we can use either HMAC verification or a shared secret
  // Using shared secret for simplicity in MVP, but HMAC is more secure
  const secret = req.headers['x-auth0-secret'];
  
  // In production, always verify the webhook secret
  if (process.env.NODE_ENV === 'production') {
    if (!secret || !process.env.AUTH0_WEBHOOK_SECRET) {
      return false;
    }
    return secret === process.env.AUTH0_WEBHOOK_SECRET;
  }
  
  // In development, allow if secret matches or if no secret is configured
  return !process.env.AUTH0_WEBHOOK_SECRET || secret === process.env.AUTH0_WEBHOOK_SECRET;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify webhook signature
  if (!verifyWebhookSignature(req)) {
    console.error('Auth0 webhook verification failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, email, name, ip, created_at, logins_count } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();

    if (!existingUser) {
      // Check if there's a pending team invite for this email
      const { data: invite } = await supabaseAdmin
        .from('team_invites')
        .select('*')
        .eq('email', email)
        .is('accepted_at', null)
        .gte('expires_at', new Date().toISOString())
        .single();

      let accountOwnerId = null;
      let stripeCustomerId = null;

      if (invite) {
        // This is a team member signup
        accountOwnerId = invite.account_owner_id;
        console.log(`Team member ${email} signing up under account ${accountOwnerId}`);
        
        // Mark invite as accepted
        await supabaseAdmin
          .from('team_invites')
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by_user_id: user_id
          })
          .eq('id', invite.id);
      } else {
        // This is a new account owner - create Stripe customer
        const stripeCustomer = await stripe.customers.create({
          email,
          name,
          metadata: {
            user_id,
            auth0_id: user_id
          }
        });
        stripeCustomerId = stripeCustomer.id;
      }

      // Create new user
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user_id,
          email,
          name,
          registration_ip: ip,
          created_at: created_at || new Date().toISOString(),
          login_count: logins_count || 0,
          status: 'active',
          account_owner_id: accountOwnerId, // NULL for account owners, set for team members
          stripe_customer_id: stripeCustomerId, // Only set for account owners
          billing_mode: accountOwnerId ? null : 'postpaid' // Only account owners have billing mode
        });

      if (userError) throw userError;

      // Only create user credits record for account owners
      if (!accountOwnerId) {
        const { error: creditsError } = await supabaseAdmin
          .from('user_credits')
          .insert({
            user_id
          });

        if (creditsError) throw creditsError;

        // Create Stripe subscription for postpaid account owners
        if (stripeCustomerId) {
          try {
            // Get the subscription product price IDs from database
            const { data: stripeProducts } = await supabaseAdmin
              .from('stripe_products')
              .select('*')
              .eq('active', true);

            if (stripeProducts && stripeProducts.length > 0) {
              // Create subscription with metered prices
              const subscription = await stripe.subscriptions.create({
                customer: stripeCustomerId,
                items: stripeProducts.map(product => ({
                  price: product.stripe_price_id
                })),
                metadata: {
                  user_id
                }
              });

              // Update user with subscription ID
              await supabaseAdmin
                .from('users')
                .update({
                  stripe_subscription_id: subscription.id,
                  stripe_subscription_status: subscription.status
                })
                .eq('id', user_id);
            }
          } catch (stripeError) {
            console.error('Failed to create Stripe subscription:', stripeError);
            // Don't fail user creation if Stripe fails
          }
        }
      }

      // Do NOT auto-assign cluster - user needs to set up payment first
      console.log(`New user ${email} created. Cluster assignment pending payment setup.`);
      
      // Hopsworks user will be created after payment is set up and cluster is assigned
    } else {
      // Update existing user
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: logins_count || 0
        })
        .eq('id', user_id);

      if (updateError) throw updateError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Auth0 webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}