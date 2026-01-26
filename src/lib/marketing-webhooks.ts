/**
 * Marketing/CRM webhook utilities
 *
 * Endpoints (Windmill):
 * - POST /on_user_registered: Lead capture (immediate on signup)
 * - POST /on_user_activated: User accepted terms, chose plan and marketing consent
 * - POST /on_plan_updated: billing_mode changed
 * - POST /on_marketing_updated: marketing_consent changed
 *
 * Base URL: WINDMILL_WEBHOOK_BASE_URL
 * Must be: https://auto.hops.io/api/w/hopsworks/jobs/run_wait_result/f/f/saas
 * (Note: run_wait_result, not run)
 */

// Endpoint paths for each event type
type WebhookType = 'registered' | 'activated' | 'plan_updated' | 'marketing_updated';

const WEBHOOK_ENDPOINTS: Record<WebhookType, string> = {
  'registered': '/on_user_registered',
  'activated': '/on_user_activated',
  'plan_updated': '/on_plan_updated',
  'marketing_updated': '/on_marketing_updated'
};

interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string | null;
  source: string;
  ip: string | null;
  timestamp: string;
}

interface UserActivatedPayload {
  userId: string;
  email: string;
  plan: string;
  marketingConsent: boolean;
  timestamp: string;
}

interface PlanUpdatedPayload {
  userId: string;
  email: string;
  oldPlan: string | null;
  newPlan: string;
  trigger: string;
  timestamp: string;
}

interface MarketingUpdatedPayload {
  userId: string;
  email: string;
  oldConsent: boolean | null;
  newConsent: boolean;
  timestamp: string;
}

async function sendWebhook(type: WebhookType, payload: object, email: string): Promise<void> {
  const baseUrl = process.env.WINDMILL_WEBHOOK_BASE_URL;

  if (!baseUrl) {
    console.log(`[Marketing] Webhook skipped (no WINDMILL_WEBHOOK_BASE_URL): ${type}`);
    return;
  }

  const url = `${baseUrl}${WEBHOOK_ENDPOINTS[type]}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WINDMILL_API_TOKEN && {
          'Authorization': `Bearer ${process.env.WINDMILL_API_TOKEN}`
        })
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[Marketing] Webhook failed: ${response.status} ${response.statusText} for ${url}`);
    } else {
      console.log(`[Marketing] Webhook sent: ${type} for ${email}`);
    }
  } catch (err) {
    console.error(`[Marketing] Webhook error:`, err instanceof Error ? err.message : err);
  }
}

export async function sendUserRegistered(params: {
  userId: string;
  email: string;
  name: string | null;
  source: string;
  ip: string | null;
}): Promise<void> {
  const payload: UserRegisteredPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name,
    source: params.source,
    ip: params.ip,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('registered', payload, params.email);
}

export async function sendUserActivated(params: {
  userId: string;
  email: string;
  plan: string;
  marketingConsent: boolean;
}): Promise<void> {
  const payload: UserActivatedPayload = {
    userId: params.userId,
    email: params.email,
    plan: params.plan,
    marketingConsent: params.marketingConsent,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('activated', payload, params.email);
}

export async function sendPlanUpdated(params: {
  userId: string;
  email: string;
  oldPlan: string | null;
  newPlan: string;
  trigger: string;
}): Promise<void> {
  const payload: PlanUpdatedPayload = {
    userId: params.userId,
    email: params.email,
    oldPlan: params.oldPlan,
    newPlan: params.newPlan,
    trigger: params.trigger,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('plan_updated', payload, params.email);
}

export async function sendMarketingUpdated(params: {
  userId: string;
  email: string;
  oldConsent: boolean | null;
  newConsent: boolean;
}): Promise<void> {
  const payload: MarketingUpdatedPayload = {
    userId: params.userId,
    email: params.email,
    oldConsent: params.oldConsent,
    newConsent: params.newConsent,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('marketing_updated', payload, params.email);
}
