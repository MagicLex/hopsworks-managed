import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Badge, Select, Card } from 'tailwind-quartz';
import { FolderOpen, Loader } from 'lucide-react';

interface Project {
  name: string;
  id: number;
  namespace: string;
  role?: string;
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
    if (!expanded) return;
    
    try {
      setLoading(true);
      
      // If owner, sync roles from Hopsworks first
      if (isOwner) {
        await syncRoles();
      }
      
      // Fetch both member's current projects and owner's available projects
      const [memberResponse, ownerResponse] = await Promise.all([
        fetch(`/api/team/member-projects?memberId=${memberId}`),
        fetch(`/api/team/owner-projects`)
      ]);
      
      if (!memberResponse.ok) throw new Error('Failed to fetch member projects');
      if (!ownerResponse.ok) throw new Error('Failed to fetch owner projects');
      
      const memberData = await memberResponse.json();
      const ownerData = await ownerResponse.json();
      
      setMemberProjects(memberData.projects || []);
      setOwnerProjects(ownerData.projects || []);
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

  const updateProjectRole = async (projectName: string, projectId: number, role: string, action: 'add' | 'remove') => {
    if (!isOwner) return;
    
    try {
      setUpdating(projectName);
      const response = await fetch('/api/team/member-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          projectName,
          projectId,
          role,
          action
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project role');
      }

      // Refresh projects
      await fetchProjects();
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <Box className="mt-3">
      <Button
        onClick={handleToggle}
        size="sm"
        intent="ghost"
        className="text-xs"
      >
        <FolderOpen size={14} className="mr-1" />
        {expanded ? 'Hide' : 'Manage'} Projects
      </Button>

      {expanded && (
        <Card className="mt-3 p-3 bg-gray-50">
          <Text className="text-sm font-medium mb-2">
            Project Access for {memberName || memberEmail}
          </Text>
          
          {loading || syncing ? (
            <Flex align="center" justify="center" className="py-4">
              <Loader className="animate-spin" size={16} />
              <Text className="ml-2 text-sm text-gray-600">
                {syncing ? 'Syncing with Hopsworks...' : 'Loading projects...'}
              </Text>
            </Flex>
          ) : (
            <Box className="space-y-3">
              {/* Member's current projects */}
              {memberProjects.length > 0 && (
                <Box>
                  <Text className="text-xs font-medium text-gray-700 mb-2">Current Access</Text>
                  <Box className="space-y-2">
                    {memberProjects.map(project => (
                <Flex 
                  key={project.namespace} 
                  justify="between" 
                  align="center"
                  className="p-2 bg-white rounded border border-gray-200"
                >
                  <Box>
                    <Text className="text-sm font-medium">{project.name}</Text>
                    <Text className="text-xs text-gray-500">ID: {project.id}</Text>
                  </Box>
                  <Flex gap={8} align="center">
                    {project.role && (
                      <Badge size="sm" variant="default">
                        {project.role}
                      </Badge>
                    )}
                    {isOwner && (
                      <Select
                        value={project.role || 'add'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'remove') {
                            updateProjectRole(project.name, project.id, '', 'remove');
                          } else if (value !== project.role) {
                            updateProjectRole(project.name, project.id, value, 'add');
                          }
                        }}
                        disabled={updating === project.name}
                        className="text-xs"
                        style={{ width: '140px' }}
                      >
                        <option value="add" disabled>Change Role</option>
                        <option value="Data owner">Data owner</option>
                        <option value="Data scientist">Data scientist</option>
                        <option value="Observer">Observer</option>
                        <option value="remove">Remove Access</option>
                      </Select>
                    )}
                  </Flex>
                </Flex>
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Available projects to add */}
              {isOwner && ownerProjects.length > 0 && (
                <Box>
                  <Text className="text-xs font-medium text-gray-700 mb-2">
                    {memberProjects.length === 0 ? 'Your Projects' : 'Add to More Projects'}
                  </Text>
                  <Box className="space-y-2">
                    {ownerProjects
                      .filter(p => !memberProjects.some(mp => mp.name === p.name))
                      .map(project => (
                        <Flex 
                          key={project.namespace} 
                          justify="between" 
                          align="center"
                          className="p-2 bg-white rounded border border-gray-200 opacity-75"
                        >
                          <Box>
                            <Text className="text-sm font-medium">{project.name}</Text>
                            <Text className="text-xs text-gray-500">Not added yet</Text>
                          </Box>
                          <Select
                            onChange={(e) => {
                              const role = e.target.value;
                              if (role && role !== 'select') {
                                updateProjectRole(project.name, project.id, role, 'add');
                              }
                            }}
                            disabled={updating === project.name}
                            className="text-xs"
                            style={{ width: '140px' }}
                            defaultValue="select"
                          >
                            <option value="select">Add with role...</option>
                            <option value="Data scientist">Data scientist</option>
                            <option value="Data owner">Data owner</option>
                            <option value="Observer">Observer</option>
                          </Select>
                        </Flex>
                      ))}
                  </Box>
                </Box>
              )}
              
              {memberProjects.length === 0 && ownerProjects.length === 0 && (
                <Text className="text-sm text-gray-600">
                  No projects available. Create projects in Hopsworks first.
                </Text>
              )}
            </Box>
          )}
          
          {isOwner && (
            <Box className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <Text className="text-xs text-blue-800">
                <strong>Tip:</strong> You can also manage project access directly in Hopsworks.
              </Text>
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}