import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createHopsworksOAuthUser, createHopsworksProject } from '../../../lib/hopsworks-api';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify webhook secret
  const secret = req.headers['x-auth0-secret'];
  if (secret !== process.env.AUTH0_WEBHOOK_SECRET) {
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
      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email,
        name,
        metadata: {
          user_id,
          auth0_id: user_id
        }
      });

      // Create new user with Stripe info
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
          stripe_customer_id: stripeCustomer.id,
          billing_mode: 'postpaid' // Default to postpaid
        });

      if (userError) throw userError;

      // Create user credits record
      const { error: creditsError } = await supabaseAdmin
        .from('user_credits')
        .insert({
          user_id
        });

      if (creditsError) throw creditsError;

      // Create Stripe subscription for postpaid users
      try {
        // Get the subscription product price IDs from database
        const { data: stripeProducts } = await supabaseAdmin
          .from('stripe_products')
          .select('*')
          .eq('active', true);

        if (stripeProducts && stripeProducts.length > 0) {
          // Create subscription with metered prices
          const subscription = await stripe.subscriptions.create({
            customer: stripeCustomer.id,
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

      // Assign user to a Hopsworks cluster
      let availableCluster = null;
      try {
        // Find available cluster with capacity
        const { data: cluster } = await supabaseAdmin
          .from('hopsworks_clusters')
          .select('*')
          .eq('status', 'active')
          .order('current_users', { ascending: true })
          .limit(1)
          .single();

        if (cluster && cluster.current_users < cluster.max_users) {
          availableCluster = cluster;
          
          // Assign user to cluster
          await supabaseAdmin
            .from('user_hopsworks_assignments')
            .insert({
              user_id,
              hopsworks_cluster_id: availableCluster.id
            });

          // Increment cluster user count
          await supabaseAdmin.rpc('increment_cluster_users', {
            p_cluster_id: availableCluster.id
          });

          console.log(`Assigned user ${email} to cluster ${availableCluster.name}`);
        } else {
          console.warn(`No available clusters for user ${email}`);
        }
      } catch (clusterError) {
        console.error('Failed to assign cluster:', clusterError);
        // Don't fail user creation if cluster assignment fails
      }

      // Create Hopsworks user and project
      if (availableCluster) {
        try {
          const credentials = {
            apiUrl: availableCluster.api_url,
            apiKey: availableCluster.api_key
          };

          // Create OAuth user in Hopsworks
          const hopsworksUsername = await createHopsworksOAuthUser(
            credentials,
            email,
            name?.split(' ')[0] || 'User',
            name?.split(' ')[1] || '',
            user_id
          );

          // Store Hopsworks username
          await supabaseAdmin
            .from('users')
            .update({ 
              hopsworks_username: hopsworksUsername
            })
            .eq('id', user_id);

          // Update assignment with username
          await supabaseAdmin
            .from('user_hopsworks_assignments')
            .update({
              hopsworks_username: hopsworksUsername
            })
            .eq('user_id', user_id)
            .eq('hopsworks_cluster_id', availableCluster.id);

          // Create default project
          const projectName = `${email.split('@')[0]}-project`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          await createHopsworksProject(credentials, hopsworksUsername, projectName);

          console.log(`Created Hopsworks user ${hopsworksUsername} and project ${projectName}`);
        } catch (hopsworksError) {
          console.error('Failed to create Hopsworks user/project:', hopsworksError);
          // Don't fail Auth0 webhook
        }
      }
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