import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { createStripeClient, getStripeConfig } from '../../../lib/stripe-config';

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

  // Always use test mode for this endpoint
  const stripe = createStripeClient(true);
  const config = getStripeConfig(true);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      config.webhookSecret
    );
  } catch (err) {
    console.error('Test webhook signature verification failed:', err instanceof Error ? err.message : String(err));
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`[TEST MODE] Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Handle credit purchase in test mode
        if (session.metadata?.credit_amount) {
          await handleTestCreditPurchase(session);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Log test subscription events
        console.log('[TEST MODE] Subscription event:', event.type, event.data.object);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Log test invoice events
        console.log('[TEST MODE] Invoice payment succeeded:', event.data.object);
        break;
      }

      default:
        console.log(`[TEST MODE] Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true, testMode: true });
  } catch (error) {
    console.error('[TEST MODE] Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleTestCreditPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const creditAmount = parseFloat(session.metadata?.credit_amount || '0');

  if (!userId || !creditAmount) {
    console.error('[TEST MODE] Missing user_id or credit_amount in session metadata');
    return;
  }

  console.log(`[TEST MODE] Processing credit purchase: ${creditAmount} credits for user ${userId}`);

  // Store test transaction in a separate table or with a test flag
  const { data: currentCredits } = await supabaseAdmin
    .from('user_credits')
    .select('total_purchased, total_free')
    .eq('user_id', userId)
    .single();

  if (currentCredits) {
    // Update existing credits (marked as test)
    await supabaseAdmin
      .from('user_credits')
      .update({
        total_purchased: (currentCredits.total_purchased || 0) + creditAmount,
        last_updated: new Date().toISOString(),
        metadata: {
          ...((currentCredits as any).metadata || {}),
          lastTestPurchase: {
            amount: creditAmount,
            sessionId: session.id,
            timestamp: new Date().toISOString()
          }
        }
      })
      .eq('user_id', userId);
  } else {
    // Create new credit record (marked as test)
    await supabaseAdmin
      .from('user_credits')
      .insert({
        user_id: userId,
        total_purchased: creditAmount,
        total_free: 0,
        total_used: 0,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        metadata: {
          isTestData: true,
          firstTestPurchase: {
            amount: creditAmount,
            sessionId: session.id,
            timestamp: new Date().toISOString()
          }
        }
      });
  }

  console.log(`[TEST MODE] Successfully added ${creditAmount} test credits to user ${userId}`);
}