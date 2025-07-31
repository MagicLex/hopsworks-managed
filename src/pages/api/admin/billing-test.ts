import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createStripeClient, getStripeConfig } from '../../../lib/stripe-config';
import { createClient } from '@supabase/supabase-js';

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // Validate test configuration
  if (!process.env.STRIPE_TEST_SECRET_KEY) {
    return res.status(500).json({ 
      error: 'Stripe test mode not configured. Please set STRIPE_TEST_SECRET_KEY environment variable.' 
    });
  }

  // Always use test mode for this endpoint
  const stripe = createStripeClient(true);
  const config = getStripeConfig(true);

  switch (method) {
    case 'GET':
      // Get test billing data
      try {
        const { userId } = req.query;
        
        if (!userId) {
          // Return test mode configuration
          return res.status(200).json({
            testMode: true,
            publishableKey: config.publishableKey,
            webhookEndpoint: '/api/webhooks/stripe-test',
            priceIds: config.priceIds,
            message: 'Test mode active - payments will not be charged'
          });
        }

        // Get user test billing data
        const { data: userCredits } = await supabaseAdmin
          .from('user_credits')
          .select('*')
          .eq('user_id', userId)
          .single();

        // Get test customer ID from metadata
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('metadata')
          .eq('id', userId)
          .single();

        const testCustomerId = userData?.metadata?.stripe_test_customer_id;
        let testSubscriptions = null;
        
        if (testCustomerId) {
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: testCustomerId,
              limit: 10
            });
            testSubscriptions = subscriptions.data;
          } catch (error) {
            console.log('No test subscriptions found');
          }
        }

        return res.status(200).json({
          testMode: true,
          credits: userCredits,
          subscriptions: testSubscriptions,
          stripeCustomerId: testCustomerId || null
        });
      } catch (error) {
        console.error('Error fetching test billing data:', error);
        return res.status(500).json({ error: 'Failed to fetch test billing data' });
      }

    case 'POST':
      // Create test checkout session
      try {
        const { userId, amount, type = 'credits' } = req.body;

        if (!userId) {
          return res.status(400).json({ error: 'User ID required' });
        }

        // Get user data
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('email, metadata')
          .eq('id', userId)
          .single();

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Get or create test customer (stored separately from live customer)
        let testCustomerId = user.metadata?.stripe_test_customer_id;
        
        if (!testCustomerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
              user_id: userId,
              test_mode: 'true'
            }
          });
          testCustomerId = customer.id;
          
          // Store test customer ID in metadata to keep it separate from live
          await supabaseAdmin
            .from('users')
            .update({ 
              metadata: {
                ...(user.metadata || {}),
                stripe_test_customer_id: testCustomerId
              }
            })
            .eq('id', userId);
        }

        if (type === 'credits') {
          // Create test credit purchase session
          const session = await stripe.checkout.sessions.create({
            customer: testCustomerId,
            payment_method_types: ['card'],
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: '[TEST] Hopsworks Credits',
                  description: `[TEST MODE] $${amount} in compute credits`
                },
                unit_amount: amount * 100
              },
              quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.AUTH0_BASE_URL}/admin47392?test=true&payment=success`,
            cancel_url: `${process.env.AUTH0_BASE_URL}/admin47392?test=true&payment=cancelled`,
            metadata: {
              user_id: userId,
              credit_amount: amount.toString(),
              test_mode: 'true'
            }
          });

          return res.status(200).json({ 
            checkoutUrl: session.url,
            sessionId: session.id,
            testMode: true
          });
        } else if (type === 'subscription') {
          // Create test subscription session with dynamic pricing
          const session = await stripe.checkout.sessions.create({
            customer: testCustomerId,
            payment_method_types: ['card'],
            line_items: [{
              price_data: {
                currency: 'usd',
                product: process.env.STRIPE_TEST_PRODUCT_ID || 'prod_SlNvLSeuNU2pUj',
                unit_amount: 1000, // $10/month for testing
                recurring: {
                  interval: 'month'
                }
              },
              quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.AUTH0_BASE_URL}/admin47392?test=true&subscription=success`,
            cancel_url: `${process.env.AUTH0_BASE_URL}/admin47392?test=true&subscription=cancelled`,
            metadata: {
              user_id: userId,
              test_mode: 'true'
            }
          });

          return res.status(200).json({ 
            checkoutUrl: session.url,
            sessionId: session.id,
            testMode: true
          });
        }

        return res.status(400).json({ error: 'Invalid type' });
      } catch (error) {
        console.error('Error creating test checkout:', error);
        return res.status(500).json({ error: 'Failed to create test checkout' });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
      return;
  }
}

export default function billingTestHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}