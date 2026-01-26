/**
 * Marketing/CRM webhook utilities
 *
 * Endpoints (Windmill):
 * - POST /on_user_registered: Lead capture (immediate on signup)
 * - POST /on_user_activated: User accepted terms, chose plan and marketing consent
 * - POST /on_plan_updated: billing_mode changed
 * - POST /on_marketing_updated: marketing_consent changed
 *
 * Base URL: WINDMILL_WEBHOOK_BASE_URL (e.g., https://auto.hops.io/api/w/hopsworks/jobs/run/f/f/saas)
 */

// Endpoint paths for each event type
const WEBHOOK_ENDPOINTS = {
  'user.registered': '/on_user_registered',
  'user.activated': '/on_user_activated',
  'plan.updated': '/on_plan_updated',
  'marketing.updated': '/on_marketing_updated'
} as const;

type WebhookEvent = keyof typeof WEBHOOK_ENDPOINTS;

interface BasePayload {
  event: WebhookEvent;
  userId: string;
  email: string;
  timestamp: string;
}

interface UserRegisteredPayload extends BasePayload {
  event: 'user.registered';
  name: string | null;
  source: string;
  ip: string | null;
}

interface UserActivatedPayload extends BasePayload {
  event: 'user.activated';
  plan: string;
  marketingConsent: boolean;
}

interface PlanUpdatedPayload extends BasePayload {
  event: 'plan.updated';
  oldPlan: string | null;
  newPlan: string;
  trigger: 'registration' | 'user_choice' | 'admin' | 'payment_setup';
}

interface MarketingUpdatedPayload extends BasePayload {
  event: 'marketing.updated';
  oldConsent: boolean | null;
  newConsent: boolean;
}

type WebhookPayload = UserRegisteredPayload | UserActivatedPayload | PlanUpdatedPayload | MarketingUpdatedPayload;

async function sendWebhook(payload: WebhookPayload): Promise<void> {
  // Support both old single-endpoint and new multi-endpoint configs
  const baseUrl = process.env.WINDMILL_WEBHOOK_BASE_URL || process.env.WINDMILL_WEBHOOK_URL;

  if (!baseUrl) {
    console.log(`[Marketing] Webhook skipped (no URL configured): ${payload.event}`);
    return;
  }

  // If using base URL, append the endpoint path; otherwise use single URL for all
  const endpoint = WEBHOOK_ENDPOINTS[payload.event];
  const url = process.env.WINDMILL_WEBHOOK_BASE_URL
    ? `${baseUrl}${endpoint}`
    : baseUrl;

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
      console.log(`[Marketing] Webhook sent: ${payload.event} for ${payload.email}`);
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
  await sendWebhook({
    event: 'user.registered',
    userId: params.userId,
    email: params.email,
    name: params.name,
    source: params.source,
    ip: params.ip,
    timestamp: new Date().toISOString()
  });
}

export async function sendUserActivated(params: {
  userId: string;
  email: string;
  plan: string;
  marketingConsent: boolean;
}): Promise<void> {
  await sendWebhook({
    event: 'user.activated',
    userId: params.userId,
    email: params.email,
    plan: params.plan,
    marketingConsent: params.marketingConsent,
    timestamp: new Date().toISOString()
  });
}

export async function sendPlanUpdated(params: {
  userId: string;
  email: string;
  oldPlan: string | null;
  newPlan: string;
  trigger: 'registration' | 'user_choice' | 'admin' | 'payment_setup';
}): Promise<void> {
  await sendWebhook({
    event: 'plan.updated',
    userId: params.userId,
    email: params.email,
    oldPlan: params.oldPlan,
    newPlan: params.newPlan,
    trigger: params.trigger,
    timestamp: new Date().toISOString()
  });
}

export async function sendMarketingUpdated(params: {
  userId: string;
  email: string;
  oldConsent: boolean | null;
  newConsent: boolean;
}): Promise<void> {
  await sendWebhook({
    event: 'marketing.updated',
    userId: params.userId,
    email: params.email,
    oldConsent: params.oldConsent,
    newConsent: params.newConsent,
    timestamp: new Date().toISOString()
  });
}
