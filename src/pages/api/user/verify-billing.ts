import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    const email = session.user.email;
    const autoFix = req.method === 'POST';

    // Get user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isTeamMember = !!user.account_owner_id;
    const billingStatus = {
      isTeamMember,
      hasBillingMode: !!user.billing_mode,
      billingMode: user.billing_mode,
      hasStripeCustomer: !!user.stripe_customer_id,
      stripeCustomerId: user.stripe_customer_id,
      hasSubscription: !!user.stripe_subscription_id,
      subscriptionId: user.stripe_subscription_id,
      subscriptionStatus: user.stripe_subscription_status,
      isPrepaid: user.billing_mode === 'prepaid',
      isPostpaid: user.billing_mode === 'postpaid',
      billingEnabled: false,
      issues: [] as string[],
      fixes: [] as string[]
    };

    // Determine if billing is properly enabled
    if (isTeamMember) {
      // Team members inherit billing from account owner
      billingStatus.billingEnabled = true;
      
      // Check if account owner has billing set up
      const { data: owner } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id, billing_mode')
        .eq('id', user.account_owner_id)
        .single();
      
      if (owner) {
        if (!owner.stripe_customer_id && owner.billing_mode !== 'prepaid') {
          billingStatus.issues.push('Account owner does not have billing set up');
        }
      }
    } else {
      // Account owners need their own billing
      if (user.billing_mode === 'prepaid') {
        billingStatus.billingEnabled = true;
      } else if (user.stripe_customer_id) {
        billingStatus.billingEnabled = true;
        
        // For postpaid, check subscription
        if (user.billing_mode === 'postpaid' && !user.stripe_subscription_id) {
          billingStatus.issues.push('Postpaid user missing subscription ID in database');
          
          if (autoFix && user.stripe_customer_id) {
            try {
              // FIRST: Check if subscription already exists in Stripe
              const existingSubscriptions = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                limit: 10,
                status: 'all'
              });
              
              // Find active or trialing subscription
              const activeSubscription = existingSubscriptions.data.find(
                sub => sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
              );
              
              if (activeSubscription) {
                // Subscription exists in Stripe but not in our DB - sync it
                await supabaseAdmin
                  .from('users')
                  .update({
                    stripe_subscription_id: activeSubscription.id,
                    stripe_subscription_status: activeSubscription.status
                  })
                  .eq('id', userId);
                
                billingStatus.fixes.push(`Synced existing subscription ${activeSubscription.id} from Stripe`);
                billingStatus.hasSubscription = true;
                billingStatus.subscriptionId = activeSubscription.id;
                billingStatus.subscriptionStatus = activeSubscription.status;
              } else {
                // No active subscription - DO NOT auto-create
                billingStatus.issues.push('No active subscription found in Stripe - manual setup required');
                // Removed auto-creation logic - subscriptions should be created intentionally
              }
            } catch (error) {
              billingStatus.issues.push(`Failed to check/sync subscription: ${error}`);
            }
          }
        }
      } else {
        // No billing set up
        billingStatus.issues.push('No billing method configured');
        
        if (!user.billing_mode) {
          billingStatus.issues.push('Billing mode not set');
          
          if (autoFix) {
            // Default to postpaid for regular users
            await supabaseAdmin
              .from('users')
              .update({ billing_mode: 'postpaid' })
              .eq('id', userId);
            
            billingStatus.fixes.push('Set billing mode to postpaid');
            billingStatus.billingMode = 'postpaid';
          }
        }
        
        if (!user.stripe_customer_id && user.billing_mode !== 'prepaid') {
          billingStatus.issues.push('No Stripe customer ID');
          
          if (autoFix) {
            try {
              const stripeCustomer = await stripe.customers.create({
                email,
                name: user.name || email,
                metadata: {
                  user_id: userId,
                  auth0_id: userId
                }
              });
              
              await supabaseAdmin
                .from('users')
                .update({ stripe_customer_id: stripeCustomer.id })
                .eq('id', userId);
              
              billingStatus.fixes.push(`Created Stripe customer ${stripeCustomer.id}`);
              billingStatus.hasStripeCustomer = true;
              billingStatus.stripeCustomerId = stripeCustomer.id;
              billingStatus.billingEnabled = true;
            } catch (error) {
              billingStatus.issues.push(`Failed to create Stripe customer: ${error}`);
            }
          }
        }
      }
    }

    // Check cluster assignment status
    const { data: assignment } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    const clusterStatus = {
      hasAssignment: !!assignment,
      clusterId: assignment?.hopsworks_cluster_id,
      hopsworksUserId: assignment?.hopsworks_user_id,
      hopsworksUsername: assignment?.hopsworks_username,
      shouldHaveCluster: isTeamMember || billingStatus.billingEnabled
    };

    if (clusterStatus.shouldHaveCluster && !clusterStatus.hasAssignment) {
      billingStatus.issues.push('User should have cluster assignment but does not');
    }

    return res.status(200).json({
      userId,
      email,
      billingStatus,
      clusterStatus,
      autoFixApplied: autoFix && billingStatus.fixes.length > 0
    });
  } catch (error) {
    console.error('Error verifying billing:', error);
    return res.status(500).json({ 
      error: 'Failed to verify billing status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}