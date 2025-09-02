#!/usr/bin/env ts-node
/**
 * Script to test the resilience of user login flow
 * Tests various failure scenarios and verifies auto-repair functionality
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_SCENARIOS = {
  missingStripeCustomer: 'User without Stripe customer ID',
  missingSubscription: 'Postpaid user without subscription',
  missingClusterAssignment: 'User with payment but no cluster',
  missingHopsworksUser: 'User with cluster but no Hopsworks user',
  incorrectMaxNumProjects: 'User with wrong maxNumProjects',
  teamMemberNoCluster: 'Team member without cluster assignment'
};

async function testUserResilience(userId: string) {
  console.log('\n========================================');
  console.log(`Testing resilience for user: ${userId}`);
  console.log('========================================\n');

  // Get initial user state
  const { data: initialUser } = await supabase
    .from('users')
    .select(`
      *,
      user_hopsworks_assignments (
        *,
        hopsworks_clusters (*)
      )
    `)
    .eq('id', userId)
    .single();

  if (!initialUser) {
    console.error(`User ${userId} not found`);
    return;
  }

  console.log('Initial state:');
  console.log('- Email:', initialUser.email);
  console.log('- Billing mode:', initialUser.billing_mode);
  console.log('- Stripe customer:', initialUser.stripe_customer_id ? 'YES' : 'NO');
  console.log('- Subscription:', initialUser.stripe_subscription_id ? 'YES' : 'NO');
  console.log('- Cluster assigned:', initialUser.user_hopsworks_assignments?.length > 0 ? 'YES' : 'NO');
  console.log('- Hopsworks username:', initialUser.hopsworks_username || 'NONE');
  console.log('- Is team member:', initialUser.account_owner_id ? 'YES' : 'NO');

  // Call sync-user endpoint (simulating login)
  console.log('\nCalling sync-user endpoint (simulating login)...');
  
  const syncResponse = await fetch(`${process.env.AUTH0_BASE_URL || 'http://localhost:3000'}/api/auth/sync-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Note: In real test, you'd need proper Auth0 session
      'Cookie': `appSession=${process.env.TEST_SESSION_COOKIE || ''}`
    },
    body: JSON.stringify({})
  });

  if (syncResponse.ok) {
    const result = await syncResponse.json();
    console.log('\nSync-user health checks:');
    Object.entries(result.healthChecks || {}).forEach(([check, passed]) => {
      console.log(`- ${check}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    });
  } else {
    console.error('Sync-user failed:', await syncResponse.text());
  }

  // Check billing status
  console.log('\nChecking billing status...');
  const billingResponse = await fetch(`${process.env.AUTH0_BASE_URL || 'http://localhost:3000'}/api/user/verify-billing`, {
    method: 'GET',
    headers: {
      'Cookie': `appSession=${process.env.TEST_SESSION_COOKIE || ''}`
    }
  });

  if (billingResponse.ok) {
    const billing = await billingResponse.json();
    console.log('Billing status:');
    console.log('- Billing enabled:', billing.billingStatus.billingEnabled ? '✅' : '❌');
    console.log('- Issues:', billing.billingStatus.issues.length > 0 ? billing.billingStatus.issues : 'None');
    console.log('- Cluster should exist:', billing.clusterStatus.shouldHaveCluster ? 'YES' : 'NO');
    console.log('- Cluster assigned:', billing.clusterStatus.hasAssignment ? '✅' : '❌');
  }

  // Get final user state
  const { data: finalUser } = await supabase
    .from('users')
    .select(`
      *,
      user_hopsworks_assignments (
        *,
        hopsworks_clusters (*)
      )
    `)
    .eq('id', userId)
    .single();

  console.log('\nFinal state after auto-repair:');
  console.log('- Stripe customer:', finalUser?.stripe_customer_id ? '✅ YES' : '❌ NO');
  console.log('- Subscription:', finalUser?.stripe_subscription_id ? '✅ YES' : '❌ NO');
  console.log('- Cluster assigned:', finalUser?.user_hopsworks_assignments?.length > 0 ? '✅ YES' : '❌ NO');
  console.log('- Hopsworks username:', finalUser?.hopsworks_username ? `✅ ${finalUser.hopsworks_username}` : '❌ NONE');

  // Check for logged failures
  const { data: failures } = await supabase
    .from('health_check_failures')
    .select('*')
    .eq('user_id', userId)
    .is('resolved_at', null);

  if (failures && failures.length > 0) {
    console.log('\n⚠️  Unresolved health check failures:');
    failures.forEach(f => {
      console.log(`- ${f.check_type}: ${f.error_message}`);
    });
  } else {
    console.log('\n✅ No unresolved health check failures');
  }
}

async function createTestScenarios() {
  console.log('\n========================================');
  console.log('Creating test scenarios...');
  console.log('========================================\n');

  // Scenario 1: User without Stripe customer
  const scenario1Email = `test-no-stripe-${Date.now()}@example.com`;
  await supabase.from('users').insert({
    id: `auth0|test-no-stripe-${Date.now()}`,
    email: scenario1Email,
    name: 'Test No Stripe',
    billing_mode: 'postpaid',
    // Intentionally missing stripe_customer_id
  });
  console.log(`Created scenario 1: ${scenario1Email} (missing Stripe customer)`);

  // Scenario 2: Team member without cluster
  const scenario2Email = `test-team-no-cluster-${Date.now()}@example.com`;
  const ownerId = `auth0|test-owner-${Date.now()}`;
  
  // Create owner first
  await supabase.from('users').insert({
    id: ownerId,
    email: `owner-${Date.now()}@example.com`,
    name: 'Test Owner',
    billing_mode: 'postpaid',
    stripe_customer_id: 'cus_test_owner'
  });
  
  // Create team member
  await supabase.from('users').insert({
    id: `auth0|test-team-${Date.now()}`,
    email: scenario2Email,
    name: 'Test Team Member',
    account_owner_id: ownerId
    // Should get cluster from owner
  });
  console.log(`Created scenario 2: ${scenario2Email} (team member without cluster)`);

  return [scenario1Email, scenario2Email];
}

// Main test runner
async function runTests() {
  console.log('Starting resilience tests...\n');

  // Test with existing users if provided
  const testUserId = process.argv[2];
  if (testUserId) {
    await testUserResilience(testUserId);
  } else {
    console.log('No user ID provided. Creating test scenarios...');
    const [email1, email2] = await createTestScenarios();
    
    console.log('\nNote: To complete testing, you need to:');
    console.log('1. Log in as these test users to trigger sync-user');
    console.log('2. Or manually call the endpoints with proper Auth0 session');
    console.log(`3. Or run: npm run test:resilience "auth0|user-id"`);
  }

  // Check overall system health
  console.log('\n========================================');
  console.log('System Health Check');
  console.log('========================================\n');

  const { data: recentFailures, count } = await supabase
    .from('health_check_failures')
    .select('check_type', { count: 'exact' })
    .is('resolved_at', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  console.log(`Unresolved failures in last 24h: ${count || 0}`);
  if (recentFailures && recentFailures.length > 0) {
    const byType = recentFailures.reduce((acc, f) => {
      acc[f.check_type] = (acc[f.check_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(byType).forEach(([type, cnt]) => {
      console.log(`- ${type}: ${cnt}`);
    });
  }
}

runTests()
  .then(() => {
    console.log('\nResilience tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });