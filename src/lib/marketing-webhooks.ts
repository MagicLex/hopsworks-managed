/**
 * Marketing/CRM webhook utilities
 *
 * Endpoints (Windmill):
 * - POST /on_user_registered: Lead capture (immediate on signup)
 * - POST /on_user_activated: User accepted terms, chose plan and marketing consent
 * - POST /on_plan_updated: billing_mode changed
 * - POST /on_marketing_updated: marketing_consent changed
 * - POST /on_user_suspended: User account suspended (payment issues, team removal)
 * - POST /on_user_deleted: User account deleted (soft delete)
 * - POST /on_user_reactivated: User account reactivated (payment restored)
 * - POST /on_cluster_assigned: User assigned to Hopsworks cluster
 *
 * Base URL: WINDMILL_WEBHOOK_BASE_URL
 * Must be: https://auto.hops.io/api/w/hopsworks/jobs/run_wait_result/f/f/saas
 * (Note: run_wait_result, not run)
 */

// Endpoint paths for each event type
type WebhookType =
  | 'registered'
  | 'activated'
  | 'plan_updated'
  | 'marketing_updated'
  | 'suspended'
  | 'deleted'
  | 'reactivated'
  | 'cluster_assigned';

const WEBHOOK_ENDPOINTS: Record<WebhookType, string> = {
  'registered': '/on_user_registered',
  'activated': '/on_user_activated',
  'plan_updated': '/on_plan_updated',
  'marketing_updated': '/on_marketing_updated',
  'suspended': '/on_user_suspended',
  'deleted': '/on_user_deleted',
  'reactivated': '/on_user_reactivated',
  'cluster_assigned': '/on_cluster_assigned'
};

// ============================================================================
// Payload Interfaces
// ============================================================================

interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string | null;
  source: string;
  ip: string | null;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  timestamp: string;
}

interface UserActivatedPayload {
  userId: string;
  email: string;
  name: string | null;
  plan: string;
  marketingConsent: boolean;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  // Enhanced fields
  hopsworksUsername: string | null;
  cluster: string | null;
  timestamp: string;
}

interface PlanUpdatedPayload {
  userId: string;
  email: string;
  oldPlan: string | null;
  newPlan: string;
  trigger: string;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  timestamp: string;
}

interface MarketingUpdatedPayload {
  userId: string;
  email: string;
  oldConsent: boolean | null;
  newConsent: boolean;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  timestamp: string;
}

// New lifecycle event payloads

interface UserSuspendedPayload {
  userId: string;
  email: string;
  name: string | null;
  reason: string;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  hopsworksUsername: string | null;
  cluster: string | null;
  plan: string | null;
  timestamp: string;
}

interface UserDeletedPayload {
  userId: string;
  email: string;
  name: string | null;
  reason: string;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  hopsworksUsername: string | null;
  cluster: string | null;
  plan: string | null;
  timestamp: string;
}

interface UserReactivatedPayload {
  userId: string;
  email: string;
  name: string | null;
  reason: string;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
  hopsworksUsername: string | null;
  cluster: string | null;
  plan: string | null;
  timestamp: string;
}

interface ClusterAssignedPayload {
  userId: string;
  email: string;
  name: string | null;
  hopsworksUsername: string;
  cluster: string;
  accountType: 'owner' | 'team_member';
  accountOwnerEmail: string | null;
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
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
}): Promise<void> {
  const payload: UserRegisteredPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name,
    source: params.source,
    ip: params.ip,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('registered', payload, params.email);
}

export async function sendUserActivated(params: {
  userId: string;
  email: string;
  name?: string | null;
  plan: string;
  marketingConsent: boolean;
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
  hopsworksUsername?: string | null;
  cluster?: string | null;
}): Promise<void> {
  const payload: UserActivatedPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name || null,
    plan: params.plan,
    marketingConsent: params.marketingConsent,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    hopsworksUsername: params.hopsworksUsername || null,
    cluster: params.cluster || null,
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
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
}): Promise<void> {
  const payload: PlanUpdatedPayload = {
    userId: params.userId,
    email: params.email,
    oldPlan: params.oldPlan,
    newPlan: params.newPlan,
    trigger: params.trigger,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('plan_updated', payload, params.email);
}

export async function sendMarketingUpdated(params: {
  userId: string;
  email: string;
  oldConsent: boolean | null;
  newConsent: boolean;
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
}): Promise<void> {
  const payload: MarketingUpdatedPayload = {
    userId: params.userId,
    email: params.email,
    oldConsent: params.oldConsent,
    newConsent: params.newConsent,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('marketing_updated', payload, params.email);
}

// ============================================================================
// Lifecycle Event Webhooks
// ============================================================================

export async function sendUserSuspended(params: {
  userId: string;
  email: string;
  name?: string | null;
  reason: string;
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
  hopsworksUsername?: string | null;
  cluster?: string | null;
  plan?: string | null;
}): Promise<void> {
  const payload: UserSuspendedPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name || null,
    reason: params.reason,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    hopsworksUsername: params.hopsworksUsername || null,
    cluster: params.cluster || null,
    plan: params.plan || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('suspended', payload, params.email);
}

export async function sendUserDeleted(params: {
  userId: string;
  email: string;
  name?: string | null;
  reason: string;
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
  hopsworksUsername?: string | null;
  cluster?: string | null;
  plan?: string | null;
}): Promise<void> {
  const payload: UserDeletedPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name || null,
    reason: params.reason,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    hopsworksUsername: params.hopsworksUsername || null,
    cluster: params.cluster || null,
    plan: params.plan || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('deleted', payload, params.email);
}

export async function sendUserReactivated(params: {
  userId: string;
  email: string;
  name?: string | null;
  reason: string;
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
  hopsworksUsername?: string | null;
  cluster?: string | null;
  plan?: string | null;
}): Promise<void> {
  const payload: UserReactivatedPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name || null,
    reason: params.reason,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    hopsworksUsername: params.hopsworksUsername || null,
    cluster: params.cluster || null,
    plan: params.plan || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('reactivated', payload, params.email);
}

export async function sendClusterAssigned(params: {
  userId: string;
  email: string;
  name?: string | null;
  hopsworksUsername: string;
  cluster: string;
  accountType?: 'owner' | 'team_member';
  accountOwnerEmail?: string | null;
}): Promise<void> {
  const payload: ClusterAssignedPayload = {
    userId: params.userId,
    email: params.email,
    name: params.name || null,
    hopsworksUsername: params.hopsworksUsername,
    cluster: params.cluster,
    accountType: params.accountType || 'owner',
    accountOwnerEmail: params.accountOwnerEmail || null,
    timestamp: new Date().toISOString()
  };
  await sendWebhook('cluster_assigned', payload, params.email);
}
