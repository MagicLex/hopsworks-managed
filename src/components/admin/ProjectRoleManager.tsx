import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Card, Badge, Select } from 'tailwind-quartz';

interface Project {
  name: string;
  id: number;
  namespace: string;
  role?: string;
}

interface ProjectRoleManagerProps {
  userId: string;
  userEmail: string;
  isTeamMember: boolean;
  accountOwnerId?: string;
}

export default function ProjectRoleManager({ 
  userId, 
  userEmail, 
  isTeamMember,
  accountOwnerId 
}: ProjectRoleManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/project-roles?userId=${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const updateProjectRole = async (projectName: string, role: string, action: 'add' | 'remove') => {
    try {
      setUpdating(projectName);
      const response = await fetch('/api/admin/project-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          projectName,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdating(null);
    }
  };

  const bulkAssignToOwnerProjects = async () => {
    if (!isTeamMember || !accountOwnerId) return;

    try {
      setBulkAssigning(true);
      const response = await fetch('/api/admin/project-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberId: userId,
          ownerId: accountOwnerId,
          defaultRole: 'Data scientist'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign to owner projects');
      }

      const result = await response.json();
      if (result.addedToProjects?.length > 0) {
        console.log(`Added to projects: ${result.addedToProjects.join(', ')}`);
      }
      
      // Refresh projects
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk assign');
    } finally {
      setBulkAssigning(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <Text className="text-gray">Loading projects...</Text>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <Flex justify="between" align="center" className="mb-4">
        <Box>
          <Text className="font-semibold">Project Access</Text>
          <Text className="text-xs text-gray">{userEmail}</Text>
        </Box>
        {isTeamMember && (
          <Button
            onClick={bulkAssignToOwnerProjects}
            disabled={bulkAssigning}
            size="sm"
            intent="primary"
          >
            {bulkAssigning ? 'Assigning...' : 'Auto-Assign to Owner Projects'}
          </Button>
        )}
      </Flex>

      {error && (
        <Box className="mb-4 p-2 bg-dangerShade1 border border-dangerDefault rounded">
          <Text className="text-sm text-dangerDefault">{error}</Text>
        </Box>
      )}

      {projects.length === 0 ? (
        <Text className="text-sm text-gray">No projects found</Text>
      ) : (
        <Box className="space-y-2">
          {projects.map(project => (
            <Box 
              key={project.namespace} 
              className="p-3 border border-grayShade2 rounded hover:bg-grayShade1/30"
            >
              <Flex justify="between" align="center">
                <Box>
                  <Text className="font-medium">{project.name}</Text>
                  <Text className="text-xs text-gray">
                    Namespace: {project.namespace} | ID: {project.id}
                  </Text>
                </Box>
                <Flex gap={2} align="center">
                  {project.role && (
                    <Badge size="sm" variant="default">
                      {project.role}
                    </Badge>
                  )}
                  <Select
                    value={project.role || 'add'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'remove') {
                        updateProjectRole(project.name, '', 'remove');
                      } else if (value !== project.role) {
                        updateProjectRole(project.name, value, 'add');
                      }
                    }}
                    disabled={updating === project.name}
                    className="w-40"
                  >
                    <option value="add" disabled>Add Role</option>
                    <option value="Data owner">Data owner</option>
                    <option value="Data scientist">Data scientist</option>
                    <option value="Observer">Observer</option>
                    <option value="remove">Remove Access</option>
                  </Select>
                </Flex>
              </Flex>
            </Box>
          ))}
        </Box>
      )}

      <Box className="mt-4 p-3 bg-infoShade1 border border-infoDefault rounded">
        <Text className="text-xs text-infoDefault">
          <strong>Note:</strong> Changes are applied immediately in Hopsworks. 
          Team members will get access on their next login through the health check system.
        </Text>
      </Box>
    </Card>
  );
}