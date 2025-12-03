/**
 * Cluster Capacity Integration Tests
 *
 * Tests the cluster capacity tracking at DB level.
 * If broken → clusters overloaded or users blocked incorrectly.
 *
 * Requires: `supabase start` running locally
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  getTestSupabase,
  seedUser,
  seedCluster,
  cleanupTestData,
} from './helpers/test-db';

describe('Cluster Capacity', () => {
  const supabase = getTestSupabase();

  beforeEach(async () => {
    await cleanupTestData(supabase);
  });

  afterAll(async () => {
    await cleanupTestData(supabase);
  });

  describe('increment_cluster_users RPC', () => {
    it('increments current_users by 1', async () => {
      const cluster = await seedCluster(supabase, { current_users: 5, max_users: 100 });

      // Call RPC
      const { error } = await supabase.rpc('increment_cluster_users', {
        cluster_id: cluster.id,
      });
      expect(error).toBeNull();

      // Verify increment
      const { data } = await supabase
        .from('hopsworks_clusters')
        .select('current_users')
        .eq('id', cluster.id)
        .single();

      expect(data?.current_users).toBe(6);
    });

    it('can increment past max_users (no DB constraint)', async () => {
      // DB doesn't enforce max_users - that's application logic
      const cluster = await seedCluster(supabase, { current_users: 100, max_users: 100 });

      await supabase.rpc('increment_cluster_users', { cluster_id: cluster.id });

      const { data } = await supabase
        .from('hopsworks_clusters')
        .select('current_users')
        .eq('id', cluster.id)
        .single();

      expect(data?.current_users).toBe(101);
    });
  });

  describe('decrement_cluster_users RPC', () => {
    it('decrements current_users by 1', async () => {
      const cluster = await seedCluster(supabase, { current_users: 10, max_users: 100 });

      const { error } = await supabase.rpc('decrement_cluster_users', {
        cluster_id: cluster.id,
      });
      expect(error).toBeNull();

      const { data } = await supabase
        .from('hopsworks_clusters')
        .select('current_users')
        .eq('id', cluster.id)
        .single();

      expect(data?.current_users).toBe(9);
    });

    it('does not go below 0', async () => {
      const cluster = await seedCluster(supabase, { current_users: 0, max_users: 100 });

      await supabase.rpc('decrement_cluster_users', { cluster_id: cluster.id });

      const { data } = await supabase
        .from('hopsworks_clusters')
        .select('current_users')
        .eq('id', cluster.id)
        .single();

      expect(data?.current_users).toBe(0);
    });
  });

  describe('Cluster selection queries', () => {
    it('orders clusters by current_users ascending', async () => {
      await seedCluster(supabase, { name: 'test_cluster_full', current_users: 100, max_users: 100 });
      await seedCluster(supabase, { name: 'test_cluster_half', current_users: 50, max_users: 100 });
      await seedCluster(supabase, { name: 'test_cluster_empty', current_users: 0, max_users: 100 });

      const { data: clusters } = await supabase
        .from('hopsworks_clusters')
        .select('name, current_users, max_users')
        .eq('status', 'active')
        .like('name', 'test_cluster_%')
        .order('current_users', { ascending: true });

      expect(clusters?.[0].name).toBe('test_cluster_empty');
      expect(clusters?.[1].name).toBe('test_cluster_half');
      expect(clusters?.[2].name).toBe('test_cluster_full');
    });

    it('filters out inactive clusters', async () => {
      await seedCluster(supabase, { name: 'test_cluster_active', status: 'active' });
      await seedCluster(supabase, { name: 'test_cluster_inactive', status: 'inactive' });

      const { data: clusters } = await supabase
        .from('hopsworks_clusters')
        .select('name')
        .eq('status', 'active')
        .like('name', 'test_cluster_active');

      expect(clusters?.length).toBe(1);
      expect(clusters?.[0].name).toBe('test_cluster_active');
    });
  });

  describe('User assignment tracking', () => {
    it('creates assignment record linking user to cluster', async () => {
      const user = await seedUser(supabase);
      const cluster = await seedCluster(supabase);

      const { error } = await supabase
        .from('user_hopsworks_assignments')
        .insert({
          user_id: user.id,
          hopsworks_cluster_id: cluster.id,
        });

      expect(error).toBeNull();

      // Verify assignment exists
      const { data } = await supabase
        .from('user_hopsworks_assignments')
        .select('user_id, hopsworks_cluster_id')
        .eq('user_id', user.id)
        .single();

      expect(data?.hopsworks_cluster_id).toBe(cluster.id);
    });

    it('prevents duplicate user assignments (unique constraint)', async () => {
      const user = await seedUser(supabase);
      const cluster = await seedCluster(supabase);

      // First assignment
      await supabase
        .from('user_hopsworks_assignments')
        .insert({ user_id: user.id, hopsworks_cluster_id: cluster.id });

      // Second assignment should fail
      const { error } = await supabase
        .from('user_hopsworks_assignments')
        .insert({ user_id: user.id, hopsworks_cluster_id: cluster.id });

      expect(error).not.toBeNull();
    });
  });
});
