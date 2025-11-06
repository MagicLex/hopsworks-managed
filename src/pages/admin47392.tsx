import { useUser } from '@auth0/nextjs-auth0/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
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

export default function AdminPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 20;
  const [actionLoading, setActionLoading] = useState<{ [userId: string]: boolean }>({});

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

  const syncProjects = async () => {
    setSyncingProjects(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/sync-projects', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        console.log('Project sync result:', data);
        alert(`Projects synced!\n- Found ${data.stats.projectsInHopsworks} projects in Hopsworks\n- Deleted ${data.stats.deletedProjects} stale projects\n- Updated ${data.stats.updatedProjects} projects`);
        // Refresh users to show updated projects
        fetchUsers();
      } else {
        setError(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to sync projects:', error);
      setError('Failed to sync projects');
    } finally {
      setSyncingProjects(false);
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
          <Title as="h1" className="text-2xl mb-8">Admin Billing Dashboard</Title>
        
          {error && (
            <Card className="mb-4 border-errorDefault bg-errorShade1">
              <Text className="text-errorDefault">{error}</Text>
            </Card>
          )}

          <Card withShadow>
            <Flex justify="between" align="center" className="mb-6">
              <Title as="h2" className="text-lg">Users Overview</Title>
              <Button
                onClick={syncProjects}
                disabled={syncingProjects}
                intent="primary"
                size="md"
              >
                {syncingProjects ? 'Syncing...' : 'Sync Projects'}
              </Button>
            </Flex>
            
            <Box className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grayShade2 text-xs font-semibold uppercase text-gray">
                    <th className="text-left py-3">User</th>
                    <th className="text-left py-3">Status</th>
                    <th className="text-left py-3">Cluster</th>
                    <th className="text-right py-3">Today&apos;s Cost</th>
                    <th className="text-right py-3">Projects</th>
                    <th className="text-right py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray">
                        No users found in the system.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map(user => {
                      const todayCost = getUserTodayCost(user);
                      const isDeleted = !!user.deleted_at;

                      return (
                        <tr key={user.id} className={`border-b border-grayShade1 hover:bg-grayShade1/30 ${isDeleted ? 'opacity-60' : ''}`}>
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
                          <td className="py-3 text-right">
                            {isDeleted ? (
                              <Text className="text-xs text-gray">-</Text>
                            ) : user.status === 'suspended' ? (
                              <Button
                                onClick={() => reactivateUser(user.id, user.email)}
                                disabled={actionLoading[user.id]}
                                intent="primary"
                                size="sm"
                              >
                                {actionLoading[user.id] ? 'Loading...' : 'Unsuspend'}
                              </Button>
                            ) : user.status === 'active' && !user.account_owner_id ? (
                              <Button
                                onClick={() => suspendUser(user.id, user.email)}
                                disabled={actionLoading[user.id]}
                                intent="danger"
                                size="sm"
                              >
                                {actionLoading[user.id] ? 'Loading...' : 'Suspend'}
                              </Button>
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
        </Box>
      </Box>
    </>
  );
}