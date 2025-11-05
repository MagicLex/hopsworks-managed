import { Box, Flex, Text } from 'tailwind-quartz';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface TeamMemberProjectsProps {
  memberId: string;
  memberEmail: string;
  memberName: string;
  hopsworksUsername?: string;
  clusterUrl?: string;
}

export default function TeamMemberProjects({
  memberId,
  memberEmail,
  memberName,
  hopsworksUsername,
  clusterUrl
}: TeamMemberProjectsProps) {
  const isActive = !!hopsworksUsername;

  return (
    <Flex align="center" gap={8} className="mt-2">
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
  );
}
