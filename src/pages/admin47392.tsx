import { useUser } from '@auth0/nextjs-auth0/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Flex, Title, Text, Button, Card, Input, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from 'tailwind-quartz';
import Navbar from '@/components/Navbar';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_login_at: string;
  login_count: number;
  status: string;
  is_admin: boolean;
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

interface Cluster {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  max_users: number;
  current_users: number;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hopsworksTestResults, setHopsworksTestResults] = useState<Record<string, any>>({});
  const [testingHopsworks, setTestingHopsworks] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('users');

  // New cluster form
  const [newCluster, setNewCluster] = useState({
    name: '',
    api_url: '',
    api_key: '',
    max_users: 100
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    fetchUsers();
    fetchClusters();
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

  const fetchClusters = async () => {
    try {
      const response = await fetch('/api/admin/clusters');
      if (!response.ok) {
        throw new Error('Failed to fetch clusters');
      }
      const data = await response.json();
      setClusters(data.clusters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoadingClusters(false);
    }
  };

  const handleCreateCluster = async () => {
    try {
      const response = await fetch('/api/admin/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCluster)
      });

      if (!response.ok) {
        throw new Error('Failed to create cluster');
      }

      await fetchClusters();
      setNewCluster({ name: '', api_url: '', api_key: '', max_users: 100 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cluster');
    }
  };

  const testHopsworksConnection = async (userId: string) => {
    const userCluster = users.find(u => u.id === userId)?.user_hopsworks_assignments?.[0];
    if (!userCluster) {
      setError('User has no cluster assignment');
      return;
    }

    const testKey = `hopsworks-${userId}`;
    setTestingHopsworks({ ...testingHopsworks, [testKey]: true });

    try {
      const response = await fetch('/api/admin/test-hopsworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          clusterId: userCluster.hopsworks_cluster_id
        })
      });

      const data = await response.json();
      
      setHopsworksTestResults({
        ...hopsworksTestResults,
        [testKey]: {
          status: response.status,
          data: data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      setHopsworksTestResults({
        ...hopsworksTestResults,
        [testKey]: {
          error: err instanceof Error ? err.message : 'Failed to test',
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      setTestingHopsworks({ ...testingHopsworks, [testKey]: false });
    }
  };

  if (isLoading || loadingUsers || loadingClusters) {
    return (
      <Flex align="center" justify="center" className="min-h-screen">
        <Text>Loading...</Text>
      </Flex>
    );
  }

  return (
    <>
      <Navbar />
      <Box className="min-h-screen bg-surfaceShade1 p-4">
        <Box className="max-w-7xl mx-auto">
          <Title as="h1" className="text-2xl mb-8">Admin Dashboard</Title>
        
        {error && (
          <Card className="mb-4 border-errorDefault bg-errorShade1">
            <Text className="text-errorDefault">{error}</Text>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="clusters">Clusters</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card withShadow>
              <Title as="h2" className="text-lg mb-4">All Users ({users.length})</Title>
              <Box className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grayShade2">
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Admin</th>
                      <th className="text-left py-2">Cluster</th>
                      <th className="text-left py-2">Logins</th>
                      <th className="text-left py-2">Credits Used</th>
                      <th className="text-left py-2">Instance</th>
                      <th className="text-left py-2">Created</th>
                      <th className="text-left py-2">Hopsworks Test</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-grayShade2">
                        <td className="py-2">
                          <Text className="font-mono text-sm">{user.email}</Text>
                        </td>
                        <td className="py-2">
                          <Text>{user.name || '-'}</Text>
                        </td>
                        <td className="py-2">
                          <Badge 
                            variant={user.status === 'active' ? 'success' : 'default'}
                            size="sm"
                          >
                            {user.status}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Text>{user.is_admin ? '✓' : '-'}</Text>
                        </td>
                        <td className="py-2">
                          {user.user_hopsworks_assignments?.[0] ? (
                            <Badge size="sm" variant="default">
                              {user.user_hopsworks_assignments[0].hopsworks_clusters.name}
                            </Badge>
                          ) : (
                            <Text className="text-gray">-</Text>
                          )}
                        </td>
                        <td className="py-2">
                          <Text>{user.login_count}</Text>
                        </td>
                        <td className="py-2">
                          <Text className="font-mono">
                            ${user.user_credits?.total_used?.toFixed(2) || '0.00'}
                          </Text>
                        </td>
                        <td className="py-2">
                          <Text>{user.user_hopsworks_assignments?.[0] ? 'Active' : 'Not Assigned'}</Text>
                        </td>
                        <td className="py-2">
                          <Text className="text-gray">{new Date(user.created_at).toLocaleDateString()}</Text>
                        </td>
                        <td className="py-2">
                          {user.user_hopsworks_assignments?.[0] ? (
                            <Button
                              onClick={() => testHopsworksConnection(user.id)}
                              disabled={testingHopsworks[`hopsworks-${user.id}`]}
                              className="text-sm px-3 py-1"
                            >
                              {testingHopsworks[`hopsworks-${user.id}`] ? 'Testing...' : 'Test API'}
                            </Button>
                          ) : (
                            <Text className="text-gray text-sm">No cluster</Text>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Card>

            {/* Hopsworks Test Results */}
            {Object.keys(hopsworksTestResults).length > 0 && (
              <Card withShadow className="mt-4">
                <Title as="h3" className="text-lg mb-4">Hopsworks API Test Results</Title>
                <Box className="space-y-4">
                  {Object.entries(hopsworksTestResults).map(([key, result]) => (
                    <Card key={key} className="border border-grayShade2 p-4">
                      <Flex justify="between" align="center" className="mb-2">
                        <Text className="font-mono text-sm font-semibold">{key}</Text>
                        <Text className="text-xs text-gray">{result.timestamp}</Text>
                      </Flex>
                      {result.error ? (
                        <Text className="text-errorDefault">Error: {result.error}</Text>
                      ) : (
                        <Box className="bg-grayShade1 p-2 rounded overflow-x-auto">
                          <pre className="text-xs">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </Box>
                      )}
                    </Card>
                  ))}
                </Box>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="clusters">
            <Card withShadow>
              <Title as="h2" className="text-lg mb-4">Cluster Configuration</Title>
              
              {/* Existing clusters */}
              {clusters.length > 0 && (
                <Box className="mb-8">
                  <Title as="h3" className="text-base mb-2">Current Clusters</Title>
                  <Flex direction="column" gap={16}>
                    {clusters.map(cluster => (
                      <Card key={cluster.id} className="border border-grayShade2">
                        <Box className="grid grid-cols-2 gap-4">
                          <Box>
                            <Text className="text-sm text-gray mb-1">Name</Text>
                            <Text className="font-medium">{cluster.name}</Text>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray mb-1">Status</Text>
                            <Badge 
                              variant={cluster.status === 'active' ? 'success' : 'default'}
                            >
                              {cluster.status}
                            </Badge>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray mb-1">API URL</Text>
                            <Text className="text-sm font-mono">{cluster.api_url}</Text>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray mb-1">Users</Text>
                            <Text className="text-sm">{cluster.current_users} / {cluster.max_users}</Text>
                          </Box>
                        </Box>
                      </Card>
                    ))}
                  </Flex>
                </Box>
              )}

              {/* Add new cluster */}
              <Box>
                <Title as="h3" className="text-base mb-2">Add New Cluster</Title>
                <Box className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Cluster Name"
                    value={newCluster.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, name: e.target.value})}
                  />
                  <Input
                    placeholder="API URL"
                    value={newCluster.api_url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, api_url: e.target.value})}
                  />
                  <Input
                    placeholder="API Key"
                    type="password"
                    value={newCluster.api_key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, api_key: e.target.value})}
                  />
                  <Input
                    placeholder="Max Users"
                    type="number"
                    value={newCluster.max_users}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, max_users: parseInt(e.target.value) || 100})}
                  />
                </Box>
                <Button 
                  onClick={handleCreateCluster}
                  intent="primary"
                  className="mt-4"
                  disabled={!newCluster.name || !newCluster.api_url}
                >
                  Create Cluster
                </Button>
              </Box>
            </Card>
          </TabsContent>
        </Tabs>
      </Box>
    </Box>
    </>
  );
}