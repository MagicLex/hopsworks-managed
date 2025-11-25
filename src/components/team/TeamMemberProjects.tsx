import { Box, Flex, Text } from 'tailwind-quartz';
import { CheckCircle, AlertCircle, FolderOpen } from 'lucide-react';

interface ProjectRole {
  project_name: string;
  role: string;
  synced_to_hopsworks: boolean;
}

interface TeamMemberProjectsProps {
  memberId: string;
  memberEmail: string;
  memberName: string;
  hopsworksUsername?: string;
  clusterUrl?: string;
  projects?: ProjectRole[];
}

export default function TeamMemberProjects({
  memberId,
  memberEmail,
  memberName,
  hopsworksUsername,
  clusterUrl,
  projects
}: TeamMemberProjectsProps) {
  const isActive = !!hopsworksUsername;
  const syncedProjects = projects?.filter(p => p.synced_to_hopsworks) || [];

  return (
    <Box>
      <Flex align="center" gap={8}>
        {isActive ? (
          <>
            <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-green-100 text-green-700 border border-green-300">
              <CheckCircle size={12} className="mr-1" />
              Active in Hopsworks
            </span>
            <Text className="text-xs text-gray-600">
              {hopsworksUsername}
            </Text>
          </>
        ) : (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
            <AlertCircle size={12} className="mr-1" />
            Syncing to Hopsworks...
          </span>
        )}
      </Flex>

      {syncedProjects.length > 0 && (
        <Flex align="center" gap={6} className="mt-2">
          <FolderOpen size={14} className="text-gray-400" />
          <Flex gap={6} className="flex-wrap">
            {syncedProjects.map((project) => (
              <span
                key={project.project_name}
                className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700"
                title={`Role: ${project.role}`}
              >
                {project.project_name}
              </span>
            ))}
          </Flex>
        </Flex>
      )}
    </Box>
  );
}
