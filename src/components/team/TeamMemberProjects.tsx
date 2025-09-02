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
}

export default function TeamMemberProjects({ 
  memberId, 
  memberEmail,
  memberName,
  isOwner
}: TeamMemberProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchProjects = async () => {
    if (!expanded) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/team/member-projects?memberId=${memberId}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch member projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchProjects();
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProjectRole = async (projectName: string, role: string, action: 'add' | 'remove') => {
    if (!isOwner) return;
    
    try {
      setUpdating(projectName);
      const response = await fetch('/api/team/member-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
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
          
          {loading ? (
            <Flex align="center" justify="center" className="py-4">
              <Loader className="animate-spin" size={16} />
              <Text className="ml-2 text-sm text-gray-600">Loading projects...</Text>
            </Flex>
          ) : projects.length === 0 ? (
            <Text className="text-sm text-gray-600">
              No projects assigned yet. Add this member to projects in Hopsworks or use the admin panel.
            </Text>
          ) : (
            <Box className="space-y-2">
              {projects.map(project => (
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
                            updateProjectRole(project.name, '', 'remove');
                          } else if (value !== project.role) {
                            updateProjectRole(project.name, value, 'add');
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