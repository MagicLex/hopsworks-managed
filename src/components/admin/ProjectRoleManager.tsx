import { useState, useEffect } from 'react';
import { Box, Flex, Text, Card, Badge } from 'tailwind-quartz';

interface Project {
  name: string;
  id: number;
  namespace: string;
  role?: string;
}

interface UserProjectsViewerProps {
  userId: string;
  userEmail: string;
  isTeamMember: boolean;
  accountOwnerId?: string;
}

export default function UserProjectsViewer({ 
  userId, 
  userEmail, 
  isTeamMember,
  accountOwnerId 
}: UserProjectsViewerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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


  if (loading) {
    return (
      <Card className="p-4">
        <Text className="text-gray">Loading projects...</Text>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <Box className="mb-4">
        <Text className="font-semibold">User&apos;s Hopsworks Projects</Text>
        <Text className="text-xs text-gray">{userEmail}</Text>
      </Box>

      {error && (
        <Box className="mb-4 p-2 bg-dangerShade1 border border-dangerDefault rounded">
          <Text className="text-sm text-dangerDefault">{error}</Text>
        </Box>
      )}

      {projects.length === 0 ? (
        <Text className="text-sm text-gray">No projects found for this user</Text>
      ) : (
        <Box className="space-y-2">
          <Text className="text-xs text-gray mb-2">Total: {projects.length} project{projects.length !== 1 ? 's' : ''}</Text>
          {projects.map(project => (
            <Box 
              key={project.id} 
              className="p-3 border border-grayShade2 rounded"
            >
              <Flex justify="between" align="center">
                <Box>
                  <Text className="font-medium">{project.name}</Text>
                  <Text className="text-xs text-gray">
                    Project ID: {project.id} | Namespace: {project.name}
                  </Text>
                </Box>
                {project.role && (
                  <Badge size="sm" variant="default">
                    {project.role}
                  </Badge>
                )}
              </Flex>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}