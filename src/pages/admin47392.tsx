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
  hopsworks_username?: string;
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
  kubeconfig?: string;
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
  const [userMetrics, setUserMetrics] = useState<Record<string, any>>({});
  const [fetchingMetrics, setFetchingMetrics] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('users');
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [kubeconfigModal, setKubeconfigModal] = useState<string | null>(null);
  const [collectingUsage, setCollectingUsage] = useState(false);
  const [collectionResult, setCollectionResult] = useState<any>(null);

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

  const handleUpdateCluster = async (clusterId: string, updates: Partial<Cluster>) => {
    try {
      const response = await fetch('/api/admin/clusters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clusterId, ...updates })
      });

      if (!response.ok) {
        throw new Error('Failed to update cluster');
      }

      setEditingCluster(null);
      await fetchClusters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cluster');
    }
  };

  const handleUploadKubeconfig = async (clusterId: string, kubeconfig: string) => {
    try {
      const response = await fetch('/api/admin/clusters/update-kubeconfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId, kubeconfig })
      });

      if (!response.ok) {
        throw new Error('Failed to upload kubeconfig');
      }

      setKubeconfigModal(null);
      await fetchClusters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload kubeconfig');
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

  const fetchUserMetrics = async (userId: string) => {
    const metricsKey = `metrics-${userId}`;
    setFetchingMetrics({ ...fetchingMetrics, [metricsKey]: true });

    try {
      const response = await fetch(`/api/admin/usage/${userId}`);
      const data = await response.json();
      
      setUserMetrics({
        ...userMetrics,
        [metricsKey]: {
          status: response.status,
          data: data,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      setUserMetrics({
        ...userMetrics,
        [metricsKey]: {
          error: err instanceof Error ? err.message : 'Failed to fetch metrics',
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      setFetchingMetrics({ ...fetchingMetrics, [metricsKey]: false });
    }
  };

  const syncUsername = async (userId: string) => {
    const syncKey = `sync-${userId}`;
    setTestingHopsworks({ ...testingHopsworks, [syncKey]: true });

    try {
      const response = await fetch('/api/admin/sync-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Success: ${data.message}`);
        // Refresh users list to show updated username
        fetchUsers();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Failed to sync: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTestingHopsworks({ ...testingHopsworks, [syncKey]: false });
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
      } else {
        setError(data.error || 'Failed to trigger collection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger usage collection');
    } finally {
      setCollectingUsage(false);
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
              <Flex justify="between" align="center" className="mb-4">
                <Title as="h2" className="text-lg">All Users ({users.length})</Title>
                <Button
                  onClick={triggerUsageCollection}
                  disabled={collectingUsage}
                  intent="primary"
                >
                  {collectingUsage ? 'Collecting...' : 'Force Consumption Collection'}
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
                  {collectionResult.result?.results?.errors?.length > 0 && (
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
                    <tr className="border-b border-grayShade2">
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">HW Username</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Admin</th>
                      <th className="text-left py-2">Cluster</th>
                      <th className="text-left py-2">Logins</th>
                      <th className="text-left py-2">Credits Used</th>
                      <th className="text-left py-2">Created</th>
                      <th className="text-left py-2">Actions</th>
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
                          <Flex align="center" gap={4}>
                            <Text className="font-mono text-sm">
                              {user.hopsworks_username || '-'}
                            </Text>
                            {!user.hopsworks_username && user.user_hopsworks_assignments?.[0] && (
                              <Button
                                onClick={() => syncUsername(user.id)}
                                disabled={testingHopsworks[`sync-${user.id}`]}
                                className="text-xs px-2 py-1"
                                intent="secondary"
                              >
                                {testingHopsworks[`sync-${user.id}`] ? '...' : 'Sync'}
                              </Button>
                            )}
                          </Flex>
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
                          <Text className="text-gray">{new Date(user.created_at).toLocaleDateString()}</Text>
                        </td>
                        <td className="py-2">
                          {user.user_hopsworks_assignments?.[0] ? (
                            <Flex gap={8}>
                              <Button
                                onClick={() => testHopsworksConnection(user.id)}
                                disabled={testingHopsworks[`hopsworks-${user.id}`]}
                                className="text-sm px-3 py-1"
                              >
                                {testingHopsworks[`hopsworks-${user.id}`] ? 'Testing...' : 'Test API'}
                              </Button>
                              <Button
                                onClick={() => fetchUserMetrics(user.id)}
                                disabled={fetchingMetrics[`metrics-${user.id}`]}
                                className="text-sm px-3 py-1"
                                intent="secondary"
                              >
                                {fetchingMetrics[`metrics-${user.id}`] ? 'Loading...' : 'Get Metrics'}
                              </Button>
                            </Flex>
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
                        <Box>
                          {/* Show Kubernetes metrics in a better format */}
                          {result.data?.kubernetesMetrics?.available && result.data?.kubernetesMetrics?.userMetrics && (
                            <Box className="mb-4">
                              <Text className="font-semibold mb-2">Kubernetes Metrics</Text>
                              <Box className="bg-successShade1 p-3 rounded mb-2">
                                <Flex justify="between" className="mb-2">
                                  <Text className="text-sm">Total CPU Usage:</Text>
                                  <Text className="text-sm font-mono">{result.data.kubernetesMetrics.userMetrics.totals.cpuCores.toFixed(3)} cores</Text>
                                </Flex>
                                <Flex justify="between" className="mb-2">
                                  <Text className="text-sm">Total Memory:</Text>
                                  <Text className="text-sm font-mono">{result.data.kubernetesMetrics.userMetrics.totals.memoryGB.toFixed(2)} GB</Text>
                                </Flex>
                                <Flex justify="between">
                                  <Text className="text-sm">Projects:</Text>
                                  <Text className="text-sm font-mono">{result.data.kubernetesMetrics.userMetrics.projects.length}</Text>
                                </Flex>
                              </Box>
                              {result.data.kubernetesMetrics.userMetrics.projects.map((project: any) => (
                                <Card key={project.namespace} className="border border-grayShade2 p-2 mb-2">
                                  <Text className="font-semibold text-sm mb-1">{project.projectName} (ID: {project.projectId})</Text>
                                  <Flex gap={16} className="text-xs">
                                    <Text>CPU: {project.resources.cpuCores.toFixed(3)} cores</Text>
                                    <Text>Memory: {project.resources.memoryGB.toFixed(2)} GB</Text>
                                    <Text>Pods: {project.pods.length}</Text>
                                  </Flex>
                                </Card>
                              ))}
                            </Box>
                          )}
                          
                          {/* Show raw data in collapsible */}
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-gray hover:text-primaryDefault">View Raw Data</summary>
                            <Box className="bg-grayShade1 p-2 rounded overflow-x-auto mt-2">
                              <pre className="text-xs">
                                {JSON.stringify(result.data, null, 2)}
                              </pre>
                            </Box>
                          </details>
                        </Box>
                      )}
                    </Card>
                  ))}
                </Box>
              </Card>
            )}

            {/* User Metrics Results */}
            {Object.keys(userMetrics).length > 0 && (
              <Card withShadow className="mt-4">
                <Title as="h3" className="text-lg mb-4">User Consumption Metrics</Title>
                <Box className="space-y-4">
                  {Object.entries(userMetrics).map(([key, result]) => {
                    const userId = key.replace('metrics-', '');
                    const user = users.find(u => u.id === userId);
                    
                    return (
                      <Card key={key} className="border border-grayShade2 p-4">
                        <Flex justify="between" align="center" className="mb-4">
                          <Box>
                            <Text className="font-semibold">{user?.email || key}</Text>
                            <Text className="text-xs text-gray">{result.timestamp}</Text>
                          </Box>
                        </Flex>
                        
                        {result.error ? (
                          <Text className="text-errorDefault">Error: {result.error}</Text>
                        ) : result.data ? (
                          <Box className="space-y-4">
                            {/* Consumption Summary */}
                            {result.data.consumption && (
                              <Box>
                                <Text className="font-semibold mb-2">Current Consumption</Text>
                                <Box className="grid grid-cols-3 gap-4">
                                  <Box className="bg-grayShade1 p-3 rounded">
                                    <Text className="text-sm text-gray">Compute</Text>
                                    <Text className="font-mono">
                                      CPU: {result.data.consumption.compute.cpuHours.toFixed(2)}h
                                    </Text>
                                    <Text className="font-mono">
                                      GPU: {result.data.consumption.compute.gpuHours.toFixed(2)}h
                                    </Text>
                                  </Box>
                                  <Box className="bg-grayShade1 p-3 rounded">
                                    <Text className="text-sm text-gray">Storage</Text>
                                    <Text className="font-mono">
                                      Total: {(result.data.consumption.storage.total / 1024 / 1024 / 1024).toFixed(2)} GB
                                    </Text>
                                  </Box>
                                  <Box className="bg-grayShade1 p-3 rounded">
                                    <Text className="text-sm text-gray">API Calls</Text>
                                    <Text className="font-mono">
                                      Total: {result.data.consumption.apiCalls.total}
                                    </Text>
                                  </Box>
                                </Box>
                              </Box>
                            )}
                            
                            {/* Historical Totals */}
                            {result.data.historicalTotals && (
                              <Box>
                                <Text className="font-semibold mb-2">Historical Usage (30 days)</Text>
                                <Box className="bg-grayShade1 p-3 rounded">
                                  <Text className="font-mono text-sm">
                                    CPU Hours: {result.data.historicalTotals.cpu_hours.toFixed(2)}
                                  </Text>
                                  <Text className="font-mono text-sm">
                                    GPU Hours: {result.data.historicalTotals.gpu_hours.toFixed(2)}
                                  </Text>
                                  <Text className="font-mono text-sm">
                                    Storage GB-Months: {result.data.historicalTotals.storage_gb_months.toFixed(2)}
                                  </Text>
                                  <Text className="font-mono text-sm">
                                    API Calls: {result.data.historicalTotals.api_calls}
                                  </Text>
                                  <Text className="font-mono text-sm font-semibold">
                                    Total Cost: ${result.data.historicalTotals.total_cost.toFixed(2)}
                                  </Text>
                                </Box>
                              </Box>
                            )}
                            
                            {/* Projects Summary */}
                            {result.data.projects && result.data.projects.length > 0 && (
                              <Box>
                                <Text className="font-semibold mb-2">Projects ({result.data.projects.length})</Text>
                                {result.data.projects.map((project: any) => (
                                  <Box key={project.id} className="bg-grayShade1 p-3 rounded mb-2">
                                    <Text className="font-medium">{project.name}</Text>
                                    <Text className="text-sm text-gray">
                                      Datasets: {project.datasets?.length || 0} | 
                                      Feature Stores: {project.featureStores?.length || 0} | 
                                      Jobs: {project.jobs?.length || 0}
                                    </Text>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            
                            {/* Full Data Toggle */}
                            <details>
                              <summary className="cursor-pointer text-sm text-gray">View Full Response</summary>
                              <Box className="bg-grayShade1 p-2 rounded overflow-x-auto mt-2">
                                <pre className="text-xs">
                                  {JSON.stringify(result.data, null, 2)}
                                </pre>
                              </Box>
                            </details>
                          </Box>
                        ) : (
                          <Text className="text-gray">No data</Text>
                        )}
                      </Card>
                    );
                  })}
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
                        {editingCluster === cluster.id ? (
                          <Box>
                            <Box className="grid grid-cols-2 gap-4 mb-4">
                              <Input
                                value={cluster.name}
                                onChange={(e) => {
                                  const updated = clusters.map(c => 
                                    c.id === cluster.id ? {...c, name: e.target.value} : c
                                  );
                                  setClusters(updated);
                                }}
                                placeholder="Cluster Name"
                              />
                              <Input
                                value={cluster.api_url}
                                onChange={(e) => {
                                  const updated = clusters.map(c => 
                                    c.id === cluster.id ? {...c, api_url: e.target.value} : c
                                  );
                                  setClusters(updated);
                                }}
                                placeholder="API URL"
                              />
                              <Input
                                value={cluster.max_users}
                                type="number"
                                onChange={(e) => {
                                  const updated = clusters.map(c => 
                                    c.id === cluster.id ? {...c, max_users: parseInt(e.target.value) || 0} : c
                                  );
                                  setClusters(updated);
                                }}
                                placeholder="Max Users"
                              />
                              <Input
                                value={cluster.api_key}
                                type="password"
                                onChange={(e) => {
                                  const updated = clusters.map(c => 
                                    c.id === cluster.id ? {...c, api_key: e.target.value} : c
                                  );
                                  setClusters(updated);
                                }}
                                placeholder="API Key (leave blank to keep current)"
                              />
                            </Box>
                            <Flex gap={8}>
                              <Button
                                intent="primary"
                                onClick={() => {
                                  const editedCluster = clusters.find(c => c.id === cluster.id)!;
                                  handleUpdateCluster(cluster.id, editedCluster);
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingCluster(null);
                                  fetchClusters();
                                }}
                              >
                                Cancel
                              </Button>
                            </Flex>
                          </Box>
                        ) : (
                          <Box>
                            <Box className="grid grid-cols-2 gap-4 mb-4">
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
                              <Box className="col-span-2">
                                <Text className="text-sm text-gray mb-1">Kubeconfig</Text>
                                <Badge variant={cluster.kubeconfig ? 'success' : 'warning'}>
                                  {cluster.kubeconfig ? 'Configured' : 'Not Configured'}
                                </Badge>
                              </Box>
                            </Box>
                            <Flex gap={8}>
                              <Button
                                onClick={() => setEditingCluster(cluster.id)}
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => setKubeconfigModal(cluster.id)}
                              >
                                {cluster.kubeconfig ? 'Update' : 'Upload'} Kubeconfig
                              </Button>
                            </Flex>
                          </Box>
                        )}
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

    {/* Kubeconfig Upload Modal */}
    {kubeconfigModal && (
      <Box className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="max-w-2xl w-full mx-4 p-6">
          <Title as="h3" className="text-lg mb-4">Upload Kubeconfig</Title>
          <Text className="text-sm text-gray mb-4">
            Paste the contents of your kubeconfig.yml file to enable Kubernetes metrics collection
          </Text>
          <textarea
            className="w-full h-64 p-2 border border-grayShade2 rounded font-mono text-sm"
            placeholder="apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ...
    server: https://..."
            onChange={(e) => {
              const elem = e.target as HTMLTextAreaElement;
              elem.dataset.kubeconfig = elem.value;
            }}
          />
          <Flex gap={8} className="mt-4">
            <Button
              intent="primary"
              onClick={() => {
                const textarea = document.querySelector('textarea[placeholder*="apiVersion"]') as HTMLTextAreaElement;
                if (textarea?.dataset.kubeconfig) {
                  handleUploadKubeconfig(kubeconfigModal, textarea.dataset.kubeconfig);
                }
              }}
            >
              Upload
            </Button>
            <Button onClick={() => setKubeconfigModal(null)}>
              Cancel
            </Button>
          </Flex>
        </Card>
      </Box>
    )}
    </>
  );
}