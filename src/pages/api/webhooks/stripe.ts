import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { assignUserToCluster } from '../../../lib/cluster-assignment';

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
        
        // Handle credit purchase
        if (session.metadata?.credit_amount) {
          await handleCreditPurchase(session);
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

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleCreditPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const creditAmount = parseFloat(session.metadata!.credit_amount);
  
  console.log(`Processing credit purchase: $${creditAmount} for user ${userId}`);

  // Get current balance
  const { data: currentCredits } = await supabaseAdmin
    .from('user_credits')
    .select('total_purchased')
    .eq('user_id', userId)
    .single();

  const balanceBefore = currentCredits?.total_purchased || 0;
  const balanceAfter = balanceBefore + creditAmount;

  // Update user credits
  await supabaseAdmin
    .from('user_credits')
    .upsert({
      user_id: userId,
      total_purchased: balanceAfter,
      last_purchase_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  // Record transaction
  await supabaseAdmin
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'purchase',
      amount: creditAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `Credit purchase via Stripe`,
      stripe_payment_intent_id: session.payment_intent as string
    });

  // Update billing history
  await supabaseAdmin
    .from('billing_history')
    .insert({
      user_id: userId,
      invoice_id: session.id,
      amount: creditAmount,
      status: 'paid',
      description: `${creditAmount} credits purchased`,
      stripe_payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString()
    });

  console.log(`Successfully added $${creditAmount} credits for user ${userId}`);
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
    // Assign cluster now that payment is set up
    const { success, error } = await assignUserToCluster(supabaseAdmin, user.id);
    if (success) {
      console.log(`Assigned cluster to user ${user.id} after subscription creation`);
    } else {
      console.error(`Failed to assign cluster: ${error}`);
    }

    await supabaseAdmin
      .from('users')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status
      })
      .eq('id', user.id);
    
    console.log(`Subscription created for user ${user.id}`);
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
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    await supabaseAdmin
      .from('users')
      .update({
        stripe_subscription_status: 'canceled',
        status: 'suspended'
      })
      .eq('id', user.id);
    
    console.log(`Subscription canceled for user ${user.id}`);
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