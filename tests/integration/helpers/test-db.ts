/**
 * Test database helpers for integration tests
 *
 * Usage:
 *   1. Start local Supabase: `supabase start`
 *   2. Run tests: `npm run test:integration`
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Local Supabase defaults (from `supabase start` output)
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://127.0.0.1:54321';
const TEST_SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create a Supabase client for tests
 */
export function getTestSupabase(): SupabaseClient {
  if (!TEST_SUPABASE_SERVICE_KEY) {
    throw new Error(
      'TEST_SUPABASE_SERVICE_KEY not set. Run `supabase start` and copy the service_role key to .env.test'
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY);
  }
  return supabaseClient;
}

/**
 * Generate a unique test ID to avoid collisions
 */
function testId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Seed a test user
 */
export async function seedUser(
  supabase: SupabaseClient,
  overrides: {
    id?: string;
    email?: string;
    status?: 'active' | 'suspended' | 'deleted';
    billing_mode?: 'prepaid' | 'postpaid';
    account_owner_id?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
  } = {}
): Promise<{ id: string; email: string }> {
  const id = overrides.id || testId();
  const email = overrides.email || `${id}@test.local`;

  const { data, error } = await supabase
    .from('users')
    .insert({
      id,
      email,
      status: overrides.status || 'active',
      billing_mode: overrides.billing_mode || 'postpaid',
      account_owner_id: overrides.account_owner_id ?? null,
      stripe_customer_id: overrides.stripe_customer_id ?? null,
      stripe_subscription_id: overrides.stripe_subscription_id ?? null,
    })
    .select('id, email')
    .single();

  if (error) {
    throw new Error(`Failed to seed user: ${error.message}`);
  }

  return data;
}

/**
 * Seed a test cluster
 * Note: id is UUID, let DB generate it
 */
export async function seedCluster(
  supabase: SupabaseClient,
  overrides: {
    name?: string;
    current_users?: number;
    max_users?: number;
    status?: 'active' | 'inactive';
  } = {}
): Promise<{ id: string; name: string }> {
  const name = overrides.name || `test_cluster_${testId()}`;

  const { data, error } = await supabase
    .from('hopsworks_clusters')
    .insert({
      name,
      api_url: 'http://localhost:28181', // fake, not called in tests
      api_key: 'test-key',
      current_users: overrides.current_users ?? 0,
      max_users: overrides.max_users ?? 100,
      status: overrides.status || 'active',
    })
    .select('id, name')
    .single();

  if (error) {
    throw new Error(`Failed to seed cluster: ${error.message}`);
  }

  return data;
}

/**
 * Clean up test data by prefix
 * Call after tests to remove test users/clusters
 */
export async function cleanupTestData(supabase: SupabaseClient): Promise<void> {
  // Delete assignments first (FK constraint)
  await supabase.from('user_hopsworks_assignments').delete().like('user_id', 'test_%');
  // Delete test users
  await supabase.from('users').delete().like('id', 'test_%');
  // Delete test clusters by name
  await supabase.from('hopsworks_clusters').delete().like('name', 'test_cluster_%');
  await supabase.from('team_invites').delete().like('email', '%@test.local');
}

/**
 * Get user status from DB
 */
export async function getUserStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('status')
    .eq('id', userId)
    .single();

  if (error) throw new Error(`Failed to get user status: ${error.message}`);
  return data.status;
}
