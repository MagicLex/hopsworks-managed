import { useUser } from '@auth0/nextjs-auth0/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
// Using native HTML elements instead of custom UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

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
  instances?: {
    instance_name: string;
    status: string;
    hopsworks_url: string;
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

  if (isLoading || loadingUsers || loadingClusters) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="clusters">Clusters</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">All Users ({users.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Admin</th>
                      <th className="text-left py-2">Logins</th>
                      <th className="text-left py-2">Credits Used</th>
                      <th className="text-left py-2">Instance</th>
                      <th className="text-left py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b">
                        <td className="py-2">{user.email}</td>
                        <td className="py-2">{user.name || '-'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-2">{user.is_admin ? '✓' : '-'}</td>
                        <td className="py-2">{user.login_count}</td>
                        <td className="py-2">
                          ${user.user_credits?.total_used?.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-2">
                          {user.instances?.[0]?.status || '-'}
                        </td>
                        <td className="py-2">{new Date(user.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="clusters">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Cluster Configuration</h2>
              
              {/* Existing clusters */}
              {clusters.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium mb-2">Current Clusters</h3>
                  <div className="space-y-4">
                    {clusters.map(cluster => (
                      <div key={cluster.id} className="border rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Name</p>
                            <p className="font-medium">{cluster.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Status</p>
                            <p className={`font-medium ${
                              cluster.status === 'active' ? 'text-green-600' : 'text-gray-600'
                            }`}>{cluster.status}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">API URL</p>
                            <p className="text-sm">{cluster.api_url}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Users</p>
                            <p className="text-sm">{cluster.current_users} / {cluster.max_users}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new cluster */}
              <div>
                <h3 className="text-lg font-medium mb-2">Add New Cluster</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Cluster Name"
                    value={newCluster.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, name: e.target.value})}
                  />
                  <input
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="API URL"
                    value={newCluster.api_url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, api_url: e.target.value})}
                  />
                  <input
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="API Key"
                    type="password"
                    value={newCluster.api_key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, api_key: e.target.value})}
                  />
                  <input
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Max Users"
                    type="number"
                    value={newCluster.max_users}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCluster({...newCluster, max_users: parseInt(e.target.value) || 100})}
                  />
                </div>
                <button 
                  onClick={handleCreateCluster}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={!newCluster.name || !newCluster.api_url}
                >
                  Create Cluster
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}