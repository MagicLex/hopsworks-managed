import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Select } from 'tailwind-quartz';
import { FolderOpen, Loader, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface Project {
  name: string;
  id: number;
  namespace: string;
  role?: string;
  synced?: boolean;
  syncError?: string;
  pending?: boolean;
}

interface TeamMemberProjectsProps {
  memberId: string;
  memberEmail: string;
  memberName: string;
  isOwner: boolean;
  ownerId: string;
}

export default function TeamMemberProjects({
  memberId,
  memberEmail,
  memberName,
  isOwner,
  ownerId
}: TeamMemberProjectsProps) {
  const [memberProjects, setMemberProjects] = useState<Project[]>([]);
  const [ownerProjects, setOwnerProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  const syncRoles = async () => {
    if (!isOwner) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/team/sync-member-roles', {
        method: 'POST'
      });

      if (!response.ok) {
        console.error('Failed to sync roles');
      } else {
        const result = await response.json();
        console.log('Sync result:', result);
      }
    } catch (error) {
      console.error('Failed to sync roles:', error);
    } finally {
      setSyncing(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);

      // Get member's current projects
      const memberResponse = await fetch(`/api/team/member-projects?memberId=${memberId}`);
      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        setMemberProjects(memberData.projects || []);
      }

      // If owner, also get owner's projects to show available ones
      if (isOwner) {
        const ownerResponse = await fetch('/api/team/owner-projects');
        if (ownerResponse.ok) {
          const ownerData = await ownerResponse.json();
          setOwnerProjects(ownerData.projects || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchProjects();
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps


  const updateProjectRole = async (projectName: string, projectId: number, role: string) => {
    if (!isOwner) return;

    try {
      setUpdating(projectName);
      setMessage(null);

      const response = await fetch('/api/team/member-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          projectName,
          projectId,
          role,
          action: 'add'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes('does not exist') || result.error?.includes('not found')) {
          setMessage({
            type: 'error',
            text: `Project '${projectName}' no longer exists.`
          });
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to update role' });
        }
        throw new Error(result.error || 'Failed to update project role');
      }

      setMessage({
        type: 'success',
        text: `Added ${memberName || memberEmail} to ${projectName} as ${role}`
      });

      await fetchProjects();
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  // For team members viewing their own access
  const isViewingOwnAccess = !isOwner && memberId === ownerId;

  // Combine all projects for the table
  const allProjects = [
    ...memberProjects.map(p => ({ ...p, status: 'assigned' as const })),
    ...(isOwner ? ownerProjects
      .filter(p => !memberProjects.some(mp => mp.name === p.name))
      .map(p => ({ ...p, status: 'available' as const }))
    : [])
  ];

  return (
    <Box className="mt-3">
      <Button
        onClick={handleToggle}
        size="sm"
        intent="ghost"
        className="text-xs"
      >
        <FolderOpen size={14} />
        {expanded ? 'Hide' : (isOwner ? 'Manage' : 'View')} Projects
      </Button>

      {expanded && (
        <Box className="mt-3">
          <Text className="text-sm font-medium mb-3">
            Project Access for {memberName || memberEmail}
          </Text>

          {message && (
            <Box
              className={`mb-3 p-2 rounded border ${
                message.type === 'error' ? 'bg-red-50 border-red-200' :
                message.type === 'success' ? 'bg-green-50 border-green-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <Flex align="center" gap={8}>
                {message.type === 'success' && <CheckCircle size={16} className="text-green-600" />}
                {message.type === 'error' && <AlertCircle size={16} className="text-red-600" />}
                <Text className={`text-sm ${
                  message.type === 'error' ? 'text-red-800' :
                  message.type === 'success' ? 'text-green-800' :
                  'text-blue-800'
                }`}>{message.text}</Text>
              </Flex>
            </Box>
          )}

          {loading || syncing ? (
            <Flex align="center" justify="center" className="py-8">
              <Loader className="animate-spin" size={20} />
              <Text className="ml-2 text-sm text-gray-600">
                {syncing ? 'Syncing...' : 'Loading...'}
              </Text>
            </Flex>
          ) : allProjects.length === 0 ? (
            <Text className="text-sm text-gray-500 py-4">No projects found</Text>
          ) : (
            <>
              {/* Show sync warning if needed */}
              {memberProjects.some(p => !p.synced) && isOwner && (
                <Box className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <Flex justify="between" align="center">
                    <Text className="text-sm text-yellow-800">
                      {memberProjects.filter(p => !p.synced).length} project(s) pending sync to Hopsworks
                    </Text>
                    <Button
                      size="sm"
                      intent="primary"
                      onClick={async () => {
                        setSyncing(true);
                        try {
                          const response = await fetch('/api/team/sync-member-projects', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ memberId })
                          });
                          const data = await response.json();
                          if (data.syncedCount > 0) {
                            setMessage({ type: 'success', text: `Synced ${data.syncedCount} project(s)` });
                          }
                          if (data.warning) {
                            setMessage({ type: 'error', text: data.warning });
                          }
                          await fetchProjects();
                        } catch (error) {
                          setMessage({ type: 'error', text: 'Failed to sync' });
                        } finally {
                          setSyncing(false);
                        }
                      }}
                      disabled={syncing}
                    >
                      <Flex align="center" gap={4}>
                        <RefreshCw size={14} />
                        Retry Sync
                      </Flex>
                    </Button>
                  </Flex>
                </Box>
              )}

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Project</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Role</th>
                    {isOwner && <th className="text-right py-2 px-2 font-medium text-gray-700">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {allProjects.map(project => {
                    const isAssigned = project.status === 'assigned';
                    const hasPendingChange = pendingChanges.has(project.name);

                    return (
                      <tr
                        key={project.name}
                        className={`border-b border-gray-200 ${
                          !project.synced && isAssigned ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="py-2 px-2">
                          <Text className="font-medium">{project.name}</Text>
                          {project.syncError && (
                            <Text className="text-xs text-red-600">Error: {project.syncError}</Text>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {isAssigned ? (
                            project.synced ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-300">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
                                Pending
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-gray-500">Not added</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {isAssigned && project.role && (
                            <Text className="text-sm">{project.role}</Text>
                          )}
                          {hasPendingChange && !isAssigned && (
                            <Text className="text-sm text-blue-600">{pendingChanges.get(project.name)}</Text>
                          )}
                        </td>
                        {isOwner && (
                          <td className="py-2 px-2 text-right">
                            <Select
                              value={pendingChanges.get(project.name) || (isAssigned ? project.role : 'select')}
                              onChange={(e) => {
                                const value = e.target.value;
                                const newChanges = new Map(pendingChanges);
                                if (value !== 'select' && value !== project.role) {
                                  newChanges.set(project.name, value);
                                } else {
                                  newChanges.delete(project.name);
                                }
                                setPendingChanges(newChanges);
                              }}
                              disabled={saving || updating === project.name}
                              className={`text-xs ${hasPendingChange ? 'border-blue-500' : ''}`}
                              style={{ width: '140px' }}
                            >
                              <option value="select" disabled>
                                {isAssigned ? `Current: ${project.role}` : 'Select role...'}
                              </option>
                              <option value="Data owner">Data owner</option>
                              <option value="Data scientist">Data scientist</option>
                              <option value="Observer">Observer</option>
                            </Select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Save button */}
              {isOwner && pendingChanges.size > 0 && (
                <Flex justify="end" className="mt-3">
                  <Button
                    size="sm"
                    intent="primary"
                    onClick={async () => {
                      setSaving(true);
                      setMessage(null);
                      let successCount = 0;
                      let errorCount = 0;

                      const changes = Array.from(pendingChanges.entries());
                      for (const [projectName, role] of changes) {
                        const project = [...memberProjects, ...ownerProjects].find(p => p.name === projectName);
                        if (project && role && role !== 'select') {
                          try {
                            await updateProjectRole(projectName, project.id, role);
                            successCount++;
                          } catch (error) {
                            errorCount++;
                          }
                        }
                      }

                      if (successCount > 0 && errorCount === 0) {
                        setMessage({
                          type: 'success',
                          text: `Successfully updated ${successCount} role${successCount > 1 ? 's' : ''}`
                        });
                        setPendingChanges(new Map());
                      } else if (errorCount > 0) {
                        setMessage({
                          type: 'error',
                          text: `${errorCount} update(s) failed`
                        });
                      }

                      setSaving(false);
                      setTimeout(() => setMessage(null), 5000);
                    }}
                    disabled={saving}
                  >
                    {saving ? (
                      <><Loader className="animate-spin mr-1" size={14} /> Saving...</>
                    ) : (
                      `Save Changes (${pendingChanges.size})`
                    )}
                  </Button>
                </Flex>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
