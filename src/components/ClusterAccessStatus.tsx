import { Box, Card, Text, Button, StatusMessage, Flex } from 'tailwind-quartz';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface ClusterAccessStatusProps {
  hasCluster: boolean;
  hasPaymentMethod: boolean;
  billingMode?: string;
  clusterName?: string;
  loading?: boolean;
  reloadProgress?: number;
  isTeamMember?: boolean;
}

export default function ClusterAccessStatus({
  hasCluster,
  hasPaymentMethod,
  billingMode,
  clusterName,
  loading = false,
  reloadProgress = 0,
  isTeamMember = false
}: ClusterAccessStatusProps) {
  // Show skeleton loader while loading OR when billingMode is not yet loaded
  if (loading || billingMode === undefined) {
    return (
      <Card className="p-4">
        <Flex align="center" gap={12}>
          <Box className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
          <Box className="flex-1">
            <Box className="h-5 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
            <Box className="h-4 bg-gray-200 rounded w-56 animate-pulse" />
          </Box>
        </Flex>
      </Card>
    );
  }

  if (hasCluster) {
    return (
      <StatusMessage variant="success" icon={<CheckCircle size={20} />}>
        <Box>
          <Text className="font-semibold text-green-800">Cluster Access Active</Text>
          <Text className="text-sm text-green-700">
            Connected to: {clusterName || 'Hopsworks Cluster'}
          </Text>
        </Box>
      </StatusMessage>
    );
  }

  // For prepaid users, show different message
  if (billingMode === 'prepaid' && !hasCluster) {
    return (
      <StatusMessage variant="info" icon={<AlertTriangle size={20} />}>
        <Box>
          <Text className="font-semibold text-blue-800 mb-3">
            Cluster Setup In Progress
          </Text>
          <Text className="text-sm text-blue-700 mb-4">
            Your cluster is being provisioned. This typically takes a few minutes.
            If you continue to see this message, please contact support.
          </Text>

          {/* Retro progress bar */}
          {reloadProgress > 0 && (
            <Box className="mt-3">
              <Text className="text-xs text-blue-600 mb-2 font-mono">
                Checking status... {Math.floor(reloadProgress)}%
              </Text>
              <Box className="w-full h-4 bg-blue-100 border-2 border-blue-300 rounded overflow-hidden">
                <Box
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-100 ease-linear"
                  style={{
                    width: `${reloadProgress}%`,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.2) 10px, rgba(255,255,255,.2) 20px)'
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </StatusMessage>
    );
  }

  // Team members don't need to set up payment - show syncing message
  if (isTeamMember) {
    return (
      <StatusMessage variant="info" icon={<AlertTriangle size={20} />}>
        <Box>
          <Text className="font-semibold text-blue-800 mb-3">
            Setting Up Your Access
          </Text>
          <Text className="text-sm text-blue-700">
            Your cluster access is being configured. This usually takes a few moments.
          </Text>
        </Box>
      </StatusMessage>
    );
  }

  return (
    <StatusMessage variant="warning" icon={<AlertTriangle size={20} />}>
      <Box>
        <Text className="font-semibold text-yellow-800 mb-3">
          Cluster Access Pending
        </Text>
        {!hasPaymentMethod ? (
          <>
            <Text className="text-sm text-yellow-700 mb-4">
              Set up a payment method to get access to Hopsworks clusters.
            </Text>
            <Link href="/billing">
              <Button
                intent="primary"
                size="md"
              >
                Set Up Payment
              </Button>
            </Link>
          </>
        ) : (
          <Text className="text-sm text-yellow-700">
            Your cluster access is being provisioned. This usually takes a few minutes.
          </Text>
        )}
      </Box>
    </StatusMessage>
  );
}