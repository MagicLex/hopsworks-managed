import Stripe from 'stripe';

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  priceIds: {
    credit: string;
    cpuHour: string;
    gpuHour: string;
    storageGbMonth: string;
    apiCalls: string;
  };
}

export function getStripeConfig(isTestMode: boolean = false): StripeConfig {
  if (isTestMode) {
    return {
      secretKey: process.env.STRIPE_TEST_SECRET_KEY!,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET!,
      priceIds: {
        credit: process.env.STRIPE_TEST_PRICE_ID_CREDIT!,
        cpuHour: process.env.STRIPE_TEST_PRICE_ID_CPU_HOUR!,
        gpuHour: process.env.STRIPE_TEST_PRICE_ID_GPU_HOUR!,
        storageGbMonth: process.env.STRIPE_TEST_PRICE_ID_STORAGE_GB_MONTH!,
        apiCalls: process.env.STRIPE_TEST_PRICE_ID_API_CALLS!,
      }
    };
  }

  return {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    priceIds: {
      credit: process.env.STRIPE_PRICE_ID_CREDIT!,
      cpuHour: process.env.STRIPE_PRICE_ID_CPU_HOUR!,
      gpuHour: process.env.STRIPE_PRICE_ID_GPU_HOUR!,
      storageGbMonth: process.env.STRIPE_PRICE_ID_STORAGE_GB_MONTH!,
      apiCalls: process.env.STRIPE_PRICE_ID_API_CALLS!,
    }
  };
}

export function createStripeClient(isTestMode: boolean = false): Stripe {
  const config = getStripeConfig(isTestMode);
  
  // Validate the secret key
  if (!config.secretKey || config.secretKey.includes('\n') || config.secretKey.includes('\r')) {
    throw new Error(`Invalid Stripe ${isTestMode ? 'test' : 'live'} secret key format`);
  }
  
  return new Stripe(config.secretKey, {
    apiVersion: '2025-06-30.basil'
  });
}

// Check if current request is from admin in test mode
export function isAdminTestMode(isAdmin: boolean, testModeParam?: string | boolean): boolean {
  return isAdmin && (testModeParam === 'true' || testModeParam === true);
}