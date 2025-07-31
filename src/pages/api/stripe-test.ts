import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
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

    // Get all payment methods
    const allPaymentMethods = await stripe.paymentMethods.list({
      customer: customerId
    });

    // Get customer
    const customer = await stripe.customers.retrieve(customerId);

    // Get setup intents
    const setupIntents = await stripe.setupIntents.list({
      customer: customerId,
      limit: 1
    });

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      customerId,
      cardPaymentMethods: paymentMethods.data.length,
      allPaymentMethods: allPaymentMethods.data.length,
      hasDefaultPaymentMethod: !!(customer as any).invoice_settings?.default_payment_method,
      defaultPaymentMethod: (customer as any).invoice_settings?.default_payment_method,
      hasSuccessfulSetup: setupIntents.data.some(si => si.status === 'succeeded'),
      setupIntents: setupIntents.data.map(si => ({
        id: si.id,
        status: si.status,
        payment_method: si.payment_method
      })),
      conclusion: {
        hasPaymentMethod: paymentMethods.data.length > 0 || 
                         allPaymentMethods.data.length > 0 || 
                         !!(customer as any).invoice_settings?.default_payment_method || 
                         setupIntents.data.some(si => si.status === 'succeeded')
      }
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}