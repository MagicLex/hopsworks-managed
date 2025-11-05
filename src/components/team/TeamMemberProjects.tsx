import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Select, StatusMessage } from 'tailwind-quartz';
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
        {expanded ? 'Hide' : 'View'} Projects
      </Button>

      {expanded && (
        <Box className="mt-3">
          <Text className="text-sm font-medium mb-3">
            Project Access for {memberName || memberEmail}
          </Text>

          {isOwner && (
            <Box className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <Text className="text-sm text-blue-800">
                💡 To add team members to projects, use the Hopsworks UI: Project → Members → Add Member
              </Text>
            </Box>
          )}

          {message && (
            <StatusMessage
              variant={message.type}
              icon={
                message.type === 'success' ? <CheckCircle size={16} /> :
                message.type === 'error' ? <AlertCircle size={16} /> :
                null
              }
              className="mb-3"
            >
              <Text className="text-sm">{message.text}</Text>
            </StatusMessage>
          )}

          {loading || syncing ? (
            <Flex align="center" justify="center" className="py-8">
              <Loader className="animate-spin" size={20} />
              <Text className="ml-2 text-sm text-gray-600">
                {syncing ? 'Syncing...' : 'Loading...'}
              </Text>
            </Flex>
          ) : memberProjects.length === 0 ? (
            <Text className="text-sm text-gray-500 py-4">No projects found</Text>
          ) : (
            <>
              {/* Removed sync warning - we now query Hopsworks directly */}
              {false && memberProjects.some(p => !p.synced) && isOwner && (
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

              <Box className="space-y-2">
                {memberProjects.map(project => (
                  <Box key={project.name} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <Flex justify="between" align="center">
                      <Box>
                        <Text className="font-medium">{project.name}</Text>
                        <Text className="text-xs text-gray-600">Role: {project.role}</Text>
                      </Box>
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-300">
                        Active
                      </span>
                    </Flex>
                  </Box>
                ))}</Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
