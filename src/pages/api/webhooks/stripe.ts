import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { assignUserToCluster } from '../../../lib/cluster-assignment';
import { suspendUser, reactivateUser } from '../../../lib/user-status';
import { handleApiError } from '../../../lib/error-handler';

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

// Disable body parsing, need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : String(err));
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        
        // Handle payment method setup
        if (session.mode === 'setup' && session.customer) {
          await handlePaymentMethodSetup(session);
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice paid:', invoice.id);
        break;
      }

      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        await handlePaymentMethodAttached(paymentMethod);
        break;
      }

      case 'payment_method.detached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        const previousAttributes = (event.data as any).previous_attributes;
        await handlePaymentMethodDetached(paymentMethod, previousAttributes);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return handleApiError(error, res, 'POST /api/webhooks/stripe');
  }
}

async function handlePaymentMethodSetup(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  console.log(`Payment method setup completed for customer ${customerId}`);

  // Get user by Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, billing_mode, stripe_subscription_id, status')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Reactivate suspended users when payment method is added
    if (user.status === 'suspended') {
      await reactivateUser(supabaseAdmin as any, user.id, 'payment_method_setup');
    }
    // For postpaid users (or null billing_mode), create subscription if not exists
    if ((!user.billing_mode || user.billing_mode === 'postpaid') && !user.stripe_subscription_id) {
      try {
        // Check Stripe directly for existing subscriptions (race condition guard)
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1
        });

        if (existingSubscriptions.data.length > 0) {
          // Already has subscription, just update our DB
          const existingSub = existingSubscriptions.data[0];
          await supabaseAdmin
            .from('users')
            .update({
              stripe_subscription_id: existingSub.id,
              stripe_subscription_status: existingSub.status
            })
            .eq('id', user.id);
          console.log(`User ${user.id} already has subscription ${existingSub.id}, synced to DB`);
        } else {
          // Get stripe products for metered billing
          const { data: stripeProducts } = await supabaseAdmin
            .from('stripe_products')
            .select('*')
            .eq('active', true);

          if (stripeProducts && stripeProducts.length > 0) {
            // Create subscription with metered prices
            const subscription = await stripe.subscriptions.create({
              customer: customerId,
              items: stripeProducts.map(product => ({
                price: product.stripe_price_id
              })),
              metadata: {
                user_id: user.id,
                email: user.email
              }
            });

            // Update user with subscription ID
            await supabaseAdmin
              .from('users')
              .update({
                stripe_subscription_id: subscription.id,
                stripe_subscription_status: subscription.status
              })
              .eq('id', user.id);

            console.log(`Created subscription ${subscription.id} for user ${user.id} after payment setup`);
          }
        }
      } catch (error) {
        console.error(`Failed to create subscription for user ${user.id}:`, error);
      }
    }
    
    // After payment and subscription setup, assign cluster
    const { data: assignment } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (!assignment) {
      // Pass true for isManualAssignment since payment is now verified
      const { success, error } = await assignUserToCluster(supabaseAdmin, user.id, true);
      if (success) {
        console.log(`Assigned cluster to user ${user.id} after payment method setup`);
      } else {
        console.error(`Failed to assign cluster to user ${user.id}: ${error}`);
      }
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Get user by Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // IMPORTANT: Update subscription ID FIRST so assignUserToCluster sees it
    // This ensures maxNumProjects is calculated correctly (5 for subscribers, 0 otherwise)
    await supabaseAdmin
      .from('users')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status
      })
      .eq('id', user.id);

    console.log(`Subscription created for user ${user.id}`);

    // Check if user already has cluster assignment
    const { data: assignment } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!assignment) {
      // Assign cluster now that payment is verified via subscription
      const { success, error } = await assignUserToCluster(supabaseAdmin, user.id, true);
      if (success) {
        console.log(`Assigned cluster to user ${user.id} after subscription creation`);
      } else {
        console.error(`Failed to assign cluster: ${error}`);
      }
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    await supabaseAdmin
      .from('users')
      .update({
        stripe_subscription_status: subscription.status
      })
      .eq('id', user.id);
    
    console.log(`Subscription updated for user ${user.id}: ${subscription.status}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Update subscription status in DB
    await supabaseAdmin
      .from('users')
      .update({ stripe_subscription_status: 'canceled' })
      .eq('id', user.id);

    // Suspend user account (includes Hopsworks deactivation)
    await suspendUser(supabaseAdmin as any, user.id, 'subscription_deleted');
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const customerId = paymentMethod.customer as string;

  if (!customerId) {
    console.log('Payment method attached but no customer');
    return;
  }

  console.log(`Payment method attached for customer ${customerId}`);

  // Get user by customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, billing_mode, stripe_subscription_id, status')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Reactivate suspended users when payment method is added
    if (user.status === 'suspended') {
      await reactivateUser(supabaseAdmin as any, user.id, 'payment_method_attached');
    }

    // NOTE: We do NOT create subscriptions here - that's done in handlePaymentMethodSetup
    // (checkout.session.completed) to avoid race conditions causing duplicate subscriptions.
    // This handler only syncs existing subscriptions if our DB is out of sync.
    if (!user.stripe_subscription_id) {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1
      });

      if (existingSubscriptions.data.length > 0) {
        const existingSub = existingSubscriptions.data[0];
        await supabaseAdmin
          .from('users')
          .update({
            stripe_subscription_id: existingSub.id,
            stripe_subscription_status: existingSub.status
          })
          .eq('id', user.id);
        console.log(`Synced existing subscription ${existingSub.id} to DB for user ${user.id}`);
      }
    }

    // Assign cluster if needed
    const { data: assignment } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!assignment) {
      const { success, error } = await assignUserToCluster(supabaseAdmin, user.id, true);
      if (success) {
        console.log(`Assigned cluster to user ${user.id} after payment method attached`);
      } else {
        console.error(`Failed to assign cluster to user ${user.id}: ${error}`);
      }
    }
  }
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod, previousAttributes?: any) {
  // Get customer ID from previous_attributes (current customer is null after detach)
  const customerId = previousAttributes?.customer;

  if (!customerId) {
    console.log('Payment method detached but no customer in previous_attributes');
    return;
  }

  console.log(`Payment method detached for customer ${customerId}`);

  // Get user by customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, billing_mode')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Only suspend postpaid users who lose their payment method
    if (user.billing_mode === 'postpaid' || !user.billing_mode) {
      // Check if customer has any other payment methods
      try {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          limit: 1
        });

        // If no payment methods left, suspend the account
        if (paymentMethods.data.length === 0) {
          await suspendUser(supabaseAdmin as any, user.id, 'payment_method_removed');
        } else {
          console.log(`User ${user.id} still has ${paymentMethods.data.length} payment method(s)`);
        }
      } catch (error) {
        console.error(`Failed to check remaining payment methods for user ${user.id}:`, error);
      }
    } else {
      console.log(`User ${user.id} is ${user.billing_mode} mode - not suspending`);
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    console.error(`Payment failed for user ${user.email} (${user.id})`);

    // Future enhancement: Send payment failure notification email
    // Future enhancement: Consider account suspension after multiple failures
  }
}