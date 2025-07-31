const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil'
});

async function testPaymentMethods() {
  const customerId = 'cus_SmV3XHmukok3Dl';
  
  try {
    // List payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    
    console.log(`Payment methods for ${customerId}:`, paymentMethods.data.length);
    console.log('Payment methods:', JSON.stringify(paymentMethods.data, null, 2));
    
    // Get customer details
    const customer = await stripe.customers.retrieve(customerId);
    console.log('\nCustomer details:', {
      id: customer.id,
      email: customer.email,
      default_source: customer.default_source,
      sources: customer.sources?.data?.length || 0
    });
    
    // Check for setup intents
    const setupIntents = await stripe.setupIntents.list({
      customer: customerId,
      limit: 5
    });
    console.log('\nSetup intents:', setupIntents.data.length);
    setupIntents.data.forEach(si => {
      console.log(`- ${si.id}: ${si.status}, payment_method: ${si.payment_method}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPaymentMethods();