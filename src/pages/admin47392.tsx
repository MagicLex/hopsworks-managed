import { useUser } from '@auth0/nextjs-auth0/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import Navbar from '@/components/Navbar';
import { CollectionResult } from '@/types/api';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_login_at: string;
  login_count: number;
  status: string;
  is_admin: boolean;
  hopsworks_username?: string;
  last_24h_cost?: number;
  active_namespaces?: string[];
  projects?: {
    namespace: string;
    name: string;
    id: number;
    is_owner: boolean;
    total_cost: number;
    cpu_cost: number;
    memory_cost: number;
    storage_cost: number;
    cpu_hours: number;
    ram_gb_hours: number;
  }[];
  user_credits?: {
    total_purchased: number;
    total_used: number;
    cpu_hours_used: number;
    gpu_hours_used: number;
    storage_gb_months: number;
  };
  user_hopsworks_assignments?: {
    hopsworks_cluster_id: string;
    hopsworks_clusters: {
      id: string;
      name: string;
      api_url: string;
    };
  }[];
}

export default function AdminPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectingUsage, setCollectingUsage] = useState(false);
  const [collectionResult, setCollectionResult] = useState<CollectionResult | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const triggerUsageCollection = async () => {
    setCollectingUsage(true);
    setCollectionResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/usage/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setCollectionResult(data);
        // Refresh users after collection
        setTimeout(fetchUsers, 2000);
      } else {
        setError(data.error || 'Failed to trigger collection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger usage collection');
    } finally {
      setCollectingUsage(false);
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  // Calculate total PAYG amount for a user
  const getUserTotalPayg = (user: User) => {
    return user.user_credits?.total_used || 0;
  };

  // Get today's cost for a user
  const getUserTodayCost = (user: User) => {
    if (!user.projects || user.projects.length === 0) return 0;
    return user.projects.reduce((sum, project) => sum + project.total_cost, 0);
  };

  if (isLoading || loadingUsers) {
    return (
      <Flex align="center" justify="center" className="min-h-screen">
        <Text>Loading...</Text>
      </Flex>
    );
  }

  // Filter out users with no projects or costs
  const activeUsers = users.filter(u => 
    (u.projects && u.projects.length > 0) || 
    (u.user_credits && u.user_credits.total_used > 0)
  );

  return (
    <>
      <Navbar />
      <Box className="min-h-screen bg-surfaceShade1 p-4">
        <Box className="max-w-7xl mx-auto">
          <Title as="h1" className="text-2xl mb-8">Admin Billing Dashboard</Title>
        
          {error && (
            <Card className="mb-4 border-errorDefault bg-errorShade1">
              <Text className="text-errorDefault">{error}</Text>
            </Card>
          )}

          <Card withShadow>
            <Flex justify="between" align="center" className="mb-6">
              <Title as="h2" className="text-lg">User Billing Overview</Title>
              <Button
                onClick={triggerUsageCollection}
                disabled={collectingUsage}
                intent="primary"
                size="md"
              >
                {collectingUsage ? 'Collecting...' : 'Update Usage Data'}
              </Button>
            </Flex>
            
            {/* Collection Result */}
            {collectionResult && (
              <Card className="mb-4 border border-successDefault bg-successShade1">
                <Text className="text-successDefault font-semibold mb-2">Collection Completed</Text>
                <Text className="text-sm mb-1">
                  Successful: {collectionResult.result?.results?.successful || 0} users
                </Text>
                <Text className="text-sm mb-1">
                  Failed: {collectionResult.result?.results?.failed || 0} users
                </Text>
                {collectionResult.result?.results?.errors && collectionResult.result.results.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray">View Errors</summary>
                    <Box className="mt-2 p-2 bg-grayShade1 rounded">
                      {collectionResult.result.results.errors.map((err: string, i: number) => (
                        <Text key={i} className="text-xs text-errorDefault">{err}</Text>
                      ))}
                    </Box>
                  </details>
                )}
              </Card>
            )}
            
            <Box className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grayShade2 text-xs font-semibold uppercase text-gray">
                    <th className="text-left py-3">User</th>
                    <th className="text-left py-3">Cluster</th>
                    <th className="text-right py-3">Total PAYG</th>
                    <th className="text-right py-3">Today&apos;s Cost</th>
                    <th className="text-right py-3">Projects</th>
                    <th className="text-center py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray">
                        No users with billing data found. Run &quot;Update Usage Data&quot; to fetch latest costs.
                      </td>
                    </tr>
                  ) : (
                    activeUsers.map(user => {
                      const totalPayg = getUserTotalPayg(user);
                      const todayCost = getUserTodayCost(user);
                      const isExpanded = expandedUsers.has(user.id);
                      
                      return (
                        <>
                          <tr key={user.id} className="border-b border-grayShade1 hover:bg-grayShade1/30">
                            <td className="py-3">
                              <Box>
                                <Text className="font-medium">{user.name || 'Unknown User'}</Text>
                                <Text className="text-xs text-gray">{user.email}</Text>
                                {user.hopsworks_username && (
                                  <Text className="text-xs font-mono text-gray mt-1">
                                    HW: {user.hopsworks_username}
                                  </Text>
                                )}
                              </Box>
                            </td>
                            <td className="py-3">
                              {user.user_hopsworks_assignments?.[0] ? (
                                <Badge size="sm" variant="default">
                                  {user.user_hopsworks_assignments[0].hopsworks_clusters.name}
                                </Badge>
                              ) : (
                                <Text className="text-xs text-gray">No cluster</Text>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <Text className="font-mono font-semibold">
                                ${totalPayg.toFixed(2)}
                              </Text>
                            </td>
                            <td className="py-3 text-right">
                              {todayCost > 0 ? (
                                <Text className="font-mono">
                                  ${todayCost.toFixed(4)}
                                </Text>
                              ) : (
                                <Text className="text-xs text-gray">-</Text>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              {user.projects && user.projects.length > 0 ? (
                                <Badge size="sm" variant="default">
                                  {user.projects.length}
                                </Badge>
                              ) : (
                                <Text className="text-xs text-gray">0</Text>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              {user.projects && user.projects.length > 0 && (
                                <Button
                                  onClick={() => toggleUserExpanded(user.id)}
                                  size="sm"
                                  intent="secondary"
                                >
                                  {isExpanded ? 'Hide' : 'Show'} Details
                                </Button>
                              )}
                            </td>
                          </tr>
                          
                          {/* Project breakdown row */}
                          {isExpanded && user.projects && user.projects.length > 0 && (
                            <tr key={`${user.id}-projects`}>
                              <td colSpan={6} className="bg-grayShade1/20 p-4">
                                <Box className="ml-8">
                                  <Text className="text-sm font-semibold mb-3">Project Breakdown</Text>
                                  <Box className="space-y-2">
                                    {user.projects.map(project => (
                                      <Card key={project.namespace} className="border border-grayShade2 p-3">
                                        <Flex justify="between" align="start">
                                          <Box>
                                            <Text className="font-medium">{project.name}</Text>
                                            <Text className="text-xs text-gray">
                                              Namespace: {project.namespace} | ID: {project.id}
                                            </Text>
                                          </Box>
                                          <Box className="text-right">
                                            <Text className="font-mono font-semibold">
                                              ${project.total_cost.toFixed(4)}
                                            </Text>
                                            <Text className="text-xs text-gray">today</Text>
                                          </Box>
                                        </Flex>
                                        
                                        {project.total_cost > 0 && (
                                          <Box className="mt-3 grid grid-cols-3 gap-4 text-xs">
                                            <Box>
                                              <Text className="text-gray">CPU</Text>
                                              <Text className="font-mono">${project.cpu_cost.toFixed(4)}</Text>
                                              <Text className="text-gray">{project.cpu_hours.toFixed(2)}h</Text>
                                            </Box>
                                            <Box>
                                              <Text className="text-gray">Memory</Text>
                                              <Text className="font-mono">${project.memory_cost.toFixed(4)}</Text>
                                              <Text className="text-gray">{project.ram_gb_hours.toFixed(2)} GB·h</Text>
                                            </Box>
                                            <Box>
                                              <Text className="text-gray">Storage</Text>
                                              <Text className="font-mono">${project.storage_cost.toFixed(4)}</Text>
                                            </Box>
                                          </Box>
                                        )}
                                      </Card>
                                    ))}
                                  </Box>
                                </Box>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Box>
            
            {/* Summary */}
            {activeUsers.length > 0 && (
              <Box className="mt-6 pt-4 border-t border-grayShade2">
                <Flex justify="between" align="center">
                  <Text className="text-sm text-gray">
                    Total Active Users: {activeUsers.length}
                  </Text>
                  <Box className="text-right">
                    <Text className="text-sm text-gray">Total Today&apos;s Cost</Text>
                    <Text className="font-mono font-semibold text-lg">
                      ${activeUsers.reduce((sum, u) => sum + getUserTodayCost(u), 0).toFixed(2)}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )}
          </Card>
        </Box>
      </Box>
    </>
  );
}