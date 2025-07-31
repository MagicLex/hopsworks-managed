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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;

    // Get user info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id) {
      return res.status(200).json({ 
        hasCustomer: false,
        message: 'No Stripe customer ID found' 
      });
    }

    // Debug all payment method checks
    const debugInfo: any = {
      customerId: user.stripe_customer_id,
      checks: {}
    };

    // 1. List payment methods (cards)
    const cardPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card'
    });
    debugInfo.checks.cardPaymentMethods = {
      count: cardPaymentMethods.data.length,
      ids: cardPaymentMethods.data.map(pm => pm.id)
    };

    // 2. List all payment methods
    const allPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id
    });
    debugInfo.checks.allPaymentMethods = {
      count: allPaymentMethods.data.length,
      methods: allPaymentMethods.data.map(pm => ({ id: pm.id, type: pm.type }))
    };

    // 3. Get customer details
    const customer = await stripe.customers.retrieve(user.stripe_customer_id);
    debugInfo.checks.customer = {
      defaultSource: (customer as any).default_source,
      defaultPaymentMethod: (customer as any).invoice_settings?.default_payment_method
    };

    // 4. Check setup intents
    const setupIntents = await stripe.setupIntents.list({
      customer: user.stripe_customer_id,
      limit: 5
    });
    debugInfo.checks.setupIntents = {
      count: setupIntents.data.length,
      intents: setupIntents.data.map(si => ({
        id: si.id,
        status: si.status,
        payment_method: si.payment_method,
        created: new Date((si as any).created * 1000).toISOString()
      }))
    };

    // 5. Check checkout sessions
    const checkoutSessions = await stripe.checkout.sessions.list({
      customer: user.stripe_customer_id,
      limit: 5
    });
    debugInfo.checks.checkoutSessions = {
      count: checkoutSessions.data.length,
      sessions: checkoutSessions.data.map(cs => ({
        id: cs.id,
        mode: cs.mode,
        status: cs.status,
        payment_status: cs.payment_status
      }))
    };

    // Summary
    debugInfo.summary = {
      hasPaymentMethod: cardPaymentMethods.data.length > 0 || 
                       allPaymentMethods.data.length > 0 ||
                       !!(customer as any).default_source ||
                       !!(customer as any).invoice_settings?.default_payment_method ||
                       setupIntents.data.some(si => si.status === 'succeeded')
    };

    return res.status(200).json(debugInfo);
  } catch (error) {
    console.error('Error in payment check:', error);
    return res.status(500).json({ 
      error: 'Failed to check payment methods',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}