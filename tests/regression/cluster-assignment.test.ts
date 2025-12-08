/**
 * Cluster Assignment Logic Tests
 *
 * Tests business logic that affects user placement and project limits.
 * If these break, users get assigned to wrong clusters or wrong project limits.
 */

import { describe, it, expect } from 'vitest';
import {
  selectClusterByCapacity,
  calculateMaxNumProjects,
  canAssignCluster,
  type ClusterCapacity
} from '@/lib/cluster-assignment';

describe('selectClusterByCapacity', () => {
  it('returns null when no clusters available', () => {
    expect(selectClusterByCapacity([])).toBeNull();
  });

  it('selects least loaded cluster', () => {
    const clusters: ClusterCapacity[] = [
      { id: 'c1', name: 'Cluster 1', current_users: 50, max_users: 100 },
      { id: 'c2', name: 'Cluster 2', current_users: 10, max_users: 100 },
      { id: 'c3', name: 'Cluster 3', current_users: 30, max_users: 100 },
    ];
    expect(selectClusterByCapacity(clusters)?.id).toBe('c2');
  });

  it('returns null when all clusters full', () => {
    const clusters: ClusterCapacity[] = [
      { id: 'c1', name: 'Cluster 1', current_users: 100, max_users: 100 },
      { id: 'c2', name: 'Cluster 2', current_users: 50, max_users: 50 },
    ];
    expect(selectClusterByCapacity(clusters)).toBeNull();
  });

  it('skips full clusters', () => {
    const clusters: ClusterCapacity[] = [
      { id: 'c1', name: 'Cluster 1', current_users: 100, max_users: 100 }, // full
      { id: 'c2', name: 'Cluster 2', current_users: 80, max_users: 100 },  // available
    ];
    expect(selectClusterByCapacity(clusters)?.id).toBe('c2');
  });
});

describe('calculateMaxNumProjects', () => {
  it('team members always get 0', () => {
    expect(calculateMaxNumProjects(true, false, false)).toBe(0);
    expect(calculateMaxNumProjects(true, true, true)).toBe(0);
  });

  it('owner with subscription gets 5', () => {
    expect(calculateMaxNumProjects(false, true, false)).toBe(5);
  });

  it('owner with prepaid gets 5', () => {
    expect(calculateMaxNumProjects(false, false, true)).toBe(5);
  });

  it('owner without payment gets 0', () => {
    expect(calculateMaxNumProjects(false, false, false)).toBe(0);
  });
});

describe('canAssignCluster', () => {
  it('manual assignment always allowed', () => {
    expect(canAssignCluster(true, false).allowed).toBe(true);
  });

  it('prepaid auto-assignment allowed', () => {
    expect(canAssignCluster(false, true).allowed).toBe(true);
  });

  it('postpaid auto-assignment blocked', () => {
    const result = canAssignCluster(false, false);
    expect(result.allowed).toBe(false);
  });
});
