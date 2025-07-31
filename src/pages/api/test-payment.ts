import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Import Stripe dynamically
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-06-30.basil'
    });

    const customerId = 'cus_SmV3XHmukok3Dl';
    
    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return res.status(200).json({
      success: true,
      customerId,
      paymentMethodsCount: paymentMethods.data.length,
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        last4: pm.card?.last4
      })),
      hasPaymentMethod: paymentMethods.data.length > 0
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed to check payment', 
      details: error.message 
    });
  }
}