import { useState } from 'react';
import { Box, Flex, Text, Button } from 'tailwind-quartz';
import { ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

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
  const [expanded, setExpanded] = useState(false);

  const isActive = !!hopsworksUsername;
  const displayName = memberName || memberEmail;

  return (
    <Box className="mt-3">
      <Button
        onClick={() => setExpanded(!expanded)}
        size="sm"
        intent="ghost"
        className="text-xs"
      >
        {isActive ? (
          <CheckCircle size={14} className="text-green-600" />
        ) : (
          <AlertCircle size={14} className="text-yellow-600" />
        )}
        {expanded ? 'Hide' : 'View'} Hopsworks Status
      </Button>

      {expanded && (
        <Box className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded">
          <Flex direction="column" gap={12}>
            <Box>
              <Text className="text-sm font-medium mb-2">
                Hopsworks Access for {displayName}
              </Text>

              <Flex align="center" gap={8} className="mb-3">
                {isActive ? (
                  <>
                    <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-green-100 text-green-700 border border-green-300">
                      <CheckCircle size={12} className="mr-1" />
                      Active
                    </span>
                    <Text className="text-xs text-gray-600">
                      Username: {hopsworksUsername}
                    </Text>
                  </>
                ) : (
                  <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
                    <AlertCircle size={12} className="mr-1" />
                    Syncing...
                  </span>
                )}
              </Flex>
            </Box>

            <Box className="p-3 bg-blue-50 border border-blue-200 rounded">
              <Text className="text-sm text-blue-800 mb-2">
                💡 Project management is handled in Hopsworks UI
              </Text>
              <Text className="text-xs text-blue-700 mb-3">
                To view or manage {displayName}&apos;s project access, including roles and permissions, use the Hopsworks interface directly.
              </Text>

              {clusterUrl && isActive && (
                <Button
                  as="a"
                  href={clusterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  intent="primary"
                  className="text-xs"
                >
                  <ExternalLink size={14} />
                  Open Hopsworks
                </Button>
              )}
            </Box>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
