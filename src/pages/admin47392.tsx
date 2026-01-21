import { useUser } from '@auth0/nextjs-auth0/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Flex, Title, Text, Button, Card, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from 'tailwind-quartz';
import { Edit2, Server } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_login_at: string;
  login_count: number;
  status: string;
  deleted_at?: string;
  deletion_reason?: string;
  is_admin: boolean;
  account_owner_id?: string;
  hopsworks_username?: string;
  billing_mode?: string;
  promo_code?: string;
  spending_cap?: number | null;
  metadata?: {
    corporate_ref?: string;
    [key: string]: any;
  };
  projects?: {
    namespace: string;
    name: string;
    id: number;
    is_owner: boolean;
    total_cost: number;
    cpu_hours: number;
    gpu_hours: number;
    ram_gb_hours: number;
  }[];
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
  status: string;
  current_users: number;
  max_users: number;
  region?: string;
  created_at: string;
}

export default function AdminPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 20;
  const [actionLoading, setActionLoading] = useState<{ [userId: string]: boolean }>({});
  const [editMetadataUser, setEditMetadataUser] = useState<User | null>(null);
  const [metadataForm, setMetadataForm] = useState({
    promoCode: '',
    corporateRef: '',
    clusterId: '',
    spendingCap: ''
  });
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [editCluster, setEditCluster] = useState<Cluster | null>(null);
  const [clusterForm, setClusterForm] = useState({
    name: '',
    region: '',
    status: '',
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

  const fetchClusters = async () => {
    try {
      const response = await fetch('/api/admin/clusters');
      if (response.ok) {
        const data = await response.json();
        setClusters(data.clusters || []);
      } else {
        setError('Failed to fetch clusters');
      }
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
      setError('Failed to fetch clusters');
    } finally {
      setLoadingClusters(false);
    }
  };

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

  const getUserTodayCost = (user: User) => {
    if (!user.projects || user.projects.length === 0) return 0;
    return user.projects.reduce((sum, project) => sum + project.total_cost, 0);
  };

  const suspendUser = async (userId: string, email: string) => {
    const reason = prompt(`Suspend user ${email}?\n\nOptional reason:`);
    if (reason === null) return; // User cancelled

    setActionLoading(prev => ({ ...prev, [userId]: true }));
    setError(null);
    try {
      const response = await fetch('/api/admin/suspend-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: reason || 'admin_action' })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`User ${email} suspended successfully.\n\nSupabase: ${data.supabaseUpdated ? '✓' : '✗'}\nHopsworks: ${data.hopsworksUpdated ? '✓' : '✗'}`);
        fetchUsers(); // Refresh
      } else {
        setError(`Failed to suspend user: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to suspend user:', error);
      setError('Failed to suspend user');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const reactivateUser = async (userId: string, email: string) => {
    if (!confirm(`Reactivate user ${email}?`)) return;

    setActionLoading(prev => ({ ...prev, [userId]: true }));
    setError(null);
    try {
      const response = await fetch('/api/admin/reactivate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: 'admin_action' })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`User ${email} reactivated successfully.\n\nSupabase: ${data.supabaseUpdated ? '✓' : '✗'}\nHopsworks: ${data.hopsworksUpdated ? '✓' : '✗'}`);
        fetchUsers(); // Refresh
      } else {
        setError(`Failed to reactivate user: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to reactivate user:', error);
      setError('Failed to reactivate user');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const openMetadataModal = (user: User) => {
    const currentClusterId = user.user_hopsworks_assignments?.[0]?.hopsworks_cluster_id || '';

    setEditMetadataUser(user);
    setMetadataForm({
      promoCode: user.promo_code || '',
      corporateRef: user.metadata?.corporate_ref || '',
      clusterId: currentClusterId,
      spendingCap: user.spending_cap !== null && user.spending_cap !== undefined ? String(user.spending_cap) : ''
    });
  };

  const closeMetadataModal = () => {
    setEditMetadataUser(null);
    setMetadataForm({ promoCode: '', corporateRef: '', clusterId: '', spendingCap: '' });
  };

  const openClusterModal = (cluster: Cluster) => {
    setEditCluster(cluster);
    setClusterForm({
      name: cluster.name,
      region: cluster.region || '',
      status: cluster.status,
      max_users: cluster.max_users
    });
  };

  const closeClusterModal = () => {
    setEditCluster(null);
    setClusterForm({ name: '', region: '', status: '', max_users: 100 });
  };

  const saveCluster = async () => {
    if (!editCluster) return;

    setActionLoading(prev => ({ ...prev, [editCluster.id]: true }));
    setError(null);
    try {
      const response = await fetch('/api/admin/clusters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editCluster.id,
          name: clusterForm.name,
          region: clusterForm.region || null,
          status: clusterForm.status,
          max_users: clusterForm.max_users
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Cluster ${clusterForm.name} updated successfully`);
        closeClusterModal();
        fetchClusters(); // Refresh
      } else {
        setError(`Failed to update cluster: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to update cluster:', error);
      setError('Failed to update cluster');
    } finally {
      setActionLoading(prev => ({ ...prev, [editCluster.id]: false }));
    }
  };

  const saveMetadata = async () => {
    if (!editMetadataUser) return;

    setActionLoading(prev => ({ ...prev, [editMetadataUser.id]: true }));
    setError(null);
    try {
      // Update metadata
      const metadataResponse = await fetch('/api/admin/update-user-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editMetadataUser.id,
          promoCode: metadataForm.promoCode,
          corporateRef: metadataForm.corporateRef
        })
      });

      if (!metadataResponse.ok) {
        const data = await metadataResponse.json();
        setError(`Failed to update metadata: ${data.error}`);
        setActionLoading(prev => ({ ...prev, [editMetadataUser.id]: false }));
        return;
      }

      // Update spending cap if changed
      const currentCap = editMetadataUser.spending_cap !== null && editMetadataUser.spending_cap !== undefined
        ? String(editMetadataUser.spending_cap)
        : '';
      if (metadataForm.spendingCap !== currentCap) {
        const capResponse = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editMetadataUser.id,
            spendingCap: metadataForm.spendingCap === '' ? null : metadataForm.spendingCap
          })
        });

        if (!capResponse.ok) {
          const data = await capResponse.json();
          alert(`Metadata updated but spending cap failed: ${data.error}`);
        }
      }

      // Update cluster assignment if changed
      const currentClusterId = editMetadataUser.user_hopsworks_assignments?.[0]?.hopsworks_cluster_id;
      if (metadataForm.clusterId && metadataForm.clusterId !== currentClusterId) {
        // First remove old assignment if exists
        if (currentClusterId) {
          await fetch('/api/admin/users', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: editMetadataUser.id,
              clusterId: currentClusterId
            })
          });
        }

        // Then assign new cluster
        const assignResponse = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editMetadataUser.id })
        });

        if (!assignResponse.ok) {
          const data = await assignResponse.json();
          alert(`Metadata updated but cluster assignment failed: ${data.error}`);
        }
      }

      alert(`Successfully updated ${editMetadataUser.email}`);
      closeMetadataModal();
      fetchUsers(); // Refresh
    } catch (error) {
      console.error('Failed to update:', error);
      setError('Failed to update user');
    } finally {
      setActionLoading(prev => ({ ...prev, [editMetadataUser.id]: false }));
    }
  };

  const changeBillingMode = async (userId: string, email: string, currentMode: string) => {
    const newMode = currentMode === 'prepaid' ? 'postpaid' : 'prepaid';
    if (!confirm(`Change billing mode for ${email} from ${currentMode} to ${newMode}?`)) return;

    setActionLoading(prev => ({ ...prev, [userId]: true }));
    setError(null);
    try {
      const response = await fetch('/api/admin/change-billing-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, billingMode: newMode })
      });

      const data = await response.json();

      if (response.ok) {
        // If switching to prepaid, automatically assign cluster after 5 seconds
        if (newMode === 'prepaid') {
          alert(`Billing mode changed to prepaid.\n\nCluster will be assigned automatically in 5 seconds...`);

          setTimeout(async () => {
            try {
              const assignResponse = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
              });

              if (assignResponse.ok) {
                console.log(`Cluster assigned successfully for ${email}`);
              } else {
                const assignData = await assignResponse.json();
                console.error(`Failed to assign cluster: ${assignData.error}`);
              }

              fetchUsers(); // Refresh after assignment
            } catch (error) {
              console.error('Failed to assign cluster:', error);
            }
          }, 5000);
        } else {
          alert(`Billing mode changed successfully.\n\nUser: ${email}\nPrevious: ${currentMode}\nNew: ${newMode}`);
        }

        fetchUsers(); // Immediate refresh
      } else {
        setError(`Failed to change billing mode: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to change billing mode:', error);
      setError('Failed to change billing mode');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (isLoading || loadingUsers) {
    return (
      <Flex align="center" justify="center" className="min-h-screen">
        <Text>Loading...</Text>
      </Flex>
    );
  }

  // Pagination
  const totalPages = Math.ceil(users.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);

  return (
    <>
      <Navbar />
      <Box className="min-h-screen bg-surfaceShade1 p-4">
        <Box className="max-w-7xl mx-auto">
          <Title as="h1" className="text-2xl mb-8">Admin</Title>

          {error && (
            <Card className="mb-4 border-errorDefault bg-errorShade1">
              <Text className="text-errorDefault">{error}</Text>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="clusters">Clusters</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card withShadow>
                <Title as="h2" className="text-lg mb-6">Users Overview</Title>
            
            <Box className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grayShade2 text-xs font-semibold uppercase text-gray">
                    <th className="text-left py-4 px-4">User</th>
                    <th className="text-left py-4 px-4">Status</th>
                    <th className="text-left py-4 px-4">Billing</th>
                    <th className="text-left py-4 px-4">Cluster</th>
                    <th className="text-right py-4 px-4">Today&apos;s Cost</th>
                    <th className="text-right py-4 px-4">Projects</th>
                    <th className="text-right py-4 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray">
                        No users found in the system.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map(user => {
                      const todayCost = getUserTodayCost(user);
                      const isDeleted = !!user.deleted_at;

                      return (
                        <tr key={user.id} className={`border-b border-grayShade1 hover:bg-grayShade1/30 ${isDeleted ? 'opacity-60' : ''}`}>
                          <td className="py-4 px-4">
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
                          <td className="py-4 px-4">
                            {isDeleted ? (
                              <Box>
                                <Badge size="sm" variant="error">Deleted</Badge>
                                <Text className="text-xs text-gray mt-1">
                                  {new Date(user.deleted_at!).toLocaleDateString()}
                                </Text>
                                {user.deletion_reason && (
                                  <Text className="text-xs text-gray">
                                    {user.deletion_reason.replace('_', ' ')}
                                  </Text>
                                )}
                              </Box>
                            ) : user.status === 'suspended' ? (
                              <Box>
                                <Badge size="sm" variant="warning">Suspended</Badge>
                                <Text className="text-xs text-gray mt-1">
                                  Requires review
                                </Text>
                              </Box>
                            ) : user.account_owner_id ? (
                              <Badge size="sm" variant="default">Team Member</Badge>
                            ) : (
                              <Badge size="sm" variant="success">Active</Badge>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {user.account_owner_id ? (
                              <Text className="text-xs text-gray">-</Text>
                            ) : (
                              <Box className="flex items-center gap-2">
                                <Badge
                                  size="sm"
                                  variant={user.billing_mode === 'prepaid' ? 'default' : 'primary'}
                                >
                                  {user.billing_mode || 'postpaid'}
                                </Badge>
                                {!isDeleted && user.status === 'active' && (
                                  <Button
                                    onClick={() => changeBillingMode(user.id, user.email, user.billing_mode || 'postpaid')}
                                    disabled={actionLoading[user.id]}
                                    intent="secondary"
                                    size="sm"
                                    className="text-xs px-3 py-1"
                                  >
                                    Switch
                                  </Button>
                                )}
                              </Box>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {user.user_hopsworks_assignments?.[0] ? (
                              <Badge size="sm" variant="default">
                                {user.user_hopsworks_assignments[0].hopsworks_clusters.name}
                              </Badge>
                            ) : (
                              <Text className="text-xs text-gray">No cluster</Text>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {todayCost > 0 ? (
                              <Box>
                                <Text className="font-mono">
                                  ${todayCost.toFixed(4)}
                                </Text>
                                {user.spending_cap && (
                                  <Text className="text-xs text-gray">
                                    Cap: ${user.spending_cap}
                                  </Text>
                                )}
                              </Box>
                            ) : (
                              <Box>
                                <Text className="text-xs text-gray">-</Text>
                                {user.spending_cap && (
                                  <Text className="text-xs text-gray">
                                    Cap: ${user.spending_cap}
                                  </Text>
                                )}
                              </Box>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {user.projects && user.projects.length > 0 ? (
                              <Badge size="sm" variant="default">
                                {user.projects.length}
                              </Badge>
                            ) : (
                              <Text className="text-xs text-gray">0</Text>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {isDeleted ? (
                              <Text className="text-xs text-gray">-</Text>
                            ) : user.status === 'suspended' ? (
                              <Box className="flex gap-2 justify-end">
                                <Button
                                  onClick={() => reactivateUser(user.id, user.email)}
                                  disabled={actionLoading[user.id]}
                                  intent="primary"
                                  size="sm"
                                >
                                  {actionLoading[user.id] ? 'Loading...' : 'Unsuspend'}
                                </Button>
                                {!user.account_owner_id && (
                                  <Button
                                    onClick={() => openMetadataModal(user)}
                                    disabled={actionLoading[user.id]}
                                    intent="secondary"
                                    size="sm"
                                    className="px-2"
                                  >
                                    <Edit2 size={14} />
                                  </Button>
                                )}
                              </Box>
                            ) : user.status === 'active' ? (
                              <Box className="flex gap-2 justify-end">
                                <Button
                                  onClick={() => suspendUser(user.id, user.email)}
                                  disabled={actionLoading[user.id]}
                                  intent="secondary"
                                  size="sm"
                                >
                                  {actionLoading[user.id] ? 'Loading...' : 'Suspend'}
                                </Button>
                                {!user.account_owner_id && (
                                  <Button
                                    onClick={() => openMetadataModal(user)}
                                    disabled={actionLoading[user.id]}
                                    intent="secondary"
                                    size="sm"
                                    className="px-2"
                                  >
                                    <Edit2 size={14} />
                                  </Button>
                                )}
                              </Box>
                            ) : (
                              <Text className="text-xs text-gray">-</Text>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Box>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="center" align="center" className="mt-4 gap-2">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  size="sm"
                  intent="secondary"
                >
                  Previous
                </Button>
                <Text className="text-sm px-4">
                  Page {currentPage} of {totalPages}
                </Text>
                <Button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  size="sm"
                  intent="secondary"
                >
                  Next
                </Button>
              </Flex>
            )}
            
            {/* Summary */}
            {users.length > 0 && (
              <Box className="mt-6 pt-4 border-t border-grayShade2">
                <Flex justify="between" align="center">
                  <Text className="text-sm text-gray">
                    Total Users: {users.length} | With Activity: {users.filter(u => (u.projects && u.projects.length > 0)).length}
                    {totalPages > 1 && ` | Showing ${startIndex + 1}-${Math.min(endIndex, users.length)}`}
                  </Text>
                  <Box className="text-right">
                    <Text className="text-sm text-gray">Total Today&apos;s Cost (All Users)</Text>
                    <Text className="font-mono font-semibold text-lg">
                      ${users.reduce((sum, u) => sum + getUserTodayCost(u), 0).toFixed(2)}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )}
              </Card>
            </TabsContent>

            <TabsContent value="clusters">
              <Card withShadow>
                <Title as="h2" className="text-lg mb-6">Clusters Overview</Title>

                <Box className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-grayShade2 text-xs font-semibold uppercase text-gray">
                        <th className="text-left py-4 px-4">Cluster</th>
                        <th className="text-left py-4 px-4">Region</th>
                        <th className="text-left py-4 px-4">Status</th>
                        <th className="text-right py-4 px-4">Users</th>
                        <th className="text-right py-4 px-4">Capacity</th>
                        <th className="text-left py-4 px-4">API URL</th>
                        <th className="text-right py-4 px-4">Created</th>
                        <th className="text-right py-4 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingClusters ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray">
                            Loading clusters...
                          </td>
                        </tr>
                      ) : clusters.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray">
                            No clusters found.
                          </td>
                        </tr>
                      ) : (
                        clusters.map(cluster => (
                          <tr key={cluster.id} className="border-b border-grayShade1 hover:bg-grayShade1/30">
                            <td className="py-4 px-4">
                              <Box className="flex items-center gap-2">
                                <Server size={16} className="text-gray" />
                                <Text className="font-medium">{cluster.name}</Text>
                              </Box>
                            </td>
                            <td className="py-4 px-4">
                              {cluster.region ? (
                                <Badge size="sm" variant="default">{cluster.region}</Badge>
                              ) : (
                                <Text className="text-xs text-gray">-</Text>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <Badge
                                size="sm"
                                variant={cluster.status === 'active' ? 'success' : 'default'}
                              >
                                {cluster.status}
                              </Badge>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Text className="font-mono">{cluster.current_users}</Text>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Text className="font-mono">{cluster.max_users}</Text>
                            </td>
                            <td className="py-4 px-4">
                              <Text className="text-xs text-gray font-mono truncate max-w-xs">
                                {cluster.api_url}
                              </Text>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Text className="text-xs text-gray">
                                {new Date(cluster.created_at).toLocaleDateString()}
                              </Text>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Button
                                onClick={() => openClusterModal(cluster)}
                                disabled={actionLoading[cluster.id]}
                                intent="secondary"
                                size="sm"
                                className="px-2"
                              >
                                <Edit2 size={14} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </Box>

                {/* Summary */}
                {clusters.length > 0 && (
                  <Box className="mt-6 pt-4 border-t border-grayShade2">
                    <Flex justify="between" align="center">
                      <Text className="text-sm text-gray">
                        Total Clusters: {clusters.length} | Active: {clusters.filter(c => c.status === 'active').length}
                      </Text>
                      <Box className="text-right">
                        <Text className="text-sm text-gray">Total Capacity</Text>
                        <Text className="font-mono font-semibold text-lg">
                          {clusters.reduce((sum, c) => sum + c.current_users, 0)} / {clusters.reduce((sum, c) => sum + c.max_users, 0)}
                        </Text>
                      </Box>
                    </Flex>
                  </Box>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </Box>

        {/* Metadata Edit Modal */}
        {editMetadataUser && (
          <Box
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={closeMetadataModal}
          >
            <Card
              className="w-full max-w-md mx-4"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              withShadow
            >
              <Title as="h3" className="text-lg mb-4">
                Edit Metadata: {editMetadataUser.email}
              </Title>

              <Box className="space-y-4">
                <Box>
                  <Text className="text-sm font-medium mb-1">Promo Code</Text>
                  <input
                    type="text"
                    value={metadataForm.promoCode}
                    onChange={(e) => setMetadataForm(prev => ({ ...prev, promoCode: e.target.value }))}
                    placeholder="e.g., STARTUP2024"
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  />
                  <Text className="text-xs text-gray mt-1">Leave empty to clear</Text>
                </Box>

                <Box>
                  <Text className="text-sm font-medium mb-1">Corporate Reference</Text>
                  <input
                    type="text"
                    value={metadataForm.corporateRef}
                    onChange={(e) => setMetadataForm(prev => ({ ...prev, corporateRef: e.target.value }))}
                    placeholder="e.g., DEAL-12345"
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  />
                  <Text className="text-xs text-gray mt-1">HubSpot deal ID or corporate reference</Text>
                </Box>

                <Box>
                  <Text className="text-sm font-medium mb-1">Spending Cap</Text>
                  <input
                    type="number"
                    value={metadataForm.spendingCap}
                    onChange={(e) => setMetadataForm(prev => ({ ...prev, spendingCap: e.target.value }))}
                    placeholder="e.g., 100 (leave empty to disable)"
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  />
                  <Text className="text-xs text-gray mt-1">Monthly spending cap in USD. Leave empty to disable.</Text>
                </Box>

                <Box>
                  <Text className="text-sm font-medium mb-1">Cluster Assignment</Text>
                  <select
                    value={metadataForm.clusterId}
                    onChange={(e) => setMetadataForm(prev => ({ ...prev, clusterId: e.target.value }))}
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  >
                    <option value="">No cluster assigned</option>
                    {clusters.map(cluster => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.name} ({cluster.current_users}/{cluster.max_users})
                      </option>
                    ))}
                  </select>
                  <Text className="text-xs text-gray mt-1">
                    Assign or change user cluster (Current: {metadataForm.clusterId || 'none'})
                  </Text>
                </Box>

                <Flex justify="end" className="gap-2 mt-6">
                  <Button
                    onClick={closeMetadataModal}
                    intent="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveMetadata}
                    disabled={actionLoading[editMetadataUser.id]}
                    intent="primary"
                    size="sm"
                  >
                    {actionLoading[editMetadataUser.id] ? 'Saving...' : 'Save'}
                  </Button>
                </Flex>
              </Box>
            </Card>
          </Box>
        )}

        {/* Cluster Edit Modal */}
        {editCluster && (
          <Box
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={closeClusterModal}
          >
            <Card
              className="w-full max-w-md mx-4"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              withShadow
            >
              <Title as="h3" className="text-lg mb-4">
                Edit Cluster: {editCluster.name}
              </Title>

              <Box className="space-y-4">
                <Box>
                  <Text className="text-sm font-medium mb-1">Cluster Name</Text>
                  <input
                    type="text"
                    value={clusterForm.name}
                    onChange={(e) => setClusterForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., dev-cloud"
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  />
                </Box>

                <Box>
                  <Text className="text-sm font-medium mb-1">Region</Text>
                  <input
                    type="text"
                    value={clusterForm.region}
                    onChange={(e) => setClusterForm(prev => ({ ...prev, region: e.target.value }))}
                    placeholder="e.g., eu-west-1, us-east-1"
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  />
                  <Text className="text-xs text-gray mt-1">AWS region or datacenter location</Text>
                </Box>

                <Box>
                  <Text className="text-sm font-medium mb-1">Status</Text>
                  <select
                    value={clusterForm.status}
                    onChange={(e) => setClusterForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </Box>

                <Box>
                  <Text className="text-sm font-medium mb-1">Max Users (Capacity)</Text>
                  <input
                    type="number"
                    value={clusterForm.max_users}
                    onChange={(e) => setClusterForm(prev => ({ ...prev, max_users: parseInt(e.target.value) || 100 }))}
                    min="1"
                    className="w-full px-3 py-2 border border-grayShade2 rounded-md bg-surfaceShade1 text-sm"
                  />
                  <Text className="text-xs text-gray mt-1">
                    Current: {editCluster.current_users} / {editCluster.max_users}
                  </Text>
                </Box>

                <Flex justify="end" className="gap-2 mt-6">
                  <Button
                    onClick={closeClusterModal}
                    intent="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveCluster}
                    disabled={actionLoading[editCluster.id]}
                    intent="primary"
                    size="sm"
                  >
                    {actionLoading[editCluster.id] ? 'Saving...' : 'Save'}
                  </Button>
                </Flex>
              </Box>
            </Card>
          </Box>
        )}
      </Box>
    </>
  );
}